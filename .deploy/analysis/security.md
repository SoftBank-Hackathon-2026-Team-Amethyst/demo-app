# 보안 분석

브리프(2026-10-10 갱신): 하루 100명 이하 · 월 10만 원 이하 · 민감 데이터 **예** · 선호 대상 **AWS** · 가용성 **시연용**. `.deploy/config.yaml`은 `compliance: regulated`. 이전 분석(민감 데이터 모름 · 온프레미스 선호)은 PR #44(시연 관리자 패널 · 장애 주입)와 #40(HTTP 계측) 이전 코드 기준이라, 현재 코드로 다시 확인해 새로 썼다.

조사 범위: `be/src`, `fe/src`, `fe/nginx.conf`, 두 Dockerfile · `.dockerignore`, `docker-compose.yml`, `db/init.sql`, `deploy/`, `infra/envs/aws/*.tf`, `.github/workflows/*.yml`, `.github/CODEOWNERS`, `.trivyignore`. 참조로 platform(`one-tatchi-platform` v2.1.3 체크아웃)의 App Chart · service-base 차트 · `modules/{database,cluster,cluster_addons,observability}/aws` · 재사용 워크플로를 읽었다(수정 안 함).

로컬 도구: trivy 0.75.0(취약점 DB 2026-10-10 01:03 UTC), pnpm 10.28.1. gitleaks · git-secrets 없음(설치하지 않음).

## 배포를 막는 문제

1. **인증 없는 장애 주입 API가 인터넷에 열린다** — `be/src/routes/chaos.ts:23`(`POST /api/chaos`), `chaos.ts:32`(`POST /api/chaos/reset`), `chaos.ts:18`(`GET /api/chaos`). 인증 · 토큰 · 환경 플래그가 전혀 없다. FE nginx가 `/api/`를 통째로 BE에 프록시하고(`fe/nginx.conf:23-28`) ALB가 internet-facing이므로(App Chart `ingress.yaml:17`), **인터넷의 누구나 prod에 다음을 할 수 있다**:
   - `{"errorRate":1}` → `be/src/index.ts:41-60`의 preHandler가 `/metrics` · `/api/chaos` · `/api/metrics`를 뺀 **모든 요청**(`/health` 포함)에 500을 돌려준다. readiness · liveness 경로가 `/health`(`deploy/values-be.yaml:20`)이므로 AWS replica 1(`deploy/aws/values.yaml:2`)인 BE 파드가 NotReady → 서비스 전체 중단. liveness 재시작으로 상태가 리셋되지만 재요청 한 번이면 다시 걸린다.
   - `{"latencyMs":<큰 값>}` → 상한 없음(`chaos.ts:25`는 `Math.max(0, …)`만). 모든 요청이 지연되고 Fastify 연결이 쌓인다.
   - `{"dbError":true}` → `be/src/db/index.ts:55-58`이 DB를 끊긴 것으로 보고 투표 · 방명록이 메모리 모드로 전환돼 **그 사이 쓰기가 DB에 남지 않는다**(민감 데이터 "예"와 직접 충돌).
   FE 드로어(`fe/src/App.tsx:492`, `822-`)도 버튼 한 번으로 열리고 접근 제어가 없다. 분석기 기준 "인증 없는 관리 기능"에 해당하므로 **prod 승격 전에 고친다**. 시연에 필요한 기능이므로 지우지 말고 다음 중 하나로 막는다(권장 순):
   - BE: `CHAOS_ADMIN_TOKEN` 환경변수(k8s Secret)가 없으면 chaos 라우트를 등록하지 않고, 있으면 `X-Admin-Token` 헤더 일치만 허용. FE 드로어는 토큰 입력칸을 두고 헤더로 보낸다. test에는 Secret을 넣고 prod에는 넣지 않는 식으로 환경별 제어가 된다.
   - 최소 조치(BE 수정 없이): `fe/nginx.conf`에 `location /api/chaos { return 404; }`를 추가해 외부 경로를 끊는다. 단 클러스터 안에서는 여전히 열려 있고 시연 패널이 동작하지 않는다.
   - `test` 환경에서만 쓰고 싶다면 `deploy/values-be.yaml`이 아니라 환경별 값으로 플래그를 켠다(현재 차트 호출부는 test · prod가 같은 값 파일을 쓴다 — `.github/workflows/deploy.yml:98-100`, `126-128`).

