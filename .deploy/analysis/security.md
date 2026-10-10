# 보안 분석

분석일: 2026-10-11 (yolo 재검증, 기준 커밋 951feac)

브리프(2026-10-10): 하루 100명 이하 · 월 10만 원 이하 · 민감 데이터 **예** · 선호 대상 **AWS** · 가용성 **시연용**. `.deploy/config.yaml`은 `compliance: regulated`, `template_version: v2.12.0`, `infra_versions.aws: v2.11.0`(이전 분석의 "config.yaml과 호출부 버전 불일치"는 해소됐다).

이 문서는 2026-10-10 재검증(기준 b8bc6d8)의 **델타 재검증**이다. `git diff 6b48d77..HEAD -- deploy infra .github`로 확인한 변경: T35 `CHAOS_ENABLED`를 `deploy/values-be.test.yaml`로 이동(#74), T29 BE HPA · Cluster Autoscaler(#79), T17 Grafana GCP 모니터링 WIF(`gcp-monitoring.auto.tfvars`, #71 · #73 · #76 · #77), T31 `previewAuth.routes`(#65) · onprem 미리보기 터널(#82), T33 AWS test DB를 온프레미스 Postgres로 연결(#69) + VPC CNI NetworkPolicy · `db_link.allow_from`(#81), 템플릿 v2.12.0(승인 approve job 분리, approval-timeout, #86 test 전용 값 변경의 prod 생략). `be/`, `fe/`, `db/`, `docker-compose.yml`, `.trivyignore`는 **변경 없음**(`git diff --stat` 0건). `.deploy/smoke.json`은 `expect_body`만 추가.

조사 범위: 위 diff 전체, `deploy/*`, `infra/envs/{aws,gcp,onprem}/*.tf`, `.github/workflows/*.yml`, `.github/tests/*`, `.trivyignore`, `.deploy/smoke.json`. 참조로 platform 저장소(`/Users/gayeonwon/orca/one-tatchi/one-tatchi-platform`, `git show <태그>:…`로 태그 내용만 읽음)의 재사용 `deploy.yml@v2.12.0`, `checks.yml@v2.12.0`, `scripts/values-files.sh`, `skills/deploy-provision/scripts/check-artifacts.sh`, App Chart v2.12.0 템플릿, `modules/db_link/tailscale@v2.12.0`, `modules/cluster/aws@v2.11.0`, `modules/cluster_addons/aws@v2.11.0`, `modules/observability/aws@v2.11.0`, `modules/observability/gcp@v1.16.2`, `modules/ci_identity/aws@v2.12.0`, ADR 0017, platform 이슈 160 · 211, demo-app PR #81 · #87 · #89, 그리고 `gh run list`로 main 배포 · 인프라 실행 결과를 봤다. 수정한 것은 이 파일뿐이다.

로컬 도구: trivy 0.75.0. gitleaks · osv-scanner 없음(설치하지 않음).

## 배포를 막는 문제

**보안 기준(비밀값 커밋 · HIGH 이상 취약점 · 인증 없는 관리 기능)으로 test 배포를 막는 문제: 없음. prod 승격 전 조치: 없음** — 이전의 "prod 승격 전 1건"은 해소됐다(아래 1).

1. **[해소] prod의 인증 없는 장애 주입 API** — `CHAOS_ENABLED: "true"`가 `deploy/values-be.yaml`에서 빠지고 `deploy/values-be.test.yaml:5`로 옮겨졌다. platform `deploy.yml@v2.12.0:475-476`이 `scripts/values-files.sh`로 값 파일을 `values-be.yaml → deploy/<대상>/values.yaml → values-be.<environment>.yaml` 순서로 합치므로 prod(`values-be.prod.yaml` 없음)에는 이 키가 없고, `be/src/routes/chaos.ts:34-37`에 따라 `POST /api/chaos` · `/reset`이 등록되지 않는다. test는 그대로 열린다(시연 · T36 장애 훈련 용도, 수용). `deploy/*/values.yaml` 어디에도 `CHAOS_` · `DEBUG` · `FAULT_` 키 없음(`grep`). 보조 통제: #86의 `prod_common` 필터(`deploy/values-!(*.test).yaml`)로 test 전용 값만 바꾼 push는 prod job을 돌리지 않는다(`.github/workflows/deploy.yml:77-81,147-151`, `.github/tests/deploy-routing.test.cjs`가 `request` job에서 검증). 단 platform v2.8.0 `check-artifacts.sh:186-191`의 플래그 위치 검사는 **deploy-provision 스킬 쪽 스크립트**이지 파이프라인 `checks.yml`에는 없다(`git grep check-artifacts v2.12.0` — CHANGELOG · ADR · 스킬만). 되돌아갈 경로는 "배포 뒤 고칠 문제" 1.

2. **[새로 발견 · 추정] T33 NetworkPolicy가 test의 마이그레이션 Job을 막을 수 있다 — 보안 취약점이 아니라 보안 통제의 부작용, test 배포 실패 가능.** `infra/envs/aws/main.tf:262-263`이 `allow_from = [{ namespace = test, pod_labels = { "app.kubernetes.io/name" = "demo-app-be" } }]`를 주고, `modules/db_link/tailscale/main.tf:119-150`이 egress 프록시 파드(네임스페이스 `tailscale`)에 **그 라벨의 test 파드만** 5432로 들어오게 하는 Ingress NetworkPolicy를 만든다. VPC CNI `enableNetworkPolicy = "true"`(`modules/cluster/aws@v2.11.0:47`)라 이제 실제로 적용되고, f01596e의 infra apply(run 38067058398)는 성공했다. 그런데 App Chart v2.12.0 `migration-job.yaml`의 Job 파드 템플릿에는 `metadata.labels`가 **없다**(Job 컨트롤러가 붙이는 `batch.kubernetes.io/job-name`뿐). `deploy/values-be.yaml:41-43` `migration.enabled: true` + `deploy.yml` test services의 `"migration":"db/init.sql"`이라 `helm upgrade`의 pre-upgrade hook이 `psql $DB_URL`(→ `demo-app-db-onprem.test.svc.cluster.local`)을 실행하는데, 이 파드는 `app.kubernetes.io/name` 라벨이 없어 정책에 거부된다 → Job `backoffLimit: 2` 소진 → hook 실패 → test 배포 실패. **NetworkPolicy 적용 뒤 test 배포는 아직 한 번도 돌지 않았다**(main 9c643c8 · f01596e · 854d3fd · 128c157 · 951feac 실행 모두 `test | skipped` — 앱 · 값 변경이 없어서). 이번 yolo push는 `.deploy/`만 바꾸면 역시 test가 skip되지만, 앱 코드 · 값을 건드리는 다음 push에서 걸린다.
   - 코드로만 판단한 추정이다(실행 못 함). 첫 test 배포에서 `kubectl -n test describe job demo-app-be-migration`과 `kubectl -n tailscale logs <egress 프록시>`로 확인한다.
   - 레포 안에서 고치는 방법: `infra/envs/aws/main.tf`의 `allow_from`에 `{ namespace = "test", pod_labels = { "batch.kubernetes.io/job-name" = "demo-app-be-migration" } }`를 더한다(infra PR · plan 확인 필요). 근본 수정은 platform App Chart가 Job 파드 템플릿에 `app.labels`를 붙이는 것. 정책을 비우는(`allow_from = []`) 우회는 #81의 목적을 되돌리므로 권하지 않는다.
   - 보안 측면의 결론은 반대로 **긍정적**이다: prod 네임스페이스 · 다른 파드는 온프레미스 DB에 닿지 못한다(이전 "배포 뒤 8" NetworkPolicy 없음은 DB 통로에 한해 해소).

아래는 막는 기준에 걸리지 않았다.

- 비밀값 커밋: 없음. `git ls-files`에 `.env*` · `*.pem` · `*.key` · `*.tfstate` 없음. **새로 커밋된 `*.auto.tfvars` 2개**(`infra/envs/aws/gcp-monitoring.auto.tfvars`, `infra/envs/gcp/grafana.auto.tfvars`)는 GCP 프로젝트 ID · WIF 프로바이더 리소스 이름 · 서비스 계정 이메일 · EKS OIDC issuer URL뿐으로 **비밀값이 아니다**("가정" 참고, 서비스 계정 키 파일 없음). Tailscale OAuth · 온프레미스 DB 자격증명은 Secrets Manager 이름만 레포에 있고(`variables.tf:112,133`) Terraform은 `data` 소스로 ARN만 읽는다(`main.tf:217-224`, 이슈 160 코멘트 "state · 로그에 평문 없음"). `secret|password|token = "<긴 문자열>"` 패턴 `git grep` 0건. 파이프라인 `secret-scan`(gitleaks v8.24.3)이 다시 본다.
- HIGH 이상 취약점: `trivy fs --scanners vuln` 전체 심각도 `be/pnpm-lock.yaml` 0건, `fe/pnpm-lock.yaml` 0건(lockfile 변경 없음). 새 `.github/tests/package-lock.json`(js-yaml 4.3.2 · picomatch 2.3.2, devDependencies, `npm ci --ignore-scripts`로 runner에서만 실행)은 trivy가 대상으로 잡지 않았다 — "확인 못 한 것". 파이프라인 `vuln-scan` · `image-scan` 성공(run 38068243477).
- IaC misconfig HIGH 이상: `trivy config infra`(`.terraform` 캐시 제외) HIGH 0건. MEDIUM은 AWS-0077 · 0176 · 0177(RDS, 이전과 같음)과 GCP-0014 · 0020 · 0025(Cloud SQL 로그 플래그, GCP 루트 — 선호 대상 아님). Dockerfile: BE 0건, FE `DS-0026`(LOW, HEALTHCHECK 없음) 이전과 같음. 파이프라인 `iac-scan` 성공.
- 인증 없는 관리 기능: 없음. prod `POST /api/chaos` 닫힘(1). green 미리보기 BE 경로(`previewAuth.routes`)는 oauth2-proxy 뒤에 있다(노출 표).

## 배포 뒤 고칠 문제

우선순위 순. 이전 분석의 1(test · prod 같은 RDS) · 13(config.yaml 버전 불일치)은 **해결**, 4(liveness)는 platform v2.13.0에 수정이 나와 **진행 중**(13번).

1. **prod 장애 주입 차단이 "값 파일 위치 규약"에만 기댄다** — `deploy/values-be.yaml`은 CODEOWNERS 보호 파일이 아니고(`CODEOWNERS`는 `config.yaml` · CODEOWNERS만), `check-artifacts.sh`는 파이프라인에 없다. yolo 커밋이 `values-be.yaml`에 `CHAOS_ENABLED`를 되돌리면 test 자동 승격 → yolo-pr 자동 머지 → prod 승인 대기까지 아무 검사도 걸리지 않고, 승인자가 diff를 봐야 잡힌다. platform `checks.yml`에 같은 검사를 넣거나(platform 요청) `deploy/values-*.yaml`을 CODEOWNERS에 추가한다(yolo 자동 머지와 충돌하므로 전자가 맞다).
2. **Grafana가 익명 읽기로 인터넷에 열려 있다(이전 분석 누락 + 이번에 범위 확대)** — `modules/observability/aws@v2.11.0:86` `auth.anonymous = { enabled, org_role = Viewer }`, Ingress `/grafana`가 이번에 prod ALB 그룹(`ingress_group = demo-app-prod`, `dashboard_host = onetatchi.soulee.dev`, `main.tf:175-176`)으로 옮겨져 `https://onetatchi.soulee.dev/grafana`가 됐다(v1.16.0에서도 익명 + Ingress였으나 호스트 없는 별도 ALB · HTTP). 데이터 소스는 CloudWatch(파드 IAM `CloudWatchReadOnlyAccess` — 로그 읽기 포함), 중앙 Prometheus(onprem · GCP 원격 쓰기), GCP Cloud Monitoring(`roles/monitoring.viewer`). 익명 Viewer가 Explore로 임의 쿼리를 할 수 있으면 계정의 CloudWatch Logs(oauth2-proxy 로그인 이메일, BE 로그) · 세 대상의 지표를 누구나 조회한다. Grafana 13의 Viewer 기본 권한에 `datasources:explore`가 포함되는지는 확인 못 했다("확인 못 한 것"). 시연 대시보드 공개가 의도라면 `viewers_can_edit=false` + Explore 비활성 또는 익명을 끄고 preview와 같은 SSO 뒤로 넣는다(platform 요청).
3. **쓰기 API 속도 제한 없음** — 변경 없음. `POST /api/votes/:id`, `POST /api/guestbook`. HPA(`minReplicas 2 · maxReplicas 6`) · Cluster Autoscaler(노드 최대 5)가 생겨 무제한 쓰기가 이제 **비용**으로도 번진다(부하 → 파드 · 노드 확장). IP당 제한 또는 ALB WAF rate-based rule.
4. **방명록 삭제 · 보존 기간 없음** — 변경 없음. 규제 절.
5. **test 데이터가 맥북 k3d Postgres에 있다(T33)** — `variables.tf:127-139` `db_link.test` 기본값으로 AWS test BE가 `demo-app-db-test.tailb7ed7e.ts.net`을 쓴다. 이전 "test · prod 같은 RDS" 문제는 해소됐지만, test 방명록(자유 텍스트 → 개인정보 가능)이 개인 기기 디스크에 남는다. 맥북 디스크 암호화 · 접근 통제는 레포 밖. test 데이터는 합성 데이터만 쓰도록 운영 규칙으로 정하거나, 시연 뒤 `db_link = {}`로 RDS 원복(이슈 160 코멘트에 적힌 원복 경로). `main.tf:186`의 주석 "test · prod가 같은 RDS를 쓴다"는 더 이상 사실이 아니다.
6. **온프레미스 DB TLS는 자체 서명 인증서** — `modules/database/onprem@v2.12.0:67-71` `ssl-cert-snakeoil`. BE는 `PGSSL: require`(검증 없음)라 붙기는 하지만 인증서 검증을 켤 수 없다. 통로 자체는 WireGuard(ADR 0017)라 이중 암호화이므로 지금은 허용. 규제 수준을 올리려면 onprem DB 인증서를 교체하고 `verify-full`.
7. **Tailscale 통로의 신뢰 범위** — operator 파드는 클러스터 RBAC + tailnet OAuth 클라이언트(`tag:k8s`로 기기 생성 가능)를 갖고, egress 프록시는 `NET_ADMIN`(iptables DNAT, ADR 0017). 조정 서버는 Tailscale SaaS. OAuth 클라이언트 · DB 자격증명 Secrets Manager는 **사람이 콘솔 · CLI로 넣고** 교체 주기가 없다(`main.tf:214-215`). tailnet ACL(`tag:app-aws → tag:db-onprem:5432`)은 레포 밖. 반대로 test 파드는 RDS에 네트워크로는 여전히 닿는다(RDS SG가 노드 SG 전체 허용, 자격증명만 없음) — egress NetworkPolicy는 없다.
8. **GCP PR plan 서비스 계정이 GKE Secret 전체를 읽는다(#70)** — `infra/envs/gcp/main.tf:68-94` ClusterRole `secrets get · list` 클러스터 전역을 `one-tatchi-gha-plan@…`에 바인딩. Helm 릴리스 기록을 읽으려는 목적이지만 모든 네임스페이스의 DB 자격증명 · 앱 Secret도 읽힌다. GCP는 선호 대상이 아니라 영향은 낮지만, PR plan을 fork · 외부 기여자에게 열지 않는다는 전제가 하나 더 붙는다. `helm.sh/release` 라벨 선택이 RBAC로 안 되므로 네임스페이스 한정 Role로 좁히는 것이 차선.
9. **운영 정보 노출** — 변경 없음(`/api/info`, `/api/metrics`, `/health`, `GET /api/chaos`). prod `GET /api/chaos`는 이제 `enabled: false`를 돌려주므로 외부에서 "닫혀 있음"만 보인다.
10. **CORS 전체 허용**, **nginx 보안 헤더 없음** — 변경 없음(`be/src`, `fe/nginx.conf` 변경 없음).
11. **green 미리보기** — (a) `emailDomains ["*"]` · MFA 꺼짐 · 클라이언트 시크릿 tfstate 잔존은 그대로. (b) 이전 9-c(green FE가 blue BE 호출)는 `previewAuth.routes`(`deploy/values-fe.yaml:42-45`)로 **해소** — oauth2-proxy가 `/api/`를 `demo-app-be-preview:8000`으로 보낸다(`preview-auth.yaml@v2.12.0:57-61`, 경로 · 서비스 이름 정규식 검증). 승인자가 green BE를 실제로 검증할 수 있다. 단 test green BE는 `CHAOS_ENABLED=true`라 SSO 로그인한 승인자는 green에 장애를 넣을 수 있다(의도된 훈련 경로). (c) onprem 기본 기기도 미리보기를 켠다(`deploy/onprem/values.yaml:9-10`, Named Tunnel → `demo-app-fe-preview-auth.prod.svc`). 터널 토큰은 `preview_tunnel_token_secret`(k8s Secret 이름만). Cognito 콜백에 `green-yolo-onprem.soulee.dev` · `green-onprem.soulee.dev` 추가(`variables.tf:89-96`) — AWS 밖 호스트가 같은 User Pool 클라이언트를 쓴다. (d) oauth2-proxy 쿠키 SameSite 미지정(브라우저 기본 Lax) — green BE POST에 CSRF 완화 수준은 기본값.
12. **GitHub Actions 참조** — 재사용 워크플로 · 액션 전부 `@v2.12.0`으로 통일(slack-notify도). `template-update.yml`은 diff 밖이라 `@v2` 유동 태그 그대로. 외부 액션 `actions/checkout@v7` · `dorny/paths-filter@v3` SHA 미고정, `secrets: inherit`(`deploy.yml:97,142,172`, `approval-timeout.yml:26`) 그대로. 새 `approval-timeout.yml`은 `actions: write`로 15분마다 60분 넘게 승인 대기한 실행을 취소한다(platform 재사용 워크플로) — 범위가 좁아 수용.
13. **`/health` 503이 liveness에도 걸린다 — 실제로 발생했다.** platform 이슈 211(2026-10-10 AWS test): 온프레미스 DB의 Tailscale peer가 Offline → BE `CONNECT_TIMEOUT` → `Liveness probe failed … /health` → 재시작 반복. v2.13.0이 `probe.livenessPath`를 추가했고 demo-app PR #87 · #89(열림)가 적용 준비 중. 이 레포 HEAD(v2.12.0)에는 아직 없다. 보안보다 가용성 문제이지만 "DB 장애를 숨기지 않는다"(ADR 0016)는 설계와 맞는 수정이다.
14. **RDS 백업 · 삭제 보호** — 변경 없음(AWS-0077 · 0177 MEDIUM). 규제 절.
15. **해결된 항목(현재 코드로 확인)**: prod `POST /api/chaos`(막는 문제 1). test · prod RDS 공유(5번으로 성격이 바뀜). `config.yaml` `template_version`과 호출부 일치(v2.12.0). green FE → blue BE(11-b). 이전 14 · 15(TLS · health 503 · i18n)는 코드 변경이 없어 그대로 유효.

## 노출

AWS 기준. onprem · GCP 구성은 레포에 있지만 브리프 선호 대상이 AWS라 기준이 아니다.

| 서비스 | 외부 노출 | 이유 |
|---|---|---|
| ALB → demo-app-fe (nginx :3000, active/blue) | **예** (HTTPS 443) | 유일한 앱 공개 진입점. `deploy/values-fe.yaml:28-31` `ingress.enabled: true`, host `yolo.onetatchi.soulee.dev`(test) · `onetatchi.soulee.dev`(prod). WAF · ALB 접근 로그 없음. 변경 없음. |
| ALB → demo-app-fe-preview-auth (oauth2-proxy :4180) → green FE **및 green BE `/api/`** | **예, SSO 로그인 뒤** (`green-yolo.onetatchi.soulee.dev` test, `green.onetatchi.soulee.dev` prod) | `previewAuth.routes`로 `/api/`가 `demo-app-be-preview:8000`에 직접 간다(`preview-auth.yaml@v2.12.0:57-61`). test green BE는 `CHAOS_ENABLED=true`. `--cookie-secure`, PKCE, Identity Center SAML만 허용은 그대로. |
| demo-app-be (Fastify :8000) — `/api/*`, `/health` | **예 (FE 경유)** | 직접 Ingress 없음. `fe/nginx.conf`(변경 없음)가 `/api/` · `/health` 프록시. **prod는 `POST /api/chaos`가 등록되지 않는다**(값 파일 분리). test는 열림. |
| demo-app-be `/metrics`, FE 사이드카 :4040 | 아니오 | 변경 없음. |
| **Grafana `https://onetatchi.soulee.dev/grafana`** | **예, 익명 Viewer** | `modules/observability/aws@v2.11.0:86,92-107`. prod ALB 그룹 `demo-app-prod`에 합류(`main.tf:175-176`). CloudWatch(ReadOnly) · 중앙 Prometheus · GCP Cloud Monitoring 데이터 소스. 관리자 비밀번호는 차트가 만든 k8s Secret. 배포 뒤 2. |
| **중앙 지표 수신 `https://metrics.onetatchi.soulee.dev`** (remote write) | **예, basic auth** | `charts/observability/templates/receiver-config.yaml:25-26` nginx `auth_basic` + htpasswd(Secret `deploy-metrics-auth`). onprem · GCP가 `OBSERVABILITY_REMOTE_WRITE_PASSWORD`로 쓴다. 비밀번호 교체 주기 없음. |
| Cognito Hosted UI | **예** (로그인 화면만) | 변경 없음. 콜백 URL에 onprem 미리보기 호스트 2개 추가. |
| RDS PostgreSQL 17 (prod) | 아니오 | 변경 없음. private, SG는 노드 SG만 5432. **test는 이제 RDS를 쓰지 않는다.** |
| **온프레미스 Postgres(맥북 k3d) ← test BE** | 아니오 (tailnet만) | `db_link` publish는 tailnet MagicDNS에만 노출, 인터넷에 열리지 않음(ADR 0017). EKS 쪽 consume Service `demo-app-db-onprem.test.svc` + egress 프록시. **NetworkPolicy로 test의 `app.kubernetes.io/name=demo-app-be` 파드만 5432 허용**(`main.tf:262-263`), 다른 네임스페이스 · 파드 거부. 통로 WireGuard + Postgres TLS(자체 서명). |
| Tailscale operator (tailscale 네임스페이스) | 아니오 (tailnet 조정 서버로 outbound) | OAuth 클라이언트는 Secrets Manager `one-tatchi/tailscale-oauth` → External Secrets. |
| EKS API 엔드포인트 | **예** (IAM 인증) | 변경 없음. `.trivyignore` AWS-0040 · 0041. |
| Secrets Manager (RDS · Slack · preview oauth2-proxy · **Tailscale OAuth · onprem DB 자격증명**) | 아니오 | `readable_secret_arns`가 5개로 늘었다(`main.tf:161-165`). External Secrets 역할만 읽는다(preview는 plan 역할도). |
| Slack 봇, Argo Rollouts, green smoke | 아니오 | 변경 없음. |
| docker-compose postgres :5432 | 로컬만 | 변경 없음. |

Ingress는 FE(+ oauth2-proxy)만 켠다 — 맞게 돼 있다. 새로 공개된 것은 Grafana(익명)와 지표 수신(basic auth)이며 둘 다 platform 관측 모듈의 결정이다.

## 규제

- 데이터 보관 위치 제한: **없음**(이전과 같음). prod 데이터는 서울 리전 RDS(`variables.tf:11-14` 리전 강제). **test 데이터는 이제 온프레미스(맥북 k3d)에 있다**(T33) — 국내 보관은 맥북 위치 전제("가정"). GCP Cloud Monitoring 연동은 **AWS → GCP 방향의 지표 읽기**뿐이고(`roles/monitoring.viewer`, WIF 토큰 교환) 앱 데이터는 GCP로 가지 않는다.
- 인프라가 제공해야 하는 설정(AWS, `regulated`):
  - **운영 관문(템플릿 v2.12.0으로 구조 변경 — 유지됨)**: platform `deploy.yml@v2.12.0`은 `gate` job이 `.deploy/config.yaml`의 `compliance`로 environment를 정하고(`:166-182`, `regulated | "" → prod`, `none → prod-auto`), **승인은 `approve` job이 GitHub environment `prod`에서 받는다**(`:302-312`, Slack 봇의 custom deployment protection rule도 이 job의 대기를 처리). 실제 배포 `deploy` job은 `needs: [gate, publish, approve]`에 `needs.approve.result == 'success' || 'skipped'`를 요구하고(`:316-323`) **`prod-auto` environment로 돈다**(`:332-333`). 평가: (a) `approve`가 `skipped`가 되는 경우는 `gate.outputs.environment != 'prod'`, 즉 `compliance: none`뿐이고 그 값은 `config-guard`(`checks.yml@v2.12.0:228-`) + CODEOWNERS가 지키므로 **사람 승인 없이 prod에 가는 경로는 없다**. 거절 → `approve` failure → `deploy` 안 돎, 60분 초과 → `approval-timeout`이 실행 취소 → `!cancelled()`로 안 돎. (b) 바뀐 점은 **감사 기록이 두 environment로 나뉜다**는 것 — 승인자 · 시각은 `prod` environment의 deployment review(approve job)에, 배포 기록 · URL은 `prod-auto` environment에 남는다. 규제 증빙은 두 기록 + Slack 승인 메시지 + 감사 로그 버킷(`yolo-report` · ADR)을 함께 봐야 한다. (c) `prod-auto`는 "승인 규칙 없는 environment"이므로 **AWS Deploy 역할 신뢰(`ci_identity/aws` `environment:prod-auto` subject)와 함께 environment의 배포 브랜치 정책이 main 전용인지**가 관문의 두 번째 기둥이다(레포 밖, "확인 못 한 것"). 이 조건이 맞으면 규제 관문은 이전과 같은 강도다. (d) #86의 `prod_common` 필터는 test 전용 값 변경이 prod 승인 요청 자체를 만들지 않게 해 승인 피로를 줄인다 — 관문 약화는 아니다. (e) `verify-observability` 수동 실측은 prod를 돌리지 않는다(`deploy.yml:147`).
  - **저장 데이터 암호화**: prod RDS `storage_encrypted` **충족**(변경 없음). test 온프레미스 Postgres는 k3d 볼륨 — 디스크 암호화 레포 밖. k8s Secret KMS 그대로.
  - **전송 구간 암호화**: 사용자↔ALB TLS 충족. BE↔RDS `PGSSL: require` 충족. **BE↔온프레미스 DB는 WireGuard + Postgres TLS(자체 서명, 검증 없음)** — 충족(배포 뒤 6). Grafana · 지표 수신 HTTPS(`ELBSecurityPolicy-TLS13-1-2-2021-06`). Grafana→GCP STS HTTPS.
  - **비밀값 관리**: 기존 항목 유지. **추가**: Tailscale OAuth · onprem DB 자격증명은 Secrets Manager에 사람이 넣고 Terraform은 이름만 참조, External Secrets가 주입(`main.tf:214-224,229-246`). GCP 접근은 **서비스 계정 키 없이 WIF**(`modules/observability/aws@v2.11.0/gcp.tf`, 프로젝션 토큰 `/var/run/gcp/token`; GCP 쪽 `attribute_condition = "assertion.sub == 'system:serviceaccount:monitoring:grafana'"`, `grafana.tf@v1.16.2:17-18`) — 키 파일 방식보다 낫다. 지표 수신 basic auth 비밀번호(`OBSERVABILITY_REMOTE_WRITE_PASSWORD`)와 Tailscale OAuth는 교체 주기 없음.
  - **백업 보존**: 변경 없음 — RDS 1일, `deletion_protection = false`. test DB(온프레미스)는 백업 없음(platform database/onprem) — test 데이터는 복구 대상이 아니라는 전제.
  - **접근 로그**: ALB 접근 로그 없음(변경 없음). oauth2-proxy 로그에 승인자 이메일. **Grafana 익명 접근은 로그로 사람을 식별할 수 없다**(배포 뒤 2). EKS 컨트롤 플레인 `audit · api · authenticator` 켜짐(변경 없음).
  - **네트워크**: RDS private 충족. **NetworkPolicy가 처음 적용됐다**(VPC CNI `enableNetworkPolicy`) — 지금은 DB 통로 egress 프록시에만 정책이 있고 앱 파드 간(test → prod BE 등) 정책은 여전히 없다. 적용기가 켜졌으므로 App Chart에 NetworkPolicy 템플릿을 넣는 것이 다음 단계(platform). Cluster Autoscaler IAM은 ASG 태그 조건으로 범위 제한(`cluster_addons/aws@v2.11.0:88-95`), Pod Identity.
  - **인증 · 접근 통제**: 승인자 green 접근 SSO(MFA 꺼짐) 그대로. Grafana는 익명(배포 뒤 2).
  - **삭제 · 보존**: 방명록 삭제 수단 없음(변경 없음).
- 브리프 답변과 코드 발견의 불일치:
  - "민감 데이터 **예**" ↔ 데이터 모델 변경 없음. 해석("방명록 자유 텍스트")과 `regulated` 유지. **새 불일치**: 민감 데이터 "예"인데 test 데이터가 개인 기기에 있고(배포 뒤 5) 관측 대시보드가 익명 공개(배포 뒤 2). 둘 다 시연 편의와 맞바꾼 것이라 `none`은 제안하지 않고 운영 규칙 · platform 설정으로 좁힌다.
  - "가용성 시연용" ↔ HPA · Cluster Autoscaler는 시연용 요구보다 넉넉하지만 보안 영향 없음. test DB가 맥북에 있어 맥북이 꺼지면 test가 멈춘다(이슈 211에서 실제 발생) — "시연용"과 맞는 선택.
  - "선호 대상 AWS" ↔ 유지. onprem 미리보기 · GCP 모니터링은 부가 대상.
  - `.trivyignore`: **변경 없음**(AWS-0040 · 0041 · 0104). **새로 넣을 예외 없음** — 커밋된 IaC HIGH 0건, lockfile 0건. 파이프라인 `iac-scan` · `vuln-scan` · `image-scan` 전부 성공(run 38068243477).

## 확인 못 한 것

- **막는 문제 2(마이그레이션 Job vs NetworkPolicy)의 실제 발생 여부** — 코드 추론. NetworkPolicy 적용 뒤 test 배포가 아직 없다. 첫 배포에서 확인.
- **GitHub `prod` environment의 required reviewers, `prod-auto` environment의 배포 브랜치 정책(main 전용) · 보호 규칙 없음, Deploy 역할 신뢰 subject 목록**(`ci_identity` `deploy_environments`는 org 루트 값) — 전부 레포 밖. 관문 평가는 이 세 가지가 맞다는 전제다.
- **Grafana 익명 Viewer가 Explore · 데이터 소스 직접 쿼리를 할 수 있는지**(Grafana 13 RBAC 기본값) — 실환경에서 로그아웃 상태로 `/grafana/explore` 접근을 확인한다.
- **tailnet ACL 실제 내용**(`tag:app-aws → tag:db-onprem:5432`만인지), **맥북 디스크 암호화 · k3d 볼륨 위치 · 물리 위치**, **Secrets Manager `one-tatchi/tailscale-oauth` · `demo-app-db-onprem-test`의 작성자 · 교체 이력**.
- **컨테이너 이미지 OS 패키지 · oauth2-proxy v7.15.4 · tailscale operator 1.102.4 · cluster-autoscaler · Grafana 이미지 취약점** — 로컬 빌드 · pull 금지. 앱 이미지는 파이프라인 `image-scan`이 보지만 차트 · 모듈로 들어오는 서드파티 이미지는 **파이프라인도 검사하지 않는다**(이전과 같음, 대상이 늘었다).
- **`.github/tests/package-lock.json` 취약점** — trivy가 대상으로 잡지 않았고 npm audit은 설치 없이 lockfile만으로 돌리지 않았다. runner에서만 쓰는 테스트 의존성 2개.
- **gitleaks** 미실행(미설치). 패턴 grep으로 대신했고 파이프라인 `secret-scan` 성공.
- **Identity Center 할당 그룹 · MFA, Container Insights 보존 기간, ALB SG, RDS `rds.force_ssl`** — 이전과 같음.
- `.deploy/report.md` · `plan.yaml`과 이 문서의 정합은 보지 않았다(요청 범위 밖).

## 가정

- **`*.auto.tfvars` 2개는 비밀값이 아니다**: GCP 프로젝트 ID · WIF 프로바이더 리소스 경로 · 서비스 계정 이메일 · EKS OIDC issuer URL은 모두 식별자다. WIF는 `attribute_condition`으로 `monitoring/grafana` 서비스 계정의 **EKS 발급 토큰**만 받으므로 이 값을 알아도 EKS 토큰 없이는 GCP에 인증할 수 없다. 서비스 계정 키 파일은 없다(주석 "no service-account key is stored"). 파일 주석에도 "public identifiers"로 적혀 있다.
- **마이그레이션 Job 파드가 NetworkPolicy에 거부된다**: Job 파드 템플릿에 `app.kubernetes.io/name` 라벨이 없다는 템플릿 읽기와, VPC CNI 정책 적용기가 켜진 뒤 선택된 파드로의 ingress는 명시 허용만 통과한다는 Kubernetes NetworkPolicy 의미론에 근거한다. 실행으로 확인하지 않았다.
- **`prod-auto` environment는 main 전용이고 보호 규칙이 없다**: platform 주석("main 전용, Deploy 역할 신뢰 대상")에 근거. 다른 브랜치가 이 environment로 돌 수 있으면 승인 없이 Deploy 역할을 얻는 경로가 생기므로 "확인 못 한 것"에 둔다.
- **"민감 데이터 예"는 방명록 자유 텍스트를 가리킨다**: 변경 없음. 이 가정 아래 test 데이터의 맥북 보관은 "개인정보가 들어올 수 있는 test 데이터가 개인 기기에 있다"로 읽고, 합성 데이터 운영 규칙이면 수용 가능하다.
- **맥북은 국내에 있다**: 데이터 보관 위치 "없음" 판정은 이 전제다.
- **test의 `CHAOS_ENABLED=true`는 수용한다**: 시연 환경 · 승인 없는 환경 · 장애 훈련(T36) 경로. test는 이제 prod와 DB를 공유하지 않으므로 `dbError` 등은 prod 데이터에 영향이 없다.
- **Grafana 익명 공개는 platform의 의도다**: 모듈 주석 "누구나 대시보드를 볼 수 있게 익명 읽기 전용". 시연용으로는 맞지만 `regulated`와는 맞지 않아 배포 뒤 2에 둔다.
- **trivy 결과 신뢰 범위**: 로컬 DB 2026-10-10 갱신본, 대상은 lockfile · Terraform 루트(`.terraform` 캐시 제외) · Dockerfile. 이미지는 파이프라인에 맡긴다. 파이프라인 `iac-scan`이 `.trivyignore`를 읽는다는 전제는 이전 실행(AWS-0040 · 0041 · 0104 미차단)에 근거.
- **platform 태그 내용이 배포에 쓰이는 것과 같다**: 재사용 워크플로 · 차트 · 모듈은 `git show v2.12.0:…` · `v2.11.0:…` · `v1.16.2:…`로 읽었고 OCI 차트 2.12.0이 그 태그와 같다고 본다.
