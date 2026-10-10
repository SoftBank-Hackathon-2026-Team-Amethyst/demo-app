# 보안 분석

분석일: 2026-10-10 (yolo 재검증, 기준 커밋 b8bc6d8)

브리프(2026-10-10): 하루 100명 이하 · 월 10만 원 이하 · 민감 데이터 **예** · 선호 대상 **AWS** · 가용성 **시연용**. `.deploy/config.yaml`은 `compliance: regulated`, `template_version: v2.1.4`(워크플로 호출부는 v2.2.1 — 아래 "배포 뒤 고칠 문제" 13).

이 문서는 같은 날 janto 2차 분석(커밋 3b0caf7 기준으로 적혔지만 내용은 PR #52 **이전** 코드, 즉 chaos 게이트 · `/health` 503 · PGSSL이 없는 상태를 설명했다)의 **델타 재검증**이다. `git log --stat 3b0caf7..HEAD`로 확인한 변경: PR #54 FE i18n(en/ja/ko), #53 템플릿 v2.1.4, #55 `APP_VERSION v2.0.0`, #56/#57 p95 클라이언트 계산 · Dockerfile `--platform=$BUILDPLATFORM`, #59/#60 T31 승인자용 green 미리보기(Cognito 중계 모듈 · `previewAuth` 값 · 템플릿 v2.2.1). 그리고 3b0caf7 자체(PR #52)에 들어간 `CHAOS_ENABLED` 게이트 · `/health` 503, #51의 PGSSL을 현재 코드로 다시 판정했다. `be/src`는 3b0caf7 이후 변경이 없다.

조사 범위: `be/src`, `be/tests`, `fe/src`(`App.tsx`, `i18n.ts`), `fe/nginx.conf`, 두 Dockerfile, `deploy/`, `infra/envs/aws/*.tf`, `.github/workflows/*.yml`, `.trivyignore`, `.deploy/smoke.json`. 참조로 platform 저장소(`/Users/gayeonwon/orca/one-tatchi/one-tatchi-platform`, `git show v2.2.1:…`로 태그 내용만 읽음)의 App Chart `preview-auth.yaml` · `ingress.yaml` · `rollout.yaml` · `values.yaml`, `modules/preview_auth/aws`, 재사용 `deploy.yml` · `checks.yml`, `check-artifacts.sh`, ADR 0011 · 0015, 그리고 로컬 `.terraform` 모듈 캐시(gitignore 대상)를 봤다. 수정한 것은 이 파일뿐이다.

로컬 도구: trivy 0.75.0, pnpm 10.28.1. gitleaks · osv-scanner 없음(설치하지 않음).

## 배포를 막는 문제

1. **prod에서 인증 없는 장애 주입 API가 여전히 열린다 — 상태: 게이트는 생겼으나 켜져 있음.** `be/src/routes/chaos.ts:18-20`의 `chaosEnabledFromEnv()`가 `CHAOS_ENABLED`를 읽고, `chaos.ts:34-37`에서 false면 `POST /api/chaos` · `POST /api/chaos/reset`을 등록하지 않는다(`be/tests/chaos.test.ts`가 검증). 그러나 `deploy/values-be.yaml:22`가 `CHAOS_ENABLED: "true"`이고, `.github/workflows/deploy.yml:99-101`(test)과 `128-130`(prod)이 **같은 값 파일**을 쓴다. platform `deploy.yml@v2.2.1`의 값 합성은 `-f <서비스 values> -f deploy/<대상>/values.yaml`뿐이라(재사용 워크플로 404-423행) 환경별 덮어쓰기 경로가 없다. 따라서 main 머지 → prod 승격 시 prod BE도 POST가 열린 채 올라가고, `fe/nginx.conf:23-28`이 `/api/`를 통째로 프록시하므로 인터넷에서 `errorRate: 1`(health 제외 모든 요청 500) · `latencyMs`(상한 없음, `chaos.ts:42`) · `dbError: true`(쓰기가 메모리로 가서 DB에 남지 않음)를 누구나 넣을 수 있다. `/health`는 chaos 영향에서 빠졌으므로(`be/src/index.ts:43-44`, `health.ts:9` `ignoreChaos`) 이전 분석의 "파드 NotReady → 재시작" 경로는 사라졌지만, 사용자 요청이 전부 500이 되는 결과는 같다.
   - **test 배포(yolo 경로)는 막지 않는다.** 시연 환경이고 승인 없이 올라가는 환경이라 열어 두는 것이 값 파일 주석의 의도와 맞는다.
   - **prod 승격 전에 끈다.** 코드 수정 없이 되는 방법(권장 순): (a) prod job의 `services`가 다른 값 파일을 가리키게 한다 — 예: `deploy/values-be-prod.yaml`(`values-be.yaml` 복사 + `CHAOS_ENABLED: "false"`), `changes` 필터 `deploy/values-*.yaml`(`deploy.yml:52`)에 그대로 잡힌다; (b) 시연이 끝나면 `values-be.yaml`에서 `false`로 바꾼다(test도 같이 꺼진다). 토큰 헤더 방식은 BE · FE 수정이 필요해 이번 재검증에서는 권하지 않는다. `GET /api/chaos`는 항상 열려 있고 상태 · `enabled`만 돌려주므로(`chaos.ts:30-32`, smoke가 사용) 그대로 둔다.

아래는 막는 기준에 걸리지 않았다.

- 비밀값 커밋: 없음. `git ls-files`에 `.env*` · `*.pem` · `*.key` · `*.tfvars` · `*.tfstate` · credentials 파일 없음, AWS 키 · GitHub 토큰 · Slack 토큰 · 개인키 · `password=` 패턴 없음. **새로 들어온 식별자**(`deploy/values-fe.yaml:35-36`의 Cognito issuer URL(User Pool ID) · Secrets Manager ARN, `infra/envs/aws/variables.tf:86`의 Identity Center SAML 메타데이터 URL, `variables.tf:4`의 계정 ID)는 **비밀값이 아니다** — 아래 "가정" 참고. 로컬 기본 `demo/demo`(`docker-compose.yml`, `be/src/db/index.ts:5`)는 운영에서 `demo-app-db` Secret이 덮어쓴다. 파이프라인 `secret-scan`(gitleaks v8.24.3)이 다시 본다.
- HIGH 이상 취약점: `trivy fs --scanners vuln` 전체 심각도 기준 `be/pnpm-lock.yaml` 0건, `fe/pnpm-lock.yaml` 0건. `pnpm audit`: fe 0건, be moderate 2건(esbuild ≤0.24.2, GHSA-67mh-4wv8-2f99, `drizzle-kit` devDependency 경로 — `be/Dockerfile:25` `--prod`라 운영 이미지에 없음). 이전과 같다.
- IaC misconfig HIGH 이상: 레포에 커밋된 Terraform 루트 기준 0건. 로컬 `trivy config infra/envs/aws`는 HIGH 3건을 냈지만 전부 gitignore된 `.terraform/modules/cluster.eks/examples/eks-auto-mode/deployment.yaml`(terraform-aws-modules 예제 매니페스트, KSV-0014 · KSV-0118)이라 파이프라인 체크아웃에는 없다. 새로 나온 MEDIUM(AWS-0038 EKS controllerManager · scheduler 로그, AWS-0178 VPC Flow Logs)과 LOW(AWS-0098 preview 시크릿 기본 KMS 키, AWS-0017 로그 그룹 미암호화, AWS-0033 ECR KMS)는 "규제" 절에 적었다. Dockerfile: BE 0건, FE `DS-0026`(LOW, HEALTHCHECK 없음 — k8s probe가 대신).
- 인증 없는 관리 기능: 1번 외 없음. green 미리보기는 이번에 **인증 뒤로 들어갔다**(노출 표).

## 배포 뒤 고칠 문제

우선순위 순. 이전 분석의 1(BE→RDS TLS) · 2(DB 실패 숨기는 health) · 7(`dev` 패키지)은 **해결됐다**(14번).

1. **test · prod가 같은 RDS 데이터베이스 `demo`를 쓴다** — `infra/envs/aws/main.tf:166-187`이 두 네임스페이스에 같은 host · DB 이름을 넘긴다. 승인 없이 배포되는 test에서 prod 방명록을 읽고 지울 수 있다. 민감 데이터 "예"면 분리가 맞다. 모듈이 `database_name` 하나만 받으므로 platform 변경 요청이 필요하고, 그 전까지 test 쓰기 smoke는 넣지 않는다(지금 `.deploy/smoke.json`은 `POST /api/guestbook` 400 검증만 — 유지). 1번 chaos와 결합하면 test에서 `dbError`를 켜도 prod 데이터에는 영향이 없지만(파드별 인메모리 상태), prod BE에 직접 넣으면 prod 쓰기가 유실된다는 점은 위 막는 문제 그대로다.
2. **쓰기 API 속도 제한 없음** — `POST /api/votes/:id`, `POST /api/guestbook`. `be/package.json`에 `@fastify/rate-limit` 없음. FE 부하 생성기(`App.tsx`)가 보여주듯 누구나 초당 수십 회를 보낼 수 있다. IP당 분당 N회 또는 ALB WAF rate-based rule.
3. **방명록 삭제 · 보존 기간 없음** — 자유 텍스트에 개인정보가 들어올 수 있으나 삭제 API · 만료가 없다. 민감 데이터 "예"의 가장 그럴듯한 해석이 이 항목이다(규제 절). 관리자 DELETE 또는 N일 후 삭제 + 입력칸 안내 문구.
4. **`/health` 503이 liveness에도 걸린다** — App Chart `rollout.yaml:61-70`은 readiness · liveness가 같은 `probe.path`(`/health`)를 쓴다. `be/src/routes/health.ts:17-19`가 DB 미연결 시 503이므로 RDS 장애 때 readiness(올바름)뿐 아니라 liveness도 실패해 파드가 재시작을 반복한다. replica 1이라 서비스는 어차피 내려가지만, DB가 돌아와도 재시작 루프 때문에 복구가 늦어진다. liveness는 `/healthz/liveness`로 분리하는 것이 맞다(차트에 liveness 경로 분리 입력이 없으면 platform 요청).
5. **운영 정보 노출** — `/api/info`(파드 호스트명 · env · 리전 · DB 상태), `/api/metrics`(호스트명 · CPU · 메모리), `/health`(`fe/nginx.conf:30-34` 프록시), `GET /api/chaos`(장애 주입 상태와 `enabled` 플래그 — prod에서 POST가 열려 있는지 외부에서 알 수 있다). 시연 화면이 쓰는 값이라 의도된 노출이지만 운영에서는 `hostname` · `region`을 빼고 `/health` 프록시를 지운다.
6. **CORS 전체 허용** — `be/src/index.ts:28-31` `origin: true`. 같은 오리진 프록시라 지금 위험은 낮다. 허용 오리진을 환경변수로 제한하거나 플러그인을 뺀다.
7. **nginx 보안 헤더 없음** — `fe/nginx.conf`에 `X-Content-Type-Options` · `Referrer-Policy` · `Content-Security-Policy` · `Strict-Transport-Security` 없음. ALB는 HSTS를 넣지 않는다. i18n(아래 15)으로 XSS 경로가 생기지는 않았지만 기본 헤더는 넣는다.
8. **네임스페이스 간 NetworkPolicy 없음** — App Chart v2.2.1 템플릿 목록에 NetworkPolicy 없음. ADR 0011도 내부 격리를 T30 미완료로 남겼다. test 파드가 `demo-app-be.prod.svc:8000`에 직접 붙어 `/api/chaos` POST를 포함한 모든 경로를 부를 수 있다. 1번(막는 문제)을 값으로 끄면 prod에는 POST 자체가 없으므로 위험이 낮아진다.
9. **green 미리보기 접근 통제의 한계** — (a) `previewAuth.emailDomains: ["*"]` · `allowUnverifiedEmail: true`(차트 기본, `charts/app/values.yaml:84-87`)라 **로그인 허용 범위는 Identity Center 앱 할당 하나**에 의존한다. 레포에서 할당 그룹을 확인할 수 없다. (b) Identity Center MFA 꺼짐(ADR 0001 · 0015 §5). (c) green FE는 blue BE를 호출한다(`fe/nginx.conf:24`가 active Service `demo-app-be`로 프록시, ADR 0015 §5) — 보안 문제라기보다 "green 미리보기로 BE 변경을 검증했다고 볼 수 없다"는 승인 절차의 한계. (d) oauth2-proxy 클라이언트 시크릿은 Cognito가 만들어 **tfstate에 남고**(모듈 주석, S3 `encrypt = true`), `secret_reader_arns = [plan 역할]`(`main.tf:137`)로 PR plan 역할이 `GetSecretValue`를 할 수 있다 — PR 브랜치의 Terraform이 plan에서 값을 출력하도록 바꾸면 PR 작성자가 읽을 수 있다. 모듈 주석대로 plan 역할은 state를 이미 읽으므로 새로 넓어진 권한은 아니지만, PR plan을 fork · 외부 기여자에게 열지 않는다는 전제가 붙는다. (e) `aws_secretsmanager_secret.recovery_window_in_days = 0` — 실수로 destroy하면 즉시 삭제(보안보다 복구 문제).
10. **test의 `DATABASE_URL` 스킴** — service-base `database-secret.yaml:18`은 `postgresql+psycopg://`, `PG_URL`(`:19`)만 `?sslmode=require`다. BE는 `DATABASE_URL`에 `PGSSL`을 더해 TLS로 붙으므로 동작하지만, `require`는 서버 인증서를 검증하지 않는다(postgres.js `ssl: 'require'`). VPC 안 RDS라 허용. 규제 수준을 올리려면 RDS CA 번들 + `verify-full`.
11. **GitHub Actions 참조 고정** — 같은 조직 재사용 워크플로는 `@v2.2.1` 태그(수용), `template-update.yml:23`은 `@v2` 유동 태그(이전 `@v1`), `slack-notify-preview.yml`은 `@v2.1.3`으로 남아 있다(기능 영향 없음). 외부 액션 `actions/checkout@v7` · `dorny/paths-filter@v3`는 SHA 고정이 아니다. `secrets: inherit`(`deploy.yml:68,107,134`)로 레포 비밀값 전부를 넘긴다.
12. **RDS 백업 · 삭제 보호** — 모듈 캐시 `database/aws/variables.tf:36-44` 기본 `backup_retention_days = 1`, `skip_final_snapshot = true`, `main.tf:45` `deletion_protection = false` 하드코딩. 규제 절.
13. **`.deploy/config.yaml`의 `template_version: v2.1.4`와 워크플로 호출부 `v2.2.1`이 다르다** — PR #60이 호출부만 올렸다. 보안 문제는 아니지만 template-update 워크플로가 다음 갱신 기준을 잘못 잡을 수 있다. `config.yaml`은 CODEOWNERS 보호 파일이므로 사람이 PR로 맞춘다(yolo 커밋은 `config-guard`가 `compliance` · CODEOWNERS 변경만 막고 `template_version`은 막지 않지만, 어차피 사람이 올리는 것이 맞다).
14. **해결된 항목(현재 코드로 확인)**: BE→RDS TLS — `be/src/db/index.ts:10-15` `sslOption()`이 `PGSSL`을 postgres.js `ssl` 옵션으로 넘기고(`:35-41`), `deploy/values-be.yaml:18` `PGSSL: require`, `deploy/gcp/values.yaml:10`도 같음, `be/tests/db-ssl.test.ts` 검증, platform `check-artifacts.sh:117-120`이 `env.PGSSL` 누락 · disable을 provision 검사에서 실패시킨다. DB 실패를 숨기는 health — `health.ts:17-19` 503, `.deploy/smoke.json` `/health expect 200`이 이제 실제 DB 연결을 검증한다. FE `dev` 패키지 — `fe/package.json:12-16` dependencies는 `lucide-react` · `react` · `react-dom`뿐. `DEPLOY_TARGET` 기본값 — `deploy.yml:8,87-93` 기본 `aws`. 이미지 하드닝(BE 런타임 npm · corepack · yarn 제거 `be/Dockerfile:31-33`, UID 1000, FE `nginx-unprivileged` UID 101, `apk upgrade`)과 App Chart 보안 컨텍스트(`_helpers.tpl:33-39`) 유지. Dockerfile `--platform=$BUILDPLATFORM`(`be/Dockerfile:2,18`, `fe/Dockerfile:2`)은 builder · deps 스테이지만 호스트 아키텍처로 돌리고 runner는 대상 플랫폼 그대로라 보안 영향 없음(deps가 순수 JS라는 전제 — 네이티브 의존성을 추가하면 아키텍처 불일치로 깨지지만 보안 문제는 아님).
15. **FE i18n(PR #54)에 XSS 경로 없음** — `fe/src/i18n.ts`의 문자열은 전부 정적 상수이고, 함수형 항목(`newVersionSwitched(v)` 등)은 숫자나 서버 `version` 문자열을 템플릿 리터럴로 합쳐 JSX 텍스트 노드로 렌더한다. 언어 선택은 `localStorage`(`App.tsx:74-80`)에서 읽되 `en|ja|ko`만 허용하고 URL 파라미터는 쓰지 않는다. `fe/src`에 `dangerouslySetInnerHTML` · `innerHTML` · `eval` 없음. 방명록 `name` · `message`는 `App.tsx:851,856`에서 텍스트 노드로 렌더(React 이스케이프).

## 노출

AWS 기준. 온프레미스 · GCP 구성은 레포에 있지만 브리프 선호 대상이 AWS라 기준이 아니다.

| 서비스 | 외부 노출 | 이유 |
|---|---|---|
| ALB → demo-app-fe (nginx :3000, active/blue) | **예** (HTTPS 443, 80→443 리다이렉트) | 유일한 공개 진입점. `deploy/values-fe.yaml:25-28` `ingress.enabled: true`, `deploy.yml:95,124`가 host(`yolo.onetatchi.soulee.dev` test, `onetatchi.soulee.dev` prod)를 넘겨 ACM 인증서 · `ingress.sslPolicy`(차트 `_helpers.tpl:44-58`). WAF · ALB 접근 로그 없음. |
| ALB → demo-app-fe-preview-auth (oauth2-proxy :4180) → demo-app-fe-preview (green) | **예, 단 SSO 로그인 뒤에만** (`green-yolo.onetatchi.soulee.dev` test, `green.onetatchi.soulee.dev` prod) | **이전 분석의 "무인증 :8080 preview"는 사라졌다.** App Chart v2.2.1 `ingress.yaml`은 active Ingress만 렌더하고(ADR 0011, "Legacy previewPort values are ignored"), `preview-auth.yaml`이 `previewAuth.enabled`일 때 oauth2-proxy Deployment · ExternalSecret · Service · Ingress(같은 ALB 그룹, 호스트 분리)를 만든다. 인증되지 않은 요청은 Cognito(→ Identity Center SAML) 로그인으로 보내고 green에 닿지 않는다. `--cookie-secure=true` · PKCE S256 · `prevent_user_existence_errors`, Cognito 자체 계정 로그인 · 자가 가입 차단(`modules/preview_auth/aws/main.tf:11-13,59`). 한계는 "배포 뒤 9". |
| demo-app-be (Fastify :8000) — `/api/*`, `/health` | **예 (FE 경유)** | 직접 Ingress 없음(`deploy/values-be.yaml`에 ingress 키 없음 → 차트 기본 false). `fe/nginx.conf:23-34`가 `/api/` 전체와 `/health`를 프록시하므로 `/api/votes` · `/api/guestbook` · `/api/info` · `/api/metrics` · `GET /api/chaos` · **`POST /api/chaos`(CHAOS_ENABLED=true인 동안)**가 인터넷에서 닿는다. 외부에서 안 닿는 BE 경로는 `/metrics`(Prometheus)와 `/healthz/liveness`뿐. |
| demo-app-be `/metrics`, FE 사이드카 :4040 | 아니오 | nginx가 프록시하지 않음. 클러스터 안 수집 전용. |
| Cognito Hosted UI (`demo-app-preview-993371732872.auth.ap-northeast-2.amazoncognito.com`) | **예** (로그인 화면만) | `modules/preview_auth/aws` User Pool 도메인. `supported_identity_providers`가 SAML IdP 하나뿐이라 Identity Center로 바로 넘어가고, 자체 계정 로그인 폼은 없다. `callback_urls`는 `preview_hosts` 두 개로 제한. |
| RDS PostgreSQL 17 | 아니오 | private subnet, `publicly_accessible = false`, SG는 EKS 노드 SG만 5432 허용(`main.tf:122-124`). TLS는 `PGSSL: require`. |
| EKS API 엔드포인트 | **예** (IAM 인증) | 모듈 `cluster/aws/main.tf:37` `endpoint_public_access = true`, CIDR 제한 없음. `.trivyignore` AWS-0040 · 0041 예외(GitHub hosted runner). |
| Secrets Manager (RDS 자격증명, Slack 봇, preview oauth2-proxy) | 아니오 | External Secrets가 `readable_secret_arns`(`main.tf:146`) 세 개만 읽는다. preview 시크릿은 plan 역할도 읽을 수 있다(배포 뒤 9-d). k8s Secret은 EKS KMS envelope encryption(`kms_key_administrators`). |
| Slack 봇 (slack-bot 네임스페이스) | 아니오 | Socket Mode, Ingress 없음(`main.tf:189-230`), `ALLOWED_USER_IDS` 5명. |
| Argo Rollouts 대시보드 · green smoke | 아니오 | promote-judge는 runner 127.0.0.1 port-forward(ADR 0011). |
| docker-compose postgres :5432 | 로컬만 | 배포 산출물 아님. |

Ingress는 FE만 켠다 — 맞게 돼 있다. 남은 문제는 FE가 BE의 **모든** `/api` 경로를 통과시키고 그 안에 `POST /api/chaos`가 있다는 점(막는 문제 1)뿐이다.

## 규제

- 데이터 보관 위치 제한: **없음**. 변경 없음. 코드가 저장하는 사용자 데이터는 방명록 닉네임 · 메시지와 투표 수뿐이고 법령이 사내 · 특정 설비 보관을 요구하는 데이터가 없다. `infra/envs/aws/variables.tf:11-14`가 `ap-northeast-2`를 validation으로 강제하므로 서울 리전 RDS가 국내 보관을 만족한다. 이번에 추가된 Cognito User Pool · Secrets Manager도 같은 리전이다(`modules/preview_auth/aws`는 provider 리전을 따른다). Identity Center(관리 계정)는 사용자 계정 정보이지 서비스 데이터가 아니다.
- 인프라가 제공해야 하는 설정(AWS, `regulated`):
  - **운영 관문**: `compliance: regulated` → platform `deploy.yml`이 prod를 GitHub environment `prod`로 보내 사람 승인을 기다린다. `CODEOWNERS:2-3`가 `config.yaml` · CODEOWNERS 변경을 코드 오너 리뷰로 보호, `checks.yml` `config-guard`(226-296행)가 yolo · AI 커밋의 `compliance` 변경을 막는다. **유지.** T31로 승인자가 green을 SSO 로그인 뒤 볼 수 있게 됐으므로(ADR 0015) "AI 판단만 보고 승인" 문제는 줄었지만, green FE가 blue BE를 호출하는 한계(배포 뒤 9-c)는 승인자가 알아야 한다.
  - **저장 데이터 암호화**: RDS `storage_encrypted = true`(모듈 캐시 `database/aws/main.tf:35`), k8s Secret KMS. **충족** — PGSSL 수정으로 이제 실제 데이터가 RDS에 들어간다(이전에는 메모리 모드라 실질 미적용이었다). ECR은 AES256(AWS-0033 LOW, KMS 아님), preview 시크릿은 Secrets Manager 기본 키(AWS-0098 LOW), 관측 로그 그룹 미암호화(AWS-0017 LOW) — 차단 기준 아래, 운영 전환 시 KMS CMK 검토.
  - **전송 구간 암호화**: 사용자↔ALB TLS **충족**. BE↔RDS `PGSSL: require` **충족**(인증서 미검증, 배포 뒤 10). oauth2-proxy↔Cognito HTTPS, oauth2-proxy↔green Service는 클러스터 내부 평문. ALB↔FE, FE↔BE 클러스터 내부 평문(VPC 안).
  - **비밀값 관리**: RDS 비밀번호 `manage_master_user_password`(Secrets Manager 생성 · 교체), oauth2-proxy 클라이언트 시크릿 · 쿠키 시크릿은 Terraform이 만들어 Secrets Manager에 넣고 External Secrets로 주입(`preview-auth.yaml` ExternalSecret, `refreshInterval: 1h`). tfstate S3 `encrypt = true` + lockfile. 앱은 `envFromSecrets` · `secretRef`로만 받는다. **충족**(단 클라이언트 시크릿이 tfstate에 남는 점은 배포 뒤 9-d).
  - **백업 보존**: RDS 자동 백업 기본 **1일**(AWS-0077 MEDIUM), `skip_final_snapshot = true`, `deletion_protection = false`(AWS-0177), single AZ. 규제 대상이면 `module "database"`에 `backup_retention_days = 7`, `skip_final_snapshot = false`(둘 다 모듈 입력으로 열려 있음). `deletion_protection`은 platform 모듈 변경 요청.
  - **접근 로그**: ALB 접근 로그 **없음**(차트 `ingressAnnotations`에 `load-balancer-attributes` 없음). **EKS 컨트롤 플레인 로그는 `audit` · `api` · `authenticator`가 켜져 있다**(모듈 캐시 `cluster.eks/variables.tf:41-44` 기본값 — 이전 "확인 못 한 것"에서 확인됨; `controllerManager` · `scheduler`만 꺼져 있어 AWS-0038 MEDIUM). VPC Flow Logs 없음(AWS-0178 MEDIUM). 파드 로그(nginx `combined` · Fastify pino `LOG_LEVEL: warn`)는 Container Insights 수집, 보존 기간은 레포에서 확인 못 함. oauth2-proxy 로그에 로그인 이메일이 남는다(승인자 식별 — 감사에는 유리, 보존 설계에 포함). 배포 감사 로그는 Object Lock S3. 규제 대상이면 ALB 접근 로그 S3 버킷과 파드 로그 보존 기간 명시를 platform에 요청한다.
  - **네트워크**: RDS private + SG 제한 **충족**. NetworkPolicy 없음(배포 뒤 8). EKS 퍼블릭 엔드포인트는 `.trivyignore` 예외.
  - **인증 · 접근 통제(신규)**: 승인자 green 접근은 Identity Center SSO(비밀번호 1요소, MFA 꺼짐). `regulated`라면 Identity Center MFA를 켜는 것이 맞다(레포 밖 설정, ADR 0001). 할당 그룹(`onetatchi-admin` 기본, ADR 0015 §4)은 관리 계정 `org/`에 있어 이 레포에서 확인 못 한다.
  - **RDS IAM 인증 없음**(AWS-0176 MEDIUM): 비밀번호 + Secrets Manager 교체로 충분. 예외 등록 안 함.
  - **삭제 · 보존**: 방명록 삭제 수단 없음(배포 뒤 3). 앱이 제공해야 한다.
- 브리프 답변과 코드 발견의 불일치:
  - "민감 데이터 **예**" ↔ 데이터 모델에 식별자 컬럼 없음(`be/src/db/schema.ts`). 해석은 "방명록 자유 텍스트에 개인정보가 들어올 수 있다"이고 그 해석으로 `regulated` 유지. `none`은 제안하지 않는다.
  - "가용성 시연용" ↔ 장애 주입은 시연 의도와 맞고 test에서는 열어 둔다. prod는 승인 환경이므로 끈다(막는 문제 1).
  - "선호 대상 AWS" ↔ `deploy.yml` 기본 `aws`로 맞춰졌다. 이전 불일치 해소.
  - `.trivyignore`: 3b0caf7 이후 **변경 없음**(AWS-0040 · 0041 · 0104, 사유 있음, 현재 구성과 일치). platform `.trivyignore@v2.2.1`에는 AWS-0132(S3 SSE-S3)가 더 있지만 이 레포 루트에는 S3 리소스가 없어 필요 없다. **새로 넣을 예외 없음** — 레포에 커밋된 IaC 기준 HIGH 이상 0건. 파이프라인 `iac-scan`은 `.terraform` 캐시가 없는 체크아웃을 검사하므로 로컬 KSV 3건은 올라가지 않는다.

## 확인 못 한 것

- **컨테이너 이미지 OS 패키지 취약점**(`node:22-alpine`, `nginxinc/nginx-unprivileged:alpine`). 로컬 빌드 · pull 금지라 미검사. 파이프라인 `image-scan`(HIGH 이상, `ignore-unfixed: true`)이 본다.
- **oauth2-proxy 이미지(`quay.io/oauth2-proxy/oauth2-proxy:v7.15.4`) 취약점** — 이 레포의 `image-dirs`는 `be` · `fe`뿐이라 **파이프라인도 검사하지 않는다**. 차트 값(`previewAuth.image`)으로 들어오는 서드파티 이미지라 platform 쪽 검사 범위에 넣을지 결정이 필요하다.
- **gitleaks** 미실행(미설치). `git grep` 패턴과 파일명 검색으로 대신했고 파이프라인 `secret-scan`이 본다.
- **Identity Center SAML 앱의 할당 그룹 · MFA 상태**, **GitHub `prod` environment의 required reviewers**, **main ruleset의 code owner review 강제**, **Container Insights 로그 보존 기간**: 전부 레포 밖(관리 계정 `org/`, GitHub, AWS 콘솔).
- **green 미리보기가 실제로 인증 뒤에만 열리는지**는 차트 템플릿(`preview-auth.yaml`, `ingress.yaml`)과 ADR로 판단했고 실환경 ALB 리스너 · 기존 preview listener 정리 여부(ADR 0011 §"기존 설치의 적용 절차" 2-3)는 확인하지 않았다. 첫 v2.2.1 배포 뒤 `kubectl get ingress -A`와 ALB 리스너 목록으로 `:8080` 잔존 여부를 본다.
- **RDS `rds.force_ssl`** 실제 값(모듈이 파라미터 그룹을 두지 않음). `PGSSL: require`로 BE가 TLS를 쓰므로 결과는 같다.
- **ALB 보안 그룹의 허용 범위**: LB Controller가 만들어 레포에 없다.
- `.deploy/report.md` · `plan.yaml`과 이 문서의 정합은 보지 않았다(요청 범위 밖).

## 가정

- **`deploy/values-fe.yaml:35-36` · `variables.tf:86`의 값은 비밀값이 아니다**: Cognito issuer URL은 User Pool ID로 OIDC discovery 문서(`/.well-known/openid-configuration`)가 공개되는 식별자, Secrets Manager ARN은 읽기에 IAM 권한이 필요한 리소스 이름, Identity Center SAML 메타데이터 URL은 SP에 나눠 주라고 만든 공개 문서(IdP 서명 인증서 · SSO URL)의 주소, 계정 ID는 이미 `variables.tf:4`에 있었다. 어느 것도 단독으로 인증을 통과시키지 못한다. gitleaks 기본 규칙에도 걸리지 않는다. 단 메타데이터 URL은 추측 불가능한 토큰을 포함하므로 레포가 공개 전환되면 IdP 설정 정보(인증서 등)가 보인다 — 공개 레포라면 변수 기본값을 비우고 레포 변수로 넘기는 편이 낫다.
- **"민감 데이터 예"는 방명록 자유 텍스트를 가리킨다**: 코드에 식별자 컬럼이 없다. 이 가정 아래 요구는 국내 보관 · 암호화 · 접근 통제 · 삭제 수단이지 사내 보관이 아니다.
- **데이터 보관 위치 "없음"**: 서울 리전 강제(`variables.tf:11-14`) 유지 전제.
- **배포 대상 AWS**: `DEPLOY_TARGET` 레포 변수가 비어도 기본값이 `aws`다(`deploy.yml:87-93`).
- **prod 승인 · Identity Center 할당이 실제로 걸려 있다**: 코드로 확인한 것은 `regulated → prod environment` 매핑과 oauth2-proxy 구성뿐이다. environment reviewer와 SAML 앱 할당이 비어 있으면 각각 승인 없이 지나가거나 아무도 로그인 못 한다(열리지는 않는다).
- **test 환경의 `CHAOS_ENABLED=true`는 수용한다**: 시연 환경이고 가용성 요구가 "시연용"이다. test의 ALB host(`yolo.onetatchi.soulee.dev`)도 인터넷에 열려 있으므로 누구나 test를 망가뜨릴 수 있지만, test는 승인 없이 재배포되고 prod 데이터와는 chaos 상태를 공유하지 않는다(파드 메모리). 단 test · prod가 같은 RDS를 쓰므로(배포 뒤 1) test에서의 `dbError`는 데이터 유실이 아니라 "test 쓰기가 DB에 안 들어감"이다.
- **`--platform=$BUILDPLATFORM` deps 스테이지가 순수 JS만 설치한다**: `be/package.json` dependencies에 네이티브 모듈이 없다는 전제(`postgres`는 순수 JS). 네이티브 의존성이 추가되면 runner 아키텍처와 불일치한다.
- **esbuild moderate는 운영 이미지에 없다**: `be/Dockerfile:25` `--prod` 전제.
- **trivy 결과 신뢰 범위**: 로컬 DB는 2026-10-10 갱신본, 대상은 lockfile · Terraform 루트(+로컬 모듈 캐시)뿐. 이미지는 파이프라인에 맡긴다. 파이프라인 `iac-scan`은 `trivyignores` 입력 없이 돌지만 trivy가 작업 디렉터리의 `.trivyignore`를 기본으로 읽는다는 전제다(이전 실행에서 AWS-0040 · 0041 · 0104가 차단되지 않은 것이 근거).