아래는 막는 기준에 걸리지 않았다.

- 비밀값 커밋: 없음. `git ls-files`와 전체 히스토리(`git log --all --diff-filter=A`)에 `.env*` · `*.pem` · `*.key` · `*.tfvars` · `*.tfstate` · credentials 파일이 한 번도 들어온 적 없다. AWS 키 · GitHub 토큰 · Slack 토큰 · 개인키 · `password=` 패턴 검색 결과 없음. 로컬 개발용 `demo/demo`(`docker-compose.yml:7-8`, `be/src/db/index.ts:5`)만 있고 운영은 `demo-app-db` Secret이 덮어쓴다. `.gitignore:23-25`가 `.env`를 막는다. 파이프라인 `secret-scan`(gitleaks v8.24.3)이 다시 본다.
- HIGH 이상 취약점: `trivy fs --scanners vuln` 결과 `be/pnpm-lock.yaml` 0건, `fe/pnpm-lock.yaml` 0건(전체 심각도 기준으로도 0건). `pnpm audit`: fe 0건, be moderate 2건(esbuild ≤0.24.2, GHSA-67mh-4wv8-2f99, `drizzle-kit` devDependency 경로) — `be/Dockerfile:25`가 `--prod`라 운영 이미지에 없다.
- 컨테이너 이미지 · IaC misconfig HIGH 이상: `trivy config infra/envs/aws` HIGH · CRITICAL 0건(`.trivyignore` 적용 후). MEDIUM 3건은 "규제" 절에 적었다. 두 Dockerfile은 `DS-0026`(LOW, FE HEALTHCHECK 없음)뿐이며 k8s probe가 대신한다. 이미지 OS 패키지는 로컬에서 빌드하지 않아 미검사("확인 못 한 것").

## 배포 뒤 고칠 문제

우선순위 순. 1 · 2는 prod 승격 전에 끝내는 것이 맞다.

