# 보안 분석

분석일: 2026-10-11 (yolo 재검증, 기준 커밋 55b1586 = origin/main)

브리프(2026-10-10): 하루 100명 이하 · 월 10만 원 이하 · 민감 데이터 **예** · 선호 대상 **AWS** · 가용성 **시연용**. `.deploy/config.yaml`은 `compliance: regulated`, `template_version: v2.17.0`, `infra_versions.aws: v2.11.0` · `gcp: v1.16.2`. 호출부(`.github/workflows/*.yml`) · infra 모듈 참조도 v2.17.0으로 맞다(cluster · cluster_addons · observability는 명시 고정 v2.11.0 · v1.16.2).

이 문서는 2026-10-11 02:54 재검증(기준 b0d3df7)의 **델타 재검증**이다. `git diff b0d3df7 HEAD -- be/src fe/src fe/nginx* fe/Dockerfile be/Dockerfile deploy infra .github`로 확인한 변경: **T25 CPU 부하 테스트 API**(`be/src/routes/load.ts`, `be/src/load/cpu-pool.ts` · `cpu-worker.ts`, `fe/src/CpuLoadPanel.tsx`, `deploy/values-be.yaml` `LOAD_TEST_ENABLED`, #106), **T38 gcp green 미리보기**(`deploy/gcp/values.yaml` previewAuth, `infra/envs/gcp` 고정 IP · 시크릿, `infra/envs/aws` Cognito 콜백 · Route53, #97 · #98 · #101), **T39 배포 대상 matrix**(`.github/scripts/deploy-targets.sh`, `deploy.yml` targets job, #107 · #108 · #109), T33 onprem-wsl 대상(#105), T22 template-update push 트리거(#96), 템플릿 v2.13.1 → v2.17.0(#94 · #104). `fe/nginx.conf` · `fe/Dockerfile` · `be/Dockerfile` · `db/` · `docker-compose.yml` · `.trivyignore` · lockfile 2개는 **변경 없음**. 작업 트리에는 이번 yolo push의 미커밋 변경 `deploy/values-be.yaml:28` `APP_VERSION v2.1.0 → v2.1.1`만 있다(보안 영향 없음, `LOAD_TEST_ENABLED`는 그대로 `"true"`).

조사 범위: 위 diff 전체, `be/src/*`, `be/tests/load.test.ts`, `fe/src/CpuLoadPanel.tsx`, `fe/nginx.conf`, `deploy/*`, `infra/envs/{aws,gcp,onprem}/*.tf`, `.github/workflows/*.yml`, `.github/scripts/deploy-targets.sh`, `.github/CODEOWNERS`, `.trivyignore`, `.deploy/smoke.json`. 참조로 platform 저장소(`git -C … show v2.17.0:…`로 태그 내용만 읽음)의 `deploy.yml` · `checks.yml` · App Chart `values.yaml` · `migration-job.yaml`, 그리고 `gh run list/view`로 main 배포 실행 결과를 봤다. 수정한 것은 이 파일뿐이다.

로컬 도구: trivy 0.75.0(`trivy fs` lockfile, `trivy config` infra · Dockerfile), `pnpm audit`(be · fe), `npm audit --package-lock-only`(`.github/tests`). gitleaks · osv-scanner 없음(설치하지 않음).

## 배포를 막는 문제

**보안 기준(비밀값 커밋 · HIGH 이상 취약점 · 인증 없는 관리 기능)으로 test 배포를 막는 문제: 없음. prod 승격 전 조치: 없음(권고 1건은 "배포 뒤 고칠 문제" 1).**

이전 분석의 막는 문제 2건은 둘 다 해소됐다.

1. **[해소 유지] prod의 인증 없는 장애 주입 API** — `CHAOS_ENABLED`는 여전히 `deploy/values-be.test.yaml:5`에만 있고 `deploy/values-be.yaml`에는 없다. `be/src/routes/chaos.ts:34-37`에 따라 prod에는 `POST /api/chaos` · `/reset`이 등록되지 않는다. platform `deploy.yml@v2.17.0`의 값 파일 합치기 순서(`values-be.yaml → deploy/<대상>/values.yaml → values-be.<environment>.yaml`)는 그대로다.
2. **[해소] T33 NetworkPolicy가 test 마이그레이션 Job을 막는 문제** — 이전 분석의 추정이 실제로 발생했고(run 38070479286, `infra/envs/aws/main.tf:274-276` 주석) PR #90이 `allow_from`에 `{ "batch.kubernetes.io/job-name" = "demo-app-be-migration" }`를 더했다(`main.tf:277-280`). 그 뒤 test · prod 배포가 돌았다(아래 T25 실행). App Chart v2.17.0 `migration-job.yaml`은 여전히 Job 파드에 라벨을 붙이지 않으므로 이 레포 쪽 우회가 계속 필요하다.

**T25 CPU 부하 API를 막는 문제로 분류하지 않은 이유.** `POST /api/load/cpu`는 인증이 없고 prod에도 켜져 있지만(배포 뒤 1에 상세), (a) 서버 상태 · 설정 · 데이터를 바꾸지 않는다 — "관리 기능"이 아니라 자원 소모 기능이다, (b) 피해 상한이 코드로 묶여 있다 — 파드당 워커 스레드 1개 · 대기열 8 · 요청 데드라인 2초(`be/src/load/cpu-pool.ts:23,27-29,33-40`), HPA 최대 6 파드, 노드 최대 5대, (c) 비밀값 · HIGH 취약점 기준에 해당하지 않는다, (d) prod 켜기는 코드 주석(`be/src/routes/load.ts:12`) · 값 파일 주석(`deploy/values-be.yaml:29`)에 적힌 의도된 결정이고 PR #106과 prod 승인(run 38105887347 `approve` · `deploy` 성공)을 이미 거쳤다. 다만 `regulated` · 월 10만 원 예산과는 맞지 않는 **비용 · 가용성 DoS 증폭 경로**이므로 다음 prod 승격 전에 고치기를 권고한다.

아래는 막는 기준에 걸리지 않았다.

- 비밀값 커밋: 없음. `git ls-files`에 `.env*` · `*.pem` · `*.key` · `*.tfstate` 없음. `*.auto.tfvars` 2개는 이전과 같은 식별자뿐. **새로 커밋된 값** — `infra/envs/aws/variables.tf:109-114` gcp 미리보기 고정 IP 2개, `:98-105` 호스트 이름, `:116-119` Identity Center SAML 메타데이터 URL(이전부터), `infra/envs/gcp/main.tf:151-153` 시크릿 **이름**만. oauth2-proxy 클라이언트 값은 사람이 CLI로 AWS Secrets Manager → GCP Secret Manager로 복사한다(`infra/envs/gcp/README.md` 2단계, 파일에 남기지 않음). `secret|password|token = "<긴 문자열>"` 패턴 `git grep` 0건. 파이프라인 `secret-scan`(gitleaks v8.24.3) 55b1586 실행 성공(run 38106242915).
- HIGH 이상 취약점: `trivy fs --scanners vuln` `be/pnpm-lock.yaml` 0건, `fe/pnpm-lock.yaml` 0건(lockfile 변경 없음). `pnpm --dir be audit`: **moderate 2건** — esbuild ≤0.24.2(GHSA-67mh-4wv8-2f99, 개발 서버 CORS) via `drizzle-kit`, **devDependencies**이고 런타임 이미지는 `pnpm install --prod`(`be/Dockerfile:25`)라 포함되지 않는다. 차단 기준(HIGH) 미만이고 `.trivyignore` 예외도 필요 없다. `pnpm --dir fe audit`(`--dev` 포함) 0건. `.github/tests/package-lock.json` `npm audit` 0건(이전 "확인 못 한 것" 해소). 파이프라인 `vuln-scan` · `image-scan (be|fe)` 성공.
- IaC misconfig HIGH 이상: `trivy config infra` HIGH 0건. MEDIUM은 이전과 같은 AWS-0077 · 0176 · 0177(RDS 모듈 v2.11.0)과 GCP-0014 · 0020 · 0025(Cloud SQL 모듈 v1.16.2). LOW: AWS-0017 · 0033 · 0098 · 0099 · 0124 · 0133, GCP-0021 · 0051. Dockerfile: BE 0건, FE `DS-0026`(LOW, HEALTHCHECK 없음) 그대로. 파이프라인 `iac-scan` 성공.
- 인증 없는 관리 기능: 없음. prod `POST /api/chaos` 닫힘(1). `POST /api/load/cpu`는 위 분류 근거대로 배포 뒤 1. green 미리보기 BE 경로(`previewAuth.routes`)는 oauth2-proxy 뒤.

## 배포 뒤 고칠 문제

우선순위 순. 이전 분석의 막는 문제 2(마이그레이션 Job)는 **해결**, 이전 배포 뒤 1(값 파일 위치 규약)은 T25에서 **실제로 재현됐다**(2번).

1. **[새로 발견 · prod 승격 전 권고] prod에 인증 없는 CPU 소모 API가 인터넷에 열려 있다 — DoS · 비용 증폭 경로.**
   - 경로: `deploy/values-be.yaml:29-30` `LOAD_TEST_ENABLED: "true"`는 **공통 값 파일**이라 test · prod 모두에 적용된다(`CHAOS_ENABLED`를 `values-be.test.yaml`로 분리한 T35 규약과 반대). `be/src/routes/load.ts:11-13`이 `NODE_ENV`와 무관하게 이 플래그만 보고, `:22-33` `POST /api/load/cpu`에 인증 · 호출자 제한이 없다. FE nginx가 `/api/`를 BE로 프록시하므로(`fe/nginx.conf:23-28`) `https://onetatchi.soulee.dev/api/load/cpu`가 누구에게나 열린다. T25는 이미 prod 승인 · 배포를 거쳤다(run 38105887347, cfd53e3).
   - **서버 쪽 속도 제한은 없다.** `maxRps: 20`은 `GET /api/load/config`가 **클라이언트에 알려주는 값**일 뿐이고(`load.ts:16`) FE만 이를 지킨다(`fe/src/CpuLoadPanel.tsx:40,100`). curl · 스크립트는 제한 없이 보낼 수 있다. 실제 서버 상한은 `CpuPool`의 대기열 8 초과 → 429, 요청당 2초 데드라인, 파드당 워커 스레드 1개(`cpu-pool.ts:23,27-29`) — 즉 이벤트 루프는 보호되지만(`be/tests/load.test.ts:46-57`) **워커 한 개가 코어 하나를 계속 태우는 것은 막지 못한다**. 로컬 측정(이 맥, `createHash('sha256')` 반복)으로 `heavy` 30,000회 ≈ 17ms · `medium` ≈ 12ms · `light` ≈ 5ms. t3.medium(`infra/envs/aws/main.tf:88`)은 몇 배 느릴 것으로 보여("가정") 클라이언트 하나가 파드당 10~20 req/s만 보내도 워커를 100%로 유지할 수 있다.
   - **증폭**: `resources.requests.cpu: 100m`에 **CPU limit 없음**(`deploy/values-be.yaml:14-19`, App Chart v2.17.0 기본값도 같음) → 워커가 코어 하나를 다 쓰면 HPA(`targetCPUUtilizationPercentage: 70`, 분모 100m)가 즉시 2 → 6 파드로 올리고(`:8-12`) Cluster Autoscaler가 노드를 3 → 5대까지 늘린다(`main.tf:89`). 파드가 늘수록 워커가 늘어 공격자가 태울 수 있는 CPU도 는다. 상한은 코어 6개 + t3.medium 2대 추가(비용), 그리고 test · prod가 같은 노드를 공유하고 CPU limit이 없어 같은 노드의 prod FE · 다른 파드가 CFS share(요청량 비례)만으로 경쟁한다(가용성). 데이터 영향은 없다.
   - 부수 경로: CORS `origin: true`(`be/src/index.ts:29-32`)라 제3자 웹페이지가 방문자 브라우저로 `POST /api/load/cpu`를 보낼 수 있다(preflight 통과) — 브라우저 분산 증폭. `LOG_LEVEL: warn`(`values-be.yaml:35`)이라 BE 로그에는 호출이 남지 않고, nginx `combined` 로그(`fe/nginx.conf:13`)에만 IP가 남는다. ALB 접근 로그 · WAF는 없다. `/api/load/`는 chaos preHandler에서 제외돼(`index.ts:44-46`) 장애 주입으로도 이 경로를 막을 수 없다.
   - 고치는 방법(하나 이상): (a) `LOAD_TEST_ENABLED`를 `deploy/values-be.test.yaml`로 옮긴다 — T35와 같은 규약, prod 시연에 CPU 부하가 필요 없다면 이것이 맞다. (b) prod에서도 써야 하면 서버 쪽 제한을 넣는다 — `@fastify/rate-limit`(IP당) 또는 ALB WAF rate-based rule, 그리고 `resources.limits.cpu`(예 500m)로 파드당 소모 상한을 둔다. (c) 승인자만 쓰게 하려면 green 미리보기의 oauth2-proxy 경로(`previewAuth.routes`)로만 열고 active BE에서는 끈다. `.deploy/smoke.json`에는 `/api/load/*` 검사가 없으므로 (a)로 꺼도 승격 smoke는 깨지지 않는다.
2. **prod 전용 통제가 "값 파일 위치 규약"에만 기댄다 — T25가 그 약점을 그대로 드러냈다.** `deploy/values-be.yaml`은 CODEOWNERS 보호 파일이 아니고(`.github/CODEOWNERS`: `config.yaml` · CODEOWNERS만) platform `checks.yml@v2.17.0`에는 공통 값 파일의 `CHAOS_` · `LOAD_TEST_` 같은 플래그를 막는 검사가 없다(`git grep` 0건). `CHAOS_ENABLED`는 규약대로 test 파일에 갔지만 `LOAD_TEST_ENABLED`는 공통 파일에 들어갔고, 승인자가 diff에서 잡지 않았다(또는 의도로 승인했다). platform `checks.yml`에 "공통 값 파일의 시연 플래그" 검사를 넣는 것이 맞다(platform 요청). `deploy/values-*.yaml`을 CODEOWNERS에 넣는 방법은 yolo 자동 머지와 충돌한다.
3. **Grafana가 익명 읽기로 인터넷에 열려 있다** — 변경 없음(`modules/observability/aws@v2.11.0:86`, `infra/envs/aws/main.tf:186-187` `ingress_group = demo-app-prod`, `dashboard_host`). `https://onetatchi.soulee.dev/grafana`. 익명 Viewer가 Explore로 CloudWatch Logs · 세 대상 지표를 조회할 수 있는지는 "확인 못 한 것". 시연 공개가 의도라면 Explore 비활성, 아니면 preview와 같은 SSO 뒤로(platform 요청).
4. **쓰기 · 소모 API 속도 제한 없음** — `POST /api/votes/:id`, `POST /api/guestbook`에 더해 `POST /api/load/cpu`(1). HPA · Cluster Autoscaler 때문에 무제한 호출이 비용으로 번진다. IP당 제한 또는 ALB WAF rate-based rule.
5. **방명록 삭제 · 보존 기간 없음** — 변경 없음. 규제 절.
6. **test 데이터가 개인 기기 Postgres에 있다(T33)** — `variables.tf:140-` `db_link.test` 기본값으로 AWS test BE가 맥북 k3d DB를 쓴다. T33 #105로 `onprem-wsl` 대상(또 다른 개인 기기 러너 · 클러스터)이 `deploy-targets.sh:22-23`에 추가됐다 — 기본 `DEPLOY_TARGETS`가 aws라 자동으로는 돌지 않고, 수동 실행 `targets` 입력으로만 간다(run 38106252977에서 onprem 대상은 러너 프로필 불일치로 실패). test 방명록(자유 텍스트)은 합성 데이터만 쓰는 운영 규칙이 필요하다.
7. **온프레미스 DB TLS는 자체 서명 인증서** — 변경 없음(`PGSSL: require`, 검증 없음, WireGuard 이중 암호화로 지금은 허용).
8. **Tailscale 통로의 신뢰 범위** — 변경 없음(모듈 참조만 v2.17.0). OAuth 클라이언트 · DB 자격증명은 Secrets Manager에 사람이 넣고 교체 주기 없음. test 파드의 RDS 네트워크 도달은 여전히 가능(egress NetworkPolicy 없음).
9. **GCP PR plan 서비스 계정이 GKE Secret 전체를 읽는다(#70)** — 변경 없음. T38로 GCP `cluster_addons.readable_secret_ids`에 preview oauth2-proxy 시크릿이 추가됐다(`infra/envs/gcp/main.tf:99`) — External Secrets용이라 적절.
10. **운영 정보 노출** — `/api/info`, `/api/metrics`, `/health`, `GET /api/chaos`에 더해 `GET /api/load/config`가 플래그 · 강도 목록 · 한도를 알려준다(`load.ts:14-17`). 공격자에게 "열려 있음"을 알려주는 정도.
11. **CORS 전체 허용**, **nginx 보안 헤더 없음** — 변경 없음(`be/src/index.ts:29-32`, `fe/nginx.conf`). CORS는 1의 브라우저 분산 경로이기도 하다.
12. **green 미리보기** — (a) `emailDomains ["*"]` · MFA 꺼짐 · 클라이언트 시크릿 tfstate 잔존은 그대로. (b) `previewAuth.routes`로 green BE 직접 호출(`deploy/values-fe.yaml:42-45`) 그대로 — test green BE는 `CHAOS_ENABLED=true` + `LOAD_TEST_ENABLED=true`. (c) **T38 gcp**: 같은 Cognito User Pool 클라이언트에 gcp 콜백 호스트 2개 추가(`variables.tf:98-105`, `main.tf:149`), Route53 A 레코드는 커밋된 고정 IP(`variables.tf:109-114`). GKE Ingress는 `allow-http: "false"` + ManagedCertificate(`deploy/gcp/values.yaml:14-20`) — TLS 강제는 맞다. **oauth2-proxy 클라이언트 ID · 시크릿 · 쿠키 시크릿이 이제 세 곳에 산다**(AWS Secrets Manager, onprem platform 네임스페이스 Secret, GCP Secret Manager — `deploy/onprem/values.yaml:9`, `infra/envs/gcp/README.md` 2단계). 교체하려면 세 곳을 같이 바꿔야 하고 주기는 없다. 복사는 사람이 CLI 파이프로 한다(파일 · 출력에 남기지 않음, README). (d) oauth2-proxy 쿠키 SameSite 미지정 그대로.
13. **GitHub Actions** — 재사용 워크플로 · 액션 `@v2.17.0`으로 통일. **T39** `targets` job(`deploy.yml:116-150`)은 `workflow_dispatch`의 자유 입력 `targets`를 env로 받아 `deploy-targets.sh:12-24`의 `case`로만 해석한다(지원 외 라벨 → 에러, `eval` 없음) — 입력 주입 경로 없음. 클러스터 이름은 레포 변수(`vars.*`)에서만 온다. `yolo-auto-merge`는 기준 대상(첫 대상)에서만 켜진다(`:182`). `secrets: inherit`(`deploy.yml:103,185,217`, `approval-timeout.yml:26`), `actions/checkout@v7` · `dorny/paths-filter@v3` SHA 미고정은 그대로. `template-update.yml:15-20`이 main push에도 돌지만 `permissions: contents: read`.
14. **`/health` 503이 liveness에도 걸린다(platform 이슈 211)** — platform v2.13.0이 `probe.livenessPath`를 추가했지만 `deploy/values-be.yaml:40-41`은 `probe.path: /health`만 있다. `.deploy/smoke.json`이 `/healthz/liveness`를 검사하므로 BE 경로는 있다. 차트 v2.17.0 기본값이 그 경로를 쓰는지는 "확인 못 한 것". 가용성 문제.
15. **RDS 백업 · 삭제 보호** — 변경 없음(AWS-0077 · 0177 MEDIUM). 규제 절.
16. **BE 개발 의존성 esbuild moderate 2건**(GHSA-67mh-4wv8-2f99, `drizzle-kit` 경유) — 런타임 이미지 밖. `drizzle-kit` 올리면 사라진다. 차단 기준 아님.
17. **해결된 항목(현재 코드로 확인)**: 마이그레이션 Job NetworkPolicy(PR #90). `.github/tests/package-lock.json` 취약점 확인(0건). 이전 11-b(green FE → blue BE) · 이전 1(test · prod 같은 RDS) · config.yaml 버전 일치는 계속 해결 상태.

## 노출

AWS 기준. onprem · GCP 구성은 레포에 있지만 기본 `DEPLOY_TARGETS`가 aws이고 브리프 선호 대상이 AWS라 기준이 아니다.

| 서비스 | 외부 노출 | 이유 |
|---|---|---|
| ALB → demo-app-fe (nginx :3000, active/blue) | **예** (HTTPS 443) | 유일한 앱 공개 진입점. `deploy/values-fe.yaml:28-31` `ingress.enabled: true`, host `yolo.onetatchi.soulee.dev`(test) · `onetatchi.soulee.dev`(prod). WAF · ALB 접근 로그 없음. 변경 없음. |
| ALB → demo-app-fe-preview-auth (oauth2-proxy :4180) → green FE 및 green BE `/api/` | **예, SSO 로그인 뒤** (`green-yolo.onetatchi.soulee.dev` test, `green.onetatchi.soulee.dev` prod) | `previewAuth.routes`(`deploy/values-fe.yaml:42-45`). test green BE는 `CHAOS_ENABLED=true` · `LOAD_TEST_ENABLED=true`. `--cookie-secure`, PKCE, Identity Center SAML만 허용은 그대로. |
| demo-app-be (Fastify :8000) — `/api/*`, `/health` | **예 (FE 경유)** | 직접 Ingress 없음. `fe/nginx.conf:23-34`가 `/api/` · `/health` 프록시. prod는 `POST /api/chaos` 미등록. **prod · test 모두 `POST /api/load/cpu`(인증 없음, CPU 소모) · `GET /api/load/config` 열림**(`deploy/values-be.yaml:30`) — 배포 뒤 1. |
| demo-app-be `/metrics`, FE 사이드카 :4040 | 아니오 | 변경 없음. |
| Grafana `https://onetatchi.soulee.dev/grafana` | **예, 익명 Viewer** | `modules/observability/aws@v2.11.0:86`, `infra/envs/aws/main.tf:186-187`. 배포 뒤 3. |
| 중앙 지표 수신 `https://metrics.onetatchi.soulee.dev` (remote write) | **예, basic auth** | 변경 없음. 비밀번호 교체 주기 없음. |
| Cognito Hosted UI | **예** (로그인 화면만) | 콜백 URL에 gcp 미리보기 호스트 2개 추가(`main.tf:149`, `variables.tf:98-105`). |
| **gcp green 미리보기** `green-gcp.onetatchi.soulee.dev` · `green-yolo-gcp.…` (GKE Ingress 고정 IP → oauth2-proxy) | **예, SSO 로그인 뒤** — gcp 대상을 배포할 때만 | `deploy/gcp/values.yaml:14-20` HTTPS 강제 · ManagedCertificate. `infra/envs/gcp/main.tf:145-148` 고정 IP. 기본 대상(aws)만 돌면 Ingress 자체가 없다. |
| RDS PostgreSQL 17 (prod) | 아니오 | 변경 없음. private, SG는 노드 SG만 5432. test는 RDS를 쓰지 않는다. |
| 온프레미스 Postgres(맥북 k3d) ← test BE | 아니오 (tailnet만) | `db_link` consume Service + egress 프록시. NetworkPolicy로 test의 `app.kubernetes.io/name=demo-app-be` 파드와 `batch.kubernetes.io/job-name=demo-app-be-migration` 파드만 5432 허용(`main.tf:277-280`). WireGuard + Postgres TLS(자체 서명). |
| Tailscale operator | 아니오 (tailnet 조정 서버로 outbound) | 변경 없음(모듈 v2.17.0). |
| EKS API 엔드포인트 | **예** (IAM 인증) | 변경 없음. `.trivyignore` AWS-0040 · 0041. |
| Secrets Manager (RDS · Slack · preview oauth2-proxy · Tailscale OAuth · onprem DB 자격증명) | 아니오 | `readable_secret_arns`(`main.tf:172-178`) External Secrets 역할만(preview는 plan 역할도). GCP Secret Manager에도 preview 값 사본(`infra/envs/gcp/main.tf:151-153`). |
| Slack 봇, Argo Rollouts, green smoke | 아니오 | 변경 없음. |
| docker-compose postgres :5432 | 로컬만 | 변경 없음. |

Ingress는 FE(+ oauth2-proxy)만 켠다 — 맞게 돼 있다. 이번 델타에서 새로 인터넷에 열린 것은 **prod의 `POST /api/load/cpu`**(FE 프록시 경유)와 gcp green 미리보기(SSO 뒤, gcp 대상 배포 시)다.

## 규제

- 데이터 보관 위치 제한: **없음**(이전과 같음). prod 데이터는 서울 리전 RDS(`variables.tf:7-14` 리전 강제). test 데이터는 온프레미스(맥북 k3d, 선택 시 WSL 기기)에 있다 — 국내 보관은 기기 위치 전제("가정"). GCP 연동은 지표 읽기(WIF)와 미리보기 인증 중계뿐이고 앱 데이터는 GCP로 가지 않는다(gcp 대상 자체를 배포하지 않는 한).
- 인프라가 제공해야 하는 설정(AWS, `regulated`):
  - **운영 관문(템플릿 v2.17.0 — 구조 유지)**: platform `deploy.yml@v2.17.0`은 `gate` job이 `.deploy/config.yaml`의 `compliance`로 environment를 정하고(`:170-186`, `regulated | "" → prod`, `none → prod-auto`), **승인은 `approve` job이 GitHub environment `prod`에서 받고**(`:306-313`), 실제 `deploy` job은 `needs: [gate, publish, approve]` + `approve` success 또는 skipped(`:321-327`)로 **`prod-auto` environment**에서 돈다(`:335-338`). 사람 승인 없이 prod에 가는 경로는 `compliance: none`뿐이고 그 값은 `checks.yml` `config-guard`(`:228-`) + CODEOWNERS가 지킨다. **T39로 바뀐 점**: 호출부 `prod` job이 matrix가 됐고 `needs.test`가 **모든 대상의 test 성공**을 요구한다(`deploy.yml:189-193`) — 관문 약화 아님. 승인 기록은 대상마다 따로 남는다(`prod (<label>) / approve`). T25 실행(run 38105887347)에서 `approve` · `deploy`가 그 순서로 돌았다. `prod-auto` environment의 브랜치 정책 · Deploy 역할 신뢰 subject는 레포 밖("확인 못 한 것").
  - **저장 데이터 암호화**: prod RDS `storage_encrypted` 충족(변경 없음). test 온프레미스 Postgres는 기기 디스크 암호화에 의존(레포 밖).
  - **전송 구간 암호화**: 사용자↔ALB TLS 충족. BE↔RDS `PGSSL: require` 충족. BE↔온프레미스 DB는 WireGuard + Postgres TLS(자체 서명, 배포 뒤 7). gcp 미리보기는 `allow-http: "false"` + ManagedCertificate(`deploy/gcp/values.yaml:17-20`).
  - **비밀값 관리**: 기존 항목 유지. **추가**: preview oauth2-proxy 값이 AWS · onprem · GCP 세 곳에 복제된다(배포 뒤 12-c) — 교체 절차가 세 곳을 포함해야 한다. 지표 수신 basic auth · Tailscale OAuth 교체 주기 없음.
  - **백업 보존**: 변경 없음 — RDS 1일, `deletion_protection = false`(AWS-0077 · 0177). test DB 백업 없음.
  - **접근 로그**: ALB 접근 로그 없음(변경 없음). nginx `combined` 로그가 stdout → CloudWatch로 간다(`fe/nginx.conf:13`) — `POST /api/load/cpu` 남용의 IP는 여기서만 추적된다(BE는 `LOG_LEVEL: warn`). oauth2-proxy 로그에 승인자 이메일. Grafana 익명 접근은 사람을 식별할 수 없다(배포 뒤 3). EKS 컨트롤 플레인 `audit · api · authenticator` 켜짐.
  - **네트워크 · 자원 격리**: RDS private 충족. NetworkPolicy는 DB 통로 egress 프록시에만(마이그레이션 Job 허용 추가). 앱 파드 간 정책 없음. **BE에 CPU limit이 없어 test · prod가 같은 노드에서 CPU를 경쟁한다** — 배포 뒤 1의 증폭 경로. `resources.limits.cpu`를 두거나 prod 노드를 분리하면 좁혀진다.
  - **인증 · 접근 통제**: 승인자 green 접근 SSO(MFA 꺼짐) 그대로. Grafana 익명(배포 뒤 3). **prod 부하 API 인증 없음**(배포 뒤 1).
  - **삭제 · 보존**: 방명록 삭제 수단 없음(변경 없음).
- 브리프 답변과 코드 발견의 불일치:
  - "민감 데이터 **예**" ↔ 데이터 모델 변경 없음("방명록 자유 텍스트" 해석, `regulated` 유지). 기존 불일치(test 데이터 개인 기기, Grafana 익명)는 그대로. **새 불일치**: `regulated` · 월 10만 원 예산인데 prod에 인증 없는 CPU 소모 API가 열려 있어 외부인이 HPA · 노드 확장을 유발할 수 있다(배포 뒤 1). 시연 편의와 맞바꾼 결정이라 `none`은 제안하지 않고 값 파일 분리 또는 서버 제한으로 좁힌다.
  - "가용성 시연용" ↔ HPA · Cluster Autoscaler는 넉넉하지만 보안 영향은 1의 증폭 상한을 정하는 쪽으로만 작용한다.
  - "선호 대상 AWS" ↔ 유지. T39 matrix · T38 gcp 미리보기 · onprem-wsl은 부가 대상이고 기본 변수는 aws다.
  - `.trivyignore`: **변경 없음**(AWS-0040 · 0041 · 0104). **새로 넣을 예외 없음** — IaC HIGH 0건, lockfile 0건, esbuild moderate는 런타임 밖이라 예외 등록 대상이 아니다. 파이프라인 `iac-scan` · `vuln-scan` · `image-scan` · `secret-scan` · `license-scan` 전부 성공(run 38106242915).

## 확인 못 한 것

- **T25 prod green이 active로 승격됐는지** — run 38105887347의 `prod / deploy`는 성공했지만 `promote-mode: branch`에서 active 전환은 rollout 워크플로(Slack 버튼)가 한다. 승격 전이면 `onetatchi.soulee.dev`의 active BE에는 아직 `/api/load/cpu`가 없을 수 있다. `curl -s https://onetatchi.soulee.dev/api/load/config`로 확인한다.
- **t3.medium에서 `heavy` 1회의 실제 CPU 시간** — 로컬(Apple Silicon) 17ms 측정만. 증폭 속도 판단은 이 추정에 기댄다.
- **GitHub `prod` environment의 required reviewers, `prod-auto` environment의 배포 브랜치 정책(main 전용), Deploy 역할 신뢰 subject 목록** — 레포 밖(이전과 같음).
- **Grafana 익명 Viewer가 Explore · 데이터 소스 직접 쿼리를 할 수 있는지** — 실환경 확인 필요(이전과 같음).
- **App Chart v2.17.0의 `probe.livenessPath` 기본값** — `/healthz/liveness`를 쓰는지 차트 템플릿을 읽지 않았다(배포 뒤 14).
- **GCP Secret Manager에 preview oauth2-proxy 값이 실제로 복사됐는지, 누가 언제 했는지** — README 2단계는 수동 절차. gcp 대상 미리보기는 이 값이 있어야 동작한다.
- **tailnet ACL 실제 내용, 맥북 · WSL 기기의 디스크 암호화 · 물리 위치, Secrets Manager 시크릿 작성자 · 교체 이력** — 이전과 같음.
- **컨테이너 이미지 OS 패키지 · oauth2-proxy · tailscale operator · cluster-autoscaler · Grafana 이미지 취약점** — 로컬 빌드 · pull 금지. 앱 이미지는 파이프라인 `image-scan`이 보지만 차트 · 모듈로 들어오는 서드파티 이미지는 파이프라인도 검사하지 않는다(이전과 같음).
- **gitleaks** 미실행(미설치). 패턴 grep으로 대신했고 파이프라인 `secret-scan` 성공.
- **Identity Center 할당 그룹 · MFA, Container Insights 보존 기간, ALB SG, RDS `rds.force_ssl`** — 이전과 같음.
- `.deploy/report.md` · `plan.yaml`과 이 문서의 정합은 보지 않았다(요청 범위 밖).

## 가정

- **`LOAD_TEST_ENABLED`의 prod 켜기는 의도된 결정이다**: `be/src/routes/load.ts:12` "prod can opt in through the same flag", `deploy/values-be.yaml:29` 주석, PR #106 · prod 승인에 근거. 그래서 "막는 문제"가 아니라 "prod 승격 전 권고"로 둔다. 의도가 아니었다면 값 파일 분리(배포 뒤 1-a)만으로 닫힌다.
- **CPU 소모 상한 추정**: 파드당 워커 1개(코어 1개), 대기열 8, 데드라인 2초는 코드로 확인했고, 노드에서의 요청당 시간은 로컬 측정에서 외삽했다. HPA · Autoscaler 상한(6 파드 · 5 노드)은 값 파일 · main.tf 기준.
- **esbuild moderate는 런타임에 없다**: `drizzle-kit`은 devDependencies(`be/package.json:23-28`)이고 이미지는 `pnpm install --prod`(`be/Dockerfile:25`)로 설치한다. 파이프라인 `image-scan (be)` 성공과 일치.
- **`*.auto.tfvars` 2개 · gcp 고정 IP · 호스트 이름 · SAML 메타데이터 URL은 비밀값이 아니다**: 모두 공개 식별자다. WIF는 EKS 발급 토큰만 받고, Cognito 콜백 호스트는 등록된 클라이언트 ID · PKCE 없이는 쓸 수 없다.
- **`prod-auto` environment는 main 전용이고 보호 규칙이 없다**: platform 주석(`deploy.yml@v2.17.0:335-336`)에 근거. 레포 밖이라 "확인 못 한 것"에도 둔다.
- **"민감 데이터 예"는 방명록 자유 텍스트를 가리킨다**: 변경 없음. test 데이터의 개인 기기 보관은 합성 데이터 운영 규칙이면 수용 가능하다.
- **맥북 · WSL 기기는 국내에 있다**: 데이터 보관 위치 "없음" 판정은 이 전제다.
- **test의 `CHAOS_ENABLED=true` · `LOAD_TEST_ENABLED=true`는 수용한다**: 시연 · 승인 없는 환경 · 장애 훈련(T36) · 오토스케일 시연(T25) 경로. test는 prod와 DB를 공유하지 않는다. 단 노드는 공유하므로 test 부하가 prod 파드와 CPU를 경쟁하는 것은 배포 뒤 1의 limit 권고로 같이 다룬다.
- **Grafana 익명 공개는 platform의 의도다**: 모듈 주석에 근거. `regulated`와는 맞지 않아 배포 뒤 3에 둔다.
- **trivy 결과 신뢰 범위**: 로컬 DB 갱신본, 대상은 lockfile · Terraform 루트(`.terraform` 캐시 제외) · Dockerfile. 이미지는 파이프라인에 맡긴다.
- **platform 태그 내용이 배포에 쓰이는 것과 같다**: 재사용 워크플로 · 차트 · 모듈은 `git show v2.17.0:…` · `v2.11.0:…` · `v1.16.2:…`로 읽었고 OCI 차트 2.17.0이 그 태그와 같다고 본다.