1. **BE→RDS TLS 미적용으로 AWS에서 BE가 메모리 모드로 돈다** — `be/src/db/index.ts:25-29`는 `ssl` 옵션 없이 접속하고, Secret `demo-app-db`의 `DATABASE_URL`(service-base `database-secret.yaml:18`)에는 `sslmode`가 없다. postgres.js는 `PGSSL` 환경변수를 읽지 않는다. RDS Postgres 17은 TLS 없는 접속을 거부하므로 기동 시 `initDb()`가 실패하고 `index.ts:36-39`에서 조용히 메모리 모드로 간다. platform 커밋 `9432992`(T28)와 이 레포 브랜치 `t28-db-tls`(커밋 `321ce8b`, **main 미머지**)가 같은 현상을 기록했다. 결과: AWS test · prod의 투표 · 방명록이 파드 메모리에만 있고 파드 재시작 때 사라지며, RDS 암호화 · 백업이 실제 데이터에 적용되지 않는다. `/health`는 여전히 200 `fallback-memory`라 smoke(`.deploy/smoke.json`)가 통과한다. 수정: `t28-db-tls` 머지(`PGSSL` → `ssl` 옵션, `deploy/values-be.yaml`에 `PGSSL: require`). platform 다음 버전의 `check-artifacts.sh`는 `env.PGSSL`이 없으면 provision 검사를 실패시킨다. `require`는 인증서를 검증하지 않으므로(postgres.js `ssl: 'require'` = rejectUnauthorized 없음) VPC 안이라 허용하되, 규제 수준을 올리려면 RDS CA 번들과 `verify-full`로 간다.
2. **DB 실패를 숨기는 health** — `be/src/routes/health.ts:6-14`가 DB 단절 시에도 `status: ok` 200. 1번과 결합해 배포 파이프라인이 DB 오류를 감지하지 못한다. 운영 프로파일에서는 `database: fallback-memory`면 503을 돌려주거나(readiness 실패), `DB_FALLBACK=false` 같은 환경변수로 fallback 자체를 끈다. README(`README.md:15,52`)가 fallback을 데모 의도로 명시했으므로 "운영 전환 시 결정 항목"으로 둔다.
3. **쓰기 API 속도 제한 없음** — `POST /api/votes/:id`(`votes.ts:26`), `POST /api/guestbook`(`guestbook.ts:32`). 1인 1투표는 FE localStorage뿐(`votes.ts:6`). FE의 "트래픽 부하 생성기"(`fe/src/App.tsx:338-349`)는 브라우저가 `/api/votes`를 초당 최대 60회 보내는 클라이언트 코드라 서버 측 관리 기능은 아니지만, 누구나 같은 일을 할 수 있다는 뜻이다. `@fastify/rate-limit`(IP당 분당 N회)을 BE에 붙이거나 ALB WAF rate-based rule을 둔다. 방명록은 500자 · 50자로 서버가 자르므로(`guestbook.ts:42-43`) 행 크기는 제한되나 행 수는 무제한이다.
4. **방명록에 삭제 · 보존 기간 기능이 없음** — 스키마(`be/src/db/schema.ts:11-16`)에 식별자 컬럼은 없지만 `message`는 자유 텍스트라 사용자가 실명 · 연락처를 적을 수 있고, 지울 API가 없다. 민감 데이터 "예"라면 삭제 수단(관리자용 DELETE, 또는 N일 후 삭제 크론)과 입력칸 안내 문구("개인정보를 적지 마세요")가 필요하다. 규제 절에서 다시 다룬다.
5. **운영 정보 노출** — `/api/info`(`be/src/routes/meta.ts:6-22`): 파드 호스트명 · env · 리전 · DB 연결 상태. `/api/metrics`(`be/src/routes/metrics.ts:47-71`): 호스트명 · CPU · 메모리 · load. `/health`도 `fe/nginx.conf:30-34`로 외부에 프록시된다. 모두 시연 화면이 쓰는 값이라 의도된 노출이지만, 운영에서는 `hostname` · `region`을 빼고 `/health` 프록시를 지운다.
6. **CORS 전체 허용** — `be/src/index.ts:28-31` `origin: true`(요청 Origin 반사). FE nginx가 같은 오리진에서 프록시하므로 운영에서는 CORS 플러그인이 필요 없다. 쿠키 · 인증이 없어 지금 위험은 낮지만 1번 토큰 헤더를 넣으면 CORS 범위가 의미를 갖는다. 허용 오리진을 환경변수로 제한하거나 플러그인을 뺀다.
7. **FE `dependencies`에 정체 불명 패키지 `dev`** — `fe/package.json:14` `"dev": "^0.1.5"`. `fe/src`에서 import하지 않고, lockfile(`fe/pnpm-lock.yaml:597-599, 1303-1305`)상 `hasBin: true`에 `inotify`(네이티브)를 끌어온다. 오타로 들어간 것으로 보인다. 런타임 이미지(nginx)에는 들어가지 않지만 빌드 스테이지에서 설치 · 실행되므로 공급망 표면이다. 제거한다.
8. **nginx 보안 헤더 없음** — `fe/nginx.conf`에 `X-Content-Type-Options`, `Referrer-Policy`, `Content-Security-Policy`, `Permissions-Policy`가 없다. React 이스케이프로 XSS 경로는 없으나 기본 헤더는 넣는다. ALB는 HSTS를 넣지 않으므로 `Strict-Transport-Security`도 nginx에서 넣는다.
9. **네임스페이스 간 NetworkPolicy 없음** — App Chart 템플릿에 NetworkPolicy가 없다(`charts/app/templates/`). `test` 네임스페이스의 파드가 `demo-app-be.prod.svc:8000`에 직접 붙어 `/api/chaos`를 포함한 모든 BE 경로를 호출할 수 있다. 1번을 토큰으로 막으면 위험은 낮아지지만, 규제 대상이면 네임스페이스 ingress를 FE→BE로 제한한다(platform 차트 변경 요청).
10. **test와 prod가 같은 RDS 데이터베이스 `demo`를 쓴다** — `infra/envs/aws/main.tf:152-174`가 두 네임스페이스에 같은 host · DB 이름을 넘긴다. test에서 쓴 방명록이 prod 화면에 보이고, 반대로 prod 데이터가 test 환경(승인 없이 배포되는 환경)에서 읽히고 지워질 수 있다. 민감 데이터 "예"라면 분리가 맞다. 비용을 고려하면 같은 인스턴스에 DB 이름만 나누는 것이 현실적인데 모듈이 `database_name` 하나만 받으므로 platform 변경이 필요하다. 그 전까지는 test 쓰기 smoke를 넣지 않는다(지금 `.deploy/smoke.json`은 400 검증만 한다 — 유지).
11. **GitHub Actions 참조 고정 수준** — 재사용 워크플로는 같은 조직의 태그(`@v2.1.3`)를 쓰고 `secrets: inherit`로 레포 비밀값 전부를 넘긴다(`deploy.yml:68,106,132`). `template-update.yml:23`은 `@v1` 유동 태그. 외부 액션(`actions/checkout@v7`, `dorny/paths-filter@v3`)은 SHA 고정이 아니다. 같은 조직 태그는 수용 가능하나, 외부 액션은 SHA로 고정한다.
12. 이전 분석의 1번(lockfile fallback) · 7번(`.dockerignore` 없음)은 **해결됐다**: `be/Dockerfile:10,25`, `fe/Dockerfile:9`가 `--frozen-lockfile`만 쓰고, `be/.dockerignore` · `fe/.dockerignore`가 `node_modules` · `.env*` · `dist`를 뺀다. 이미지 하드닝(BE 런타임에서 npm · corepack · yarn 제거 `be/Dockerfile:31-33`, UID 1000; FE `nginx-unprivileged` UID 101, `tiff` 업그레이드)과 App Chart 보안 컨텍스트(`_helpers.tpl:33-39` `runAsNonRoot` · `readOnlyRootFilesystem` · `drop ALL` · `allowPrivilegeEscalation: false`, `rollout.yaml:37` `automountServiceAccountToken: false`, seccomp `RuntimeDefault`)도 유지되고 있다.

## 노출

AWS 기준. 온프레미스(Quick Tunnel) 구성은 레포에 남아 있지만 브리프 선호 대상이 AWS이므로 이번 분석의 기준이 아니다.

| 서비스 | 외부 노출 | 이유 |
|---|---|---|
| ALB → demo-app-fe (nginx :3000) | **예** (HTTPS 443, 80→443 리다이렉트) | 유일한 진입점. `deploy/values-fe.yaml:25-26` `ingress.enabled: true`, `deploy.yml:95,123`가 host(`yolo.onetatchi.soulee.dev` test, `onetatchi.soulee.dev` prod)를 넘겨 ACM 인증서 · `ELBSecurityPolicy-TLS13-1-2-2021-06`. 같은 ALB에 `ingress-group`별 test · prod가 따로 올라간다. WAF · ALB 접근 로그 없음. |
| ALB → demo-app-fe-preview (green) :8080 | **예** (HTTPS 8080, 승격 전 잠깐) | Blue-Green 미리보기(App Chart `ingress.yaml:4-6,27`, `previewPort: 8080`). 승격 전 새 버전이 인터넷에서 보인다. 접근 제어 없음. 시연용이면 허용, 아니면 ALB 보안 그룹에서 8080을 팀 IP로 제한한다. |
| demo-app-be (Fastify :8000) — `/api/*`, `/health` | **예 (FE 경유)** | 직접 Ingress 없음(`deploy/values-be.yaml`에 ingress 키 없음 → 차트 기본 `enabled: false`). 하지만 `fe/nginx.conf:23-34`가 `/api/` 전체와 `/health`를 프록시하므로 `/api/votes` · `/api/guestbook` · `/api/info` · `/api/metrics` · **`/api/chaos`**가 모두 인터넷에서 닿는다. 외부에서 안 닿는 BE 경로는 `/metrics`(Prometheus)와 `/healthz/liveness`뿐. |
| demo-app-be `/metrics`, FE 사이드카 :4040 | 아니오 | nginx가 프록시하지 않음. 클러스터 안 Prometheus 수집 전용. |
| RDS PostgreSQL 17 | 아니오 | private subnet(`infra/envs/aws/main.tf:123`), `publicly_accessible = false`, 보안 그룹은 EKS 노드 SG만 5432 허용(`main.tf:124`, 모듈 `database/aws/main.tf:11-20`). |
| EKS API 엔드포인트 | **예** (IAM 인증) | `modules/cluster/aws/main.tf:37` `endpoint_public_access = true`, CIDR 제한 없음. 인증은 IAM access entry(팀 SSO 관리자 · CI 역할)뿐. `.trivyignore`의 AWS-0040 · AWS-0041 예외(GitHub hosted runner용). |
| Secrets Manager (RDS 자격증명, Slack 봇) | 아니오 | External Secrets가 `readable_secret_arns`(`main.tf:133`) 두 개만 읽어 네임스페이스 Secret으로 만든다. k8s Secret은 EKS KMS envelope encryption(모듈 `kms_key_administrators`). |
| Slack 봇 (slack-bot 네임스페이스) | 아니오 | Socket Mode, Ingress 없음(`main.tf:176`). 클러스터 권한 없음, `ALLOWED_USER_IDS` 5명으로 제한. |
| Argo Rollouts 대시보드 | 아니오 | 포트 포워드만. |
| docker-compose postgres :5432 | 로컬만 | 배포 산출물 아님. |

Ingress는 FE만 켠다 — 맞게 돼 있다. 문제는 FE가 BE의 **모든** `/api` 경로를 그대로 통과시킨다는 점이고, 그 안에 관리 기능(`/api/chaos`)이 있다.

## 규제

- 데이터 보관 위치 제한: **없음**. 서비스 분석과 같은 판단이다. 코드가 저장하는 사용자 데이터는 방명록 닉네임 · 메시지와 투표 수뿐이고 금융 · 공공 · 의료처럼 법령이 사내 또는 특정 설비 보관을 요구하는 데이터가 없다. "예"를 가장 엄격하게 "방명록 자유 텍스트에 개인정보가 들어온다"로 읽어도 요구는 국내 보관 · 암호화 · 접근 통제이며, `infra/envs/aws/variables.tf:11-14`가 `ap-northeast-2`를 validation으로 강제하므로 서울 리전 RDS가 국내 보관을 만족한다. 사용자가 온프레미스 선호를 거뒀으므로 "데이터만 사내"로 올릴 근거가 없다.
- 인프라가 제공해야 하는 설정(AWS, `regulated`):
  - **운영 관문**: `compliance: regulated` → platform `deploy.yml:121-137`이 prod 배포를 GitHub environment `prod`로 보내 사람 승인을 기다린다. `config.yaml`과 `CODEOWNERS`는 코드 오너 리뷰 보호(`.github/CODEOWNERS:2-3`), `checks.yml` `config-guard`가 AI 커밋의 `compliance` 변경을 막는다. **유지한다.** `prod` environment에 required reviewers가 실제로 걸려 있는지는 GitHub 설정이라 레포에서 확인 못 한다.
  - **저장 데이터 암호화**: RDS `storage_encrypted = true`(모듈 `database/aws/main.tf:35`), EBS CSI gp3 암호화(README). k8s Secret은 KMS. **충족** — 단 "배포 뒤 1번"이 고쳐지기 전에는 데이터가 RDS에 안 들어가므로 실질적으로 적용되지 않는다.
  - **전송 구간 암호화**: 사용자↔ALB TLS 1.3 정책 **충족**. ALB↔FE, FE↔BE는 클러스터 내부 평문(VPC 안, 노드 간). BE↔RDS는 **미충족**(배포 뒤 1번, `t28-db-tls` 머지로 해결).
  - **비밀값 관리**: RDS 비밀번호는 `manage_master_user_password = true`로 Secrets Manager가 만들고 교체하며 tfstate에 평문이 남지 않는다(`database/aws/main.tf:31`). tfstate는 S3 `encrypt = true` + lockfile(`main.tf:17-22`). 앱은 `envFromSecrets`로만 받는다. **충족.**
  - **백업 보존**: RDS 자동 백업 `backup_retention_days` 기본 **1일**(모듈 변수, trivy AWS-0077 MEDIUM), `skip_final_snapshot = true`, `deletion_protection = false`(모듈 하드코딩, AWS-0177), single AZ. 규제 대상이면 `infra/envs/aws/main.tf`의 `module "database"`에 `backup_retention_days = 7`, `skip_final_snapshot = false`를 넣는다(둘 다 모듈 입력으로 열려 있고 비용 영향은 스냅샷 용량 수준). `deletion_protection`은 platform 모듈 변경 요청.
  - **접근 로그**: ALB 접근 로그 **없음**(차트 `ingress.yaml`에 `load-balancer-attributes` 주석 없음). 파드 로그(nginx `combined` 접근 로그 · Fastify pino)는 CloudWatch Container Insights 애드온(`modules/observability/aws/main.tf:1-12`)이 수집한다 — 보존 기간은 애드온 기본 로그 그룹 설정에 따르며 레포에서 확인 못 함. AI 판단 근거 로그 그룹은 14일(`observability/aws/metrics.tf:4`). 배포 감사 로그는 Object Lock S3(`deploy.yml:429`). EKS 컨트롤 플레인 로그(`audit` 등)는 모듈 기본값에 의존(명시 없음). 규제 대상이면 ALB 접근 로그 S3 버킷 추가와 파드 로그 보존 기간 명시를 platform에 요청한다. nginx `combined` 로그에 클라이언트 IP가 남는다는 점(개인정보로 볼 수 있음)도 보존 기간 설계에 포함한다.
  - **네트워크**: RDS private + SG 제한 **충족**. NetworkPolicy 없음(배포 뒤 9번). EKS 퍼블릭 엔드포인트는 `.trivyignore` 예외로 근거가 있으나 규제 수준을 올리려면 `public_access_cidrs`를 GitHub runner 대역 또는 팀 IP로 좁힌다.
  - **RDS IAM 인증 없음**(AWS-0176 MEDIUM): 비밀번호 인증 + Secrets Manager 교체로 충분하다. 예외 등록은 하지 않는다(MEDIUM은 차단 기준 아님).
  - **삭제 · 보존**: 방명록 삭제 수단 없음(배포 뒤 4번). 개인정보가 들어올 수 있는 저장소에 삭제 경로가 없는 점은 인프라가 아니라 앱이 제공해야 한다.
- 브리프 답변과 코드 발견의 불일치:
  - 브리프 "민감 데이터 **예**" ↔ 코드의 데이터 모델에는 로그인 · 이메일 · 전화 · 결제 · 주민번호 컬럼이 없다(`be/src/db/schema.ts`, `db/init.sql`). 가장 그럴듯한 해석은 "방명록 자유 텍스트에 개인정보가 들어올 수 있다"이고, 그 해석으로 `regulated`를 유지한다. `none`은 제안하지 않는다. 사용자에게 확인할 질문은 하나다: "방명록 입력을 개인정보로 볼 것인가(그렇다면 삭제 · 보존 기간 기능이 필요하다)".
  - 브리프 "가용성 시연용" ↔ 코드의 장애 주입 기능은 시연 의도와 맞지만, `regulated` prod에 인증 없이 열린 점은 가용성 요구와 무관하게 막는다(배포를 막는 문제 1).
  - 브리프 "선호 대상 AWS" ↔ `deploy.yml:8,90`의 `DEPLOY_TARGET` 기본값은 `onprem`이고 레포 변수로 `aws`를 고른다(`.deploy/log/20261010-t8-cycle.md:6`). 레포 변수가 지워지면 조용히 온프레미스로 간다. 보안 문제는 아니지만 산출물 단계에서 기본값을 `aws`로 맞추는 편이 안전하다.
  - `.trivyignore`: AWS-0040 · AWS-0041(EKS 퍼블릭 API, GitHub hosted runner용) · AWS-0104(노드 egress) 세 항목 모두 사유가 적혀 있고 현재 구성과 일치한다. **새로 넣을 예외 없음**(HIGH 이상 0건). 이번에 나온 MEDIUM 3건(AWS-0077 · 0176 · 0177)은 차단 기준 아래라 예외 등록 대상이 아니고, 0077 · 0177은 설정으로 고치는 쪽이 맞다.

## 확인 못 한 것

- **컨테이너 이미지 OS 패키지 취약점**(`node:22-alpine`, `nginxinc/nginx-unprivileged:alpine`). 로컬에서 이미지를 빌드하거나 당기지 않았다. 파이프라인 `image-scan`(HIGH 이상 차단, `.trivyignore` 적용)이 검사한다.
- **gitleaks**를 로컬에서 돌리지 않았다(미설치, 설치하지 않음). `git grep` 패턴 검색과 히스토리 파일명 검색으로 대신했고 파이프라인 `secret-scan`이 다시 본다.
- **AWS BE 메모리 모드 현상**(배포 뒤 1번)을 직접 재현하지 않았다. platform 커밋 `9432992`와 이 레포 `t28-db-tls` 커밋 메시지("AWS test · prod BE가 메모리 폴백으로 돌았다")를 근거로 썼다. 실기동 `/health`의 `database` 값으로 확인할 수 있다.
- **RDS `rds.force_ssl` 실제 값**. 모듈이 파라미터 그룹을 두지 않아 RDS 기본값(Postgres 15+ 기본 1)에 의존한다. 위 현상이 그 결과로 보이지만 콘솔 확인이 필요하다.
- **EKS 컨트롤 플레인 로그 종류 · k8s Secret KMS 암호화**: `terraform-aws-modules/eks` v21 기본값에 의존하며 레포에 명시가 없다. 모듈 캐시가 로컬에 없어 기본값을 코드로 확인하지 못했다.
- **Container Insights 로그 그룹 보존 기간**, **GitHub `prod` environment의 required reviewers**, **main ruleset의 code owner review 강제**: 전부 AWS 콘솔 · GitHub 설정이라 레포 밖이다.
- **ALB 보안 그룹의 8080(preview) 허용 범위**: LB Controller가 만드는 SG라 레포에 없다.
- 서비스 분석의 `DATABASE_URL` 스킴(`postgresql+psycopg://`)을 postgres.js가 받는지는 코드베이스 분석이 "호스트 · 자격증명만 읽어 접속된다"고 판단했고 여기서는 재검증하지 않았다(1번이 고쳐지면 `PGSSL`로 TLS가 켜지므로 스킴 문제와 독립).

## 가정

- **"민감 데이터 예"는 방명록 자유 텍스트를 가리킨다**: 코드에 식별자 컬럼이 없으므로 이 해석이 가장 그럴듯하다. 이 가정 아래 요구는 국내 보관 · 암호화 · 접근 통제 · 삭제 수단이지 사내 보관이 아니다. 사용자가 다른 데이터(예: 앞으로 추가할 로그인 · 결제)를 뜻한다면 "데이터 보관 위치 제한"과 요구 설정을 다시 본다.
- **데이터 보관 위치 "없음"**: 서울 리전 강제(`variables.tf:11-14`)가 유지된다는 전제. 리전 validation을 풀면 이 판단도 무효다.
- **배포 대상 AWS**: 레포 변수 `DEPLOY_TARGET=aws`가 유지된다는 전제. 온프레미스 경로의 노출(Quick Tunnel, 접근 제어 없음)은 이번 표에 넣지 않았다.
- **prod 승인이 실제로 걸려 있다**: `compliance: regulated` → `prod` environment 매핑은 코드로 확인했지만 environment의 reviewer 설정은 GitHub 쪽이다. 설정이 비어 있으면 승인 없이 지나간다.
- **운영에서 로컬 기본 비밀번호가 쓰이지 않는다**: `envFromSecrets: [demo-app-db]`가 `DATABASE_URL`을 덮어쓴다는 전제. Secret 생성이 실패하면 fallback 때문에 localhost 접속 실패 → 메모리 모드로 조용히 가는 점은 배포 뒤 2번에 적었다.
- **esbuild moderate는 운영 이미지에 없다**: `be/Dockerfile:25` `--prod`가 devDependency를 제외한다는 전제.
- **`/api/chaos`를 막는 방법은 토큰 헤더**를 권했지만, 시연 운영 방식(누가 패널을 여는지)에 따라 nginx 경로 차단 + 포트 포워드로 바꿀 수 있다. 어느 쪽이든 "인증 없이 인터넷에서 호출 가능" 상태만 벗어나면 막는 기준은 해소된다.
- **trivy 결과 신뢰 범위**: 로컬 DB는 2026-10-10 갱신본이고 lockfile · Terraform 루트만 대상이다. 이미지 OS 패키지는 파이프라인에 맡긴다.
