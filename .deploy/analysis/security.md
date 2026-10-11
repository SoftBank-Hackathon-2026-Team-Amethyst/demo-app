# 보안 분석

분석일: 2026-10-11 (yolo 재검증, 기준 커밋 951feac → 현재 HEAD 142633a)

브리프(2026-10-10): 하루 100명 이하 · 월 10만 원 이하 · 민감 데이터 **예** · 선호 대상 **AWS** · 가용성 **시연용**. `.deploy/config.yaml`은 `compliance: regulated`, `template_version: v2.17.0`, `runtime_status_values: deploy/values-runtime-status.yaml`(새 키), `infra_versions.aws: v2.11.0` · `gcp: v1.16.2`.

이 문서는 2026-10-11 재검증(기준 951feac)의 **델타 재검증**이다. `git log --oneline 951feac..HEAD`(21건) · `git diff 951feac..HEAD`로 확인한 변경: **T25 CPU 부하 API**(`be/src/routes/load.ts`, `be/src/load/cpu-pool.ts` · `cpu-worker.ts`, `deploy/values-be.yaml` `LOAD_TEST_ENABLED`, FE `CpuLoadPanel.tsx`), **T25 Runtime Status**(FE nginx `/api/runtime` 프록시, `fe/docker-entrypoint.d/19-runtime-dns.sh`, `deploy/values-fe.yaml` `podNamespaceEnv`, `deploy/values-runtime-status.yaml`, `.github/workflows/runtime-status.yml`), **T17** `deploy/values-be.test.yaml` `probe.livenessPath`, **T38** gcp green 미리보기(`infra/envs/gcp` 고정 IP · 시크릿 모듈, `infra/envs/aws` Route53 · Cognito 콜백, `deploy/gcp/values.yaml`), **T39** 배포 대상 matrix(`.github/scripts/deploy-targets.sh`, `deploy.yml`), **T33** NetworkPolicy `allow_from`에 마이그레이션 Job 추가, 템플릿 **v2.17.0**(워크플로 · 모듈 참조 일괄), `.gitleaksignore` 신설, `fe/package.json` devDependency `tsx`. `be/pnpm-lock.yaml` · `db/` · `docker-compose.yml` · `.trivyignore`는 변경 없음.

조사 범위: 위 diff 전체, `deploy/*`, `infra/envs/{aws,gcp,onprem}/*.tf`, `.github/workflows/*.yml`, `.github/scripts/*`, `.github/tests/*`, `README.md`, `docs/runtime-status.md`. 참조로 platform 저장소(`git show v2.17.0:…`, 태그 내용만 읽음)의 `charts/runtime-status/*`, `runtime-status/src/*`, `scripts/install-runtime-status.sh`, App Chart v2.17.0 `rollout.yaml` · `preview-auth.yaml`, `deploy.yml@v2.17.0` · `checks.yml@v2.17.0`, `modules/secret/gcp@v1.16.2`, CHANGELOG v2.13.0~v2.17.0, 그리고 `gh run list` · `gh run view`(읽기만)로 main 실행 결과를 봤다. 수정한 것은 이 파일뿐이다.

로컬 도구: trivy 0.75.0(취약점 DB 갱신은 시간 초과 → 캐시된 DB로 검사). gitleaks · osv-scanner 없음(설치하지 않음).

## 배포를 막는 문제

**보안 기준(비밀값 커밋 · HIGH 이상 취약점 · 인증 없는 관리 기능)으로 test 배포를 막는 문제: 없음. prod 승격 전에 사람이 결정할 것: 1건**(아래 1 — 막는 기준에는 걸리지 않지만 승인자가 알고 결정해야 한다. 지금 run 38107769329가 `prod (aws) / approve`에서 대기 중이다).

1. **[새로 발견 · 판단 필요] prod에 인증 없는 CPU 소모 API가 열린다(T25).** `be/src/routes/load.ts:22-33` `POST /api/load/cpu`는 인증 · 속도 제한 없이 워커 스레드에서 sha256을 5,000 · 15,000 · 30,000회 돌린다. `deploy/values-be.yaml:30` `LOAD_TEST_ENABLED: "true"`가 **공통 값 파일**에 있어 test · prod 모두 등록되고(`load.ts:12` 주석 "prod can opt in", README:71-77도 같은 의도), FE nginx `location /api/`(`fe/nginx.conf:34-39`)를 거쳐 **공개 ALB `https://onetatchi.soulee.dev/api/load/cpu`** 로 누구나 부른다. 이전의 `CHAOS_ENABLED`와 달리 test 전용 파일로 옮기지 않았다.
   - **"인증 없는 관리 기능"인가**: 아니다 — 상태 · 설정을 바꾸지 않고, 데이터도 읽지 않으며(응답은 hostname · elapsedMs · 고정 checksum), 입력은 `enum` 3개로 스키마 검증된다(`load.ts:23-27`, 테스트 `be/tests/load.test.ts:29-34`). 그래서 막는 기준에 넣지 않는다.
   - **그래도 prod에서 문제인 이유**: 서버 쪽 한도는 **파드당** 워커 1개 · 대기열 8(초과 429) · 작업 2초 마감뿐이다(`cpu-pool.ts:23,27-28`). `/api/load/config`의 `maxRps: 20` · `maxDurationSec: 300`은 **브라우저 UI에만 적용되는 안내값**이고(`CpuLoadPanel.tsx:39-40`) 서버는 강제하지 않는다. 즉 파드당 요청 8개를 유지하는 curl 루프 하나로 각 파드의 워커 1코어를 무기한 100%로 만들 수 있고, BE CPU request가 `100m`(`values-be.yaml:16`)이라 HPA 목표 70%를 10배 이상 넘겨 **2→6 파드**, Pending이 생기면 Cluster Autoscaler가 **t3.medium 3→5대**(`infra/envs/aws/main.tf:88-89`)로 늘린다. 이것이 T25의 시연 목적이기도 하다. 결과는 (a) 비용 — 예산 분석기의 `aws-nodes-max` 대안(`.deploy/analysis/alternatives/aws-nodes-max/cost-summary.md`)이 노드 상한 시 확인된 소계 USD 387.8 vs 기본 308.2로 이미 산정해 뒀다. t3 계열은 버스트 크레딧을 소진하면 unlimited 모드에서 초과 크레딧이 추가 과금된다(모듈의 `cpu_credits` 설정은 확인 못 함). (b) 가용성 — 워커는 별도 스레드라 이벤트 루프는 살지만(`load.test.ts:46-57`) 노드 CPU를 다른 파드(FE · runtime-status · oauth2-proxy)와 나눠 쓴다. ALB에는 WAF · rate limit이 없다(이전과 같음).
   - **권고(둘 중 하나, prod 승격 전)**: ① `LOAD_TEST_ENABLED`를 `deploy/values-be.test.yaml`로 옮겨 prod를 닫는다(`CHAOS_ENABLED`와 같은 규약, `values-be.yaml:36` 주석이 이미 "test 전용 값은 values-be.test.yaml에만"이라고 적고 있다). ② prod 시연이 꼭 필요하면 시연 시간에만 켜고 끝나면 `"false"`로 재배포(README:77의 절차)하되, 켜 둔 동안의 비용 상한(노드 5대)을 승인자가 수용한다. 어느 쪽이든 green 미리보기 호스트의 BE(`previewAuth.routes` → `demo-app-be-preview`)는 SSO 뒤라 영향 없다.

2. **[해소] T33 NetworkPolicy가 마이그레이션 Job을 막는 문제** — 이전 분석의 추정이 **실제로 발생했고**(`infra/envs/aws/main.tf:276` 주석, run 38070479286 "pre-upgrade hooks failed") 같은 파일 `:277-280`에서 `allow_from`에 `{ namespace = env, pod_labels = { "batch.kubernetes.io/job-name" = "demo-app-be-migration" } }`를 더해 고쳤다. 이후 test 배포가 성공했다(run 38107769329 · 38107790313 `test (aws) / deploy` 성공). 보안 측면: Job 이름 라벨은 네임스페이스에 Job을 만들 수 있는 주체만 붙일 수 있으므로 통제 범위는 그대로다.

아래는 막는 기준에 걸리지 않았다.

- 비밀값 커밋: 없음. `git ls-files`에 `.env*` · `*.pem` · `*.key` · `*.tfstate` · `credentials` 없음. `password|secret|token|api_key = "<16자 이상>"`, `AKIA…`, `ghp_…`, `xox[baprs]-`, `BEGIN … PRIVATE KEY`, `AIza…` 패턴 `git grep` 0건. 새로 레포에 들어온 값 중 식별자: gcp 고정 IP 2개와 미리보기 호스트(`infra/envs/aws/variables.tf:98-114`), Cognito User Pool ID · Secrets Manager ARN(`deploy/values-fe.yaml:39-40`, 이전부터 있음) — 모두 공개 식별자다("가정"). gcp oauth2-proxy 시크릿은 Terraform이 **빈 시크릿만** 만들고(`modules/secret/gcp@v1.16.2` `google_secret_manager_secret`, 값 저장 없음) 사람이 aws → gcloud 파이프로 값을 넣는다(`infra/envs/gcp/README.md:42-48`, 파일 · 출력에 남기지 않음). **새 `.gitleaksignore`**는 커밋 `8cadbb66`의 `.deploy/analysis/security.md:7` 한 줄(`generic-api-key` 규칙, 분석 산문의 경로 문자열) 하나로 범위가 좁고 사유 주석이 있다 — 수용. 파이프라인 `secret-scan`(gitleaks v8.24.3) 성공(run 38107790313 · 38107769329).
- HIGH 이상 취약점: `trivy fs --scanners vuln` 전체 심각도 `be/pnpm-lock.yaml` 0건(변경 없음), `fe/pnpm-lock.yaml` 0건(새 devDependency `tsx@4.19.3` + `get-tsconfig@4.14.3` · `resolve-pkg-maps@1.0.0`; FE 런타임 이미지는 `dist`만 복사하므로 이미지에 들어가지 않는다 `fe/Dockerfile:25`). 파이프라인 `vuln-scan` · `image-scan (be, fe)` · `license-scan` 성공.
- IaC misconfig HIGH 이상: `trivy config infra`(`.terraform` 제외) HIGH · CRITICAL 0건 — `envs/aws` · `gcp` · `onprem`과 캐시된 platform 모듈(`preview_auth/aws@v2.17.0` 포함) 모두. `fe/Dockerfile` · `be/Dockerfile` HIGH 0건(FE `DS-0026` LOW HEALTHCHECK 없음은 이전과 같음). 파이프라인 `iac-scan` 성공.
- 인증 없는 관리 기능: 없음. prod `POST /api/chaos`는 계속 닫혀 있다(`values-be.yaml`에 `CHAOS_` 없음, `values-be.test.yaml:5`에만). `grep -rn 'CHAOS_\|DEBUG\|FAULT_' deploy/` → test 파일 1건뿐. 1번 CPU 부하 API는 위 판단대로 관리 기능이 아니다.

## 배포 뒤 고칠 문제

우선순위 순. 이전 분석의 13(liveness)은 test에 **적용**됐고(prod는 미적용, 아래 12), "막는 문제 2"는 해소. 나머지는 코드 변경이 없어 그대로다.

1. **prod CPU 부하 API(막는 문제 1)** — 승인자가 ②를 고르면 여기로 내려온다. 그 경우 최소 조치: (a) 서버 쪽에도 속도 제한(IP당, 또는 `@fastify/rate-limit`)을 두고 `maxRps` · `maxDurationSec`을 안내값이 아니라 강제값으로 만든다. (b) prod에서는 끄는 것을 기본으로, 시연 때만 켠다. (c) `values-be.yaml`의 플래그 위치 규약을 지키는 검사는 여전히 파이프라인에 없다(아래 2).
2. **test 전용 플래그가 "값 파일 위치 규약"에만 기댄다** — 이번에 실제로 어긋났다: `LOAD_TEST_ENABLED`가 공통 파일에 들어갔고 아무 검사도 걸리지 않았다(`checks.yml@v2.17.0`에 `CHAOS` · `LOAD_TEST` · `check-artifacts` 없음, `grep`). `deploy/values-be.yaml`은 CODEOWNERS 대상이 아니다. platform `checks.yml`에 "공통 값 파일의 `*_ENABLED: "true"` 류 시연 플래그"를 막는 검사를 넣거나, 최소한 `.deploy/smoke.json`에 prod `GET /api/load/config` → `enabled: false`를 넣어 승격 smoke가 잡게 한다.
3. **공개 운영 정보 노출이 늘었다 — `GET /api/runtime`** (T25). `fe/nginx.conf:24-31` `location = /api/runtime`이 `runtime-status.<namespace>.svc.cluster.local:8080`으로 프록시하고 인증이 없으므로 `https://onetatchi.soulee.dev/api/runtime`에서 누구나 해당 네임스페이스 BE 파드의 **이름 · 앱 버전 · rollout revision 해시 · phase/ready/terminating · 재시작 횟수 · CPU/메모리 사용량 · request/limit**을 5초 단위로 본다(`runtime-status/src/runtime.mjs:35-56,143-154`). 비밀값 · 환경변수 · 노드 정보는 응답에 없고(platform README:45-47 설계), 서비스 이름은 차트 렌더 시 고정이라 브라우저가 selector · 네임스페이스를 고를 수 없다(`charts/runtime-status/templates/runtime.yaml:1-7`, `runtime.mjs:60-62` 검증). 이전 `/api/info` · `GET /api/chaos` 노출과 같은 성격이고 시연 목적이지만, `regulated`에서는 파드 이름 · 버전 · 재시작 수가 공격자에게 유용한 정찰 정보다. prod에서는 `/api/runtime`을 preview 호스트(SSO)에서만 열거나 FE 프록시에 간단한 토큰을 두는 것을 검토.
   - runtime-status 자체의 권한은 좁다: ServiceAccount 전용, Role은 **그 네임스페이스**의 `pods list`, `metrics.k8s.io pods list`, `services get`(이름 2개 고정)뿐(`runtime.yaml:14-28`). 이미지는 sha256 digest 고정(`:5-7`), non-root · readOnlyRootFilesystem · `capabilities drop ALL`(`:60-85`). 앱 파드는 여전히 `automountServiceAccountToken: false`(App Chart `rollout.yaml:38`) — FE는 Downward API로 `POD_NAMESPACE`만 받는다(`rollout.yaml:50-54`, `values-fe.yaml:7`). 단 Service는 ClusterIP :8080에 인증이 없고 NetworkPolicy도 없어 **클러스터 안 모든 파드**(test ↔ prod 포함)가 조회할 수 있다 — 앱 파드 간 정책 부재(이전 분석 "네트워크" 항목)의 한 사례.
4. **쓰기 API 속도 제한 없음** — 변경 없음. `POST /api/votes/:id`, `POST /api/guestbook`. 1번과 합치면 "부하 → 확장 → 비용" 경로가 두 개다.
5. **방명록 삭제 · 보존 기간 없음** — 변경 없음.
6. **test 데이터가 맥북 k3d Postgres에 있다(T33)** — 변경 없음. 2026-10-11에도 Tailscale peer Offline으로 test가 멈춘 기록이 있다(이슈 211 계열). 합성 데이터 운영 규칙 또는 시연 뒤 RDS 원복.
7. **온프레미스 DB TLS 자체 서명** · **Tailscale 통로 신뢰 범위** — 변경 없음(모듈 참조만 v2.17.0으로 올라갔고 `db_link/tailscale`의 보안 관련 diff는 없다).
8. **Grafana 익명 Viewer 공개** — 변경 없음(`observability/aws@v2.11.0` 고정).
9. **GCP PR plan 서비스 계정이 GKE Secret 전체를 읽는다** — 변경 없음. 이번에 `readable_secret_ids`에 gcp oauth2-proxy 시크릿이 추가됐으나(`infra/envs/gcp/main.tf:99`) 이것은 External Secrets 쪽 권한이고 plan SA 범위는 그대로다.
10. **gcp green 미리보기(T38)** — 새로 켜졌다. (a) 인증은 aws Cognito(Identity Center SAML) 하나를 공유해 콜백 호스트가 aws 2 + onprem 2 + gcp 2 = 6개(`infra/envs/aws/main.tf:149`, `variables.tf:98-105`). 같은 OIDC 클라이언트 시크릿이 Secrets Manager → GCP Secret Manager → onprem platform Secret 세 곳에 복제돼 있다(교체 시 세 곳을 같이 바꿔야 하고 교체 주기는 없음). (b) GKE Ingress는 `kubernetes.io/ingress.allow-http: "false"` + ManagedCertificate로 TLS만 받는다(`deploy/gcp/values.yaml:16-20`, App Chart v2.16.0 `preview-auth.yaml`이 active Ingress와 같은 고정 IP 이름을 쓰면 렌더 실패). (c) 고정 IP는 `variables.tf:111-114`에 값으로 박혀 있어 gcp 루트가 IP를 다시 만들면 DNS가 어긋난다 — 보안이 아니라 운영 정합. (d) MFA 꺼짐 · `emailDomains ["*"]` · 쿠키 SameSite 기본값은 이전과 같다. gcp는 선호 대상이 아니고 2026-10-11 수동 실행(run 38106825277)에서 gcp · onprem-wsl publish가 이미지 push 단계에서 실패해 **아직 실측되지 않았다**.
11. **T39 배포 대상 matrix** — `workflow_dispatch` 자유 입력 `targets`가 `REQUESTED` 환경변수로 `.github/scripts/deploy-targets.sh`에 들어가고(`deploy.yml:123-139`, 인라인 `${{ }}` 치환이 아니라 env) 스크립트가 `case`로 허용 라벨만 받는다(`deploy-targets.sh:12-24`, 중복 · 미지원 → 실패; `.github/tests/deploy-routing.test.cjs:156-160`). 명령 주입 경로 없음. `matrix.cluster` 등은 레포 변수에서 온다. `fail-fast: false` + `prod.needs: [targets, test]`로 한 대상의 test 실패가 모든 대상의 prod를 막는다(`:153-155`) — 관문 약화 없음. 주의점 하나: `prod` job 이름이 `prod (${{ matrix.label }})`라 GitHub environment 보호 규칙(`prod` environment의 required reviewers)은 platform `deploy.yml`의 `approve` job이 그대로 받으므로 영향 없다(run 38107769329에서 `prod (aws) / approve` 대기 확인).
12. **`/health` 503이 prod liveness에 아직 걸린다** — T17로 `deploy/values-be.test.yaml:8-9` `probe.livenessPath: /healthz/liveness`가 **test에만** 적용됐다(App Chart v2.17.0 `rollout.yaml:77`이 `default .Values.probe.path .Values.probe.livenessPath`). prod는 여전히 `/health`(DB 검사)로 liveness를 본다. test에서 확인한 뒤 공통 파일로 올리는 것이 다음 단계(CHANGELOG v2.13.0 "demo-app은 test 환경에서 먼저 적용"). `be/src/routes/health.ts:24-26` `/healthz/liveness`는 상태 정보 없이 `{status: alive}`만 돌려준다 — 노출 측면 문제 없음.
13. **GitHub Actions 참조** — 재사용 워크플로 · 액션이 `@v2.17.0`으로 일괄 갱신(`deploy.yml`, `infra.yml`, `rollout.yml`, `approval-timeout.yml`, `onprem-*.yml`, `slack-notify-preview.yml`). `template-update.yml:29`만 `@v2` 유동 태그 그대로이고, 이번에 `push: main` 트리거(`.deploy/config.yaml` · `.github/workflows/**` · `**.tf`)가 붙었다(`:15-20`, `permissions: contents: read`). 새 `runtime-status.yml`은 `contents: read`, PR · main push에서 FE 테스트 + 이미지 빌드 + 읽기 전용 컨테이너 nginx `-t`만 한다 — 시크릿 없음. 외부 액션(`actions/checkout@v7`, `pnpm/action-setup@v6`, `docker/build-push-action@v6`, `dorny/paths-filter@v3`) SHA 미고정과 `secrets: inherit`는 이전과 같다.
14. **FE nginx 보안 헤더 없음 · CORS 전체 허용** — 변경 없음(`be/src/index.ts:29-32` `origin: true`). `/api/runtime` 블록은 `Cache-Control: no-store`만 더한다.
15. **RDS 백업 · 삭제 보호** — 변경 없음.
16. **해결된 항목(현재 코드로 확인)**: 마이그레이션 Job NetworkPolicy(막는 문제 2). test liveness 분리(12의 test 부분). 이전 "배포 뒤 1"(CHAOS 플래그 규약)은 2번으로 성격이 확장됐다.

### 새 코드의 주입 · 설정 면 검토(문제 없음으로 판단)

- `fe/docker-entrypoint.d/19-runtime-dns.sh:4-10`: `/etc/resolv.conf`의 첫 `nameserver` 값을 `RUNTIME_DNS_RESOLVER`로, Downward API `POD_NAMESPACE`를 nginx 템플릿에 `envsubst '${POD_NAMESPACE} ${RUNTIME_DNS_RESOLVER}'`로만 치환한다(다른 `$변수`는 그대로). resolv.conf는 kubelet이 쓰고, 네임스페이스는 DNS 라벨이며 App Chart가 `env.POD_NAMESPACE` 중복 지정을 렌더 실패로 막는다(`_helpers.tpl:19-20`). 값이 비면 `resolver ;`로 nginx가 시작 실패(fail-closed). 생성 파일은 `/tmp`(읽기 전용 루트 유지). 주입 면은 파드 자체가 탈취된 경우로 한정된다.
- `fe/nginx.conf:24-26`: `location = /api/runtime`(정확 일치)이 `/api/` 접두 블록보다 우선하고 upstream 경로가 `/api/runtime`으로 고정이라 경로 조작 불가. IPv6 resolver는 대괄호 처리(`19-runtime-dns.sh:5`).
- `be/src/index.ts:44-45` preHandler 제외에 `/api/load/`가 추가됐다 — chaos 지연 · 에러율 주입을 부하 API에 적용하지 않기 위한 것으로, 인증 · 검증을 건너뛰는 것이 아니다(원래 그 hook에 인증이 없다). 제외 목록이 접두 비교라 `/api/load/anything`도 제외되지만 등록된 경로는 2개뿐이다.
- `be/src/routes/metrics.ts:18`: CPU% 100 상한 제거 — 표시 값 변경, 보안 영향 없음.

## 노출

AWS 기준. onprem · GCP 구성은 레포에 있지만 브리프 선호 대상이 AWS라 기준이 아니다. **굵게**는 이번 델타에서 바뀐 행.

| 서비스 | 외부 노출 | 이유 |
|---|---|---|
| ALB → demo-app-fe (nginx :3000, active/blue) | **예** (HTTPS 443) | 유일한 앱 공개 진입점. `deploy/values-fe.yaml:29-32`. WAF · ALB 접근 로그 없음. 변경 없음. |
| ALB → demo-app-fe-preview-auth (oauth2-proxy) → green FE 및 green BE `/api/` | **예, SSO 로그인 뒤** | 변경 없음(`previewAuth.routes`). green BE의 `/api/load/cpu`는 이 뒤에 있다. |
| demo-app-be (Fastify :8000) — `/api/*`, `/health` | **예 (FE 경유)** | 직접 Ingress 없음. `fe/nginx.conf:34-45`. prod `POST /api/chaos` 닫힘. **prod · test 모두 `POST /api/load/cpu` · `GET /api/load/config` 열림**(막는 문제 1). |
| **runtime-status (:8080, 네임스페이스마다 1개) — `GET /api/runtime`** | **예 (FE 경유, 인증 없음)** | **새 행.** `fe/nginx.conf:24-31`이 `runtime-status.<ns>.svc.cluster.local:8080`으로 프록시. BE 파드 목록 · 버전 · 사용량 공개(배포 뒤 3). 클러스터 안에서는 ClusterIP로 모든 파드가 접근 가능. RBAC은 그 네임스페이스 `pods list` · `metrics pods list` · `services get` 2개뿐. 이미지 digest 고정. `/healthz`는 프로세스 생존만. |
| demo-app-be `/metrics`, FE 사이드카 :4040 | 아니오 | 변경 없음. |
| Grafana `https://onetatchi.soulee.dev/grafana` | **예, 익명 Viewer** | 변경 없음(배포 뒤 8). |
| 중앙 지표 수신 `https://metrics.onetatchi.soulee.dev` | **예, basic auth** | 변경 없음. |
| Cognito Hosted UI | **예** (로그인 화면만) | **콜백 URL에 gcp 미리보기 호스트 2개 추가**(`infra/envs/aws/variables.tf:98-105`) — 총 6개 호스트가 같은 User Pool 클라이언트를 쓴다. |
| **GKE Ingress → gcp green 미리보기(oauth2-proxy)** `green-yolo-gcp.` · `green-gcp.onetatchi.soulee.dev` | **예, SSO 로그인 뒤** (HTTPS만, `allow-http: false`) | **새 행.** 고정 IP `136.68.9.51` · `136.68.177.7`(`variables.tf:111-114`) ← Route53 A(`main.tf:155-163`). ManagedCertificate. 시크릿은 GCP Secret Manager `demo-app-preview-oauth2-proxy` → External Secrets. 선호 대상 아님, 미실측. |
| RDS PostgreSQL 17 (prod) | 아니오 | 변경 없음. |
| 온프레미스 Postgres(맥북 k3d) ← test BE | 아니오 (tailnet만) | NetworkPolicy 허용 대상이 **BE 파드 + `batch.kubernetes.io/job-name=demo-app-be-migration` Job 파드**로 늘었다(`main.tf:277-280`). 다른 네임스페이스 · 파드는 여전히 거부. |
| Tailscale operator, EKS API(IAM), Secrets Manager, Slack 봇, Argo Rollouts, green smoke | 변경 없음 | — |
| docker-compose postgres :5432 | 로컬만 | 변경 없음. |

Ingress는 FE(+ oauth2-proxy)만 켠다 — 맞게 돼 있다. 이번에 새로 공개된 것은 **CPU 부하 API**와 **파드 인벤토리 API**이며 둘 다 FE 프록시 뒤 인증 없음. BE 사이의 내부 서비스(runtime-status)는 Ingress 없이 FE가 프록시하는 구조라 "내부 API는 노출하지 않는다" 원칙 자체는 지켜졌지만, 프록시가 열어 주는 경로에 인증이 없다는 점은 같다.

## 규제

- 데이터 보관 위치 제한: **없음**(이전과 같음). prod 데이터는 서울 리전 RDS. test 데이터는 온프레미스(맥북 k3d, 국내 전제). gcp 미리보기는 **인증 중계와 green 화면**만이고 앱 데이터(DB)는 gcp 루트의 Cloud SQL(선호 대상 아님)에 있던 그대로 — 이번 변경으로 AWS 데이터가 gcp로 가지는 않는다. runtime-status는 Kubernetes API의 파드 메타데이터 · 사용량만 다룬다(개인정보 없음).
- 인프라가 제공해야 하는 설정(AWS, `regulated`):
  - **운영 관문**: 구조 변경 없음 — platform `deploy.yml@v2.17.0`도 `gate → publish → approve(prod environment) → deploy(prod-auto)` 순서다. T39 matrix 뒤에도 `approve`가 대상마다 실행되고(run 38107769329 `prod (aws) / approve` 대기), test 전용 값만 바꾼 T17 push는 `prod_common` 필터로 prod job 자체가 돌지 않았다(run 38107790313 `prod` skipped — #86 설계대로). **여러 대상이면 승인도 대상 수만큼 생긴다**(각 `prod (<label>) / approve`) — 감사 기록이 대상별로 나뉘고, 한 대상만 승인하고 다른 대상을 거절하는 것도 가능하다(의도된 동작, ADR-0020).
  - **저장 데이터 암호화**: 변경 없음(prod RDS 충족, test 온프레미스는 디스크 암호화 레포 밖).
  - **전송 구간 암호화**: 변경 없음 + gcp 미리보기는 HTTPS 강제(ManagedCertificate, `allow-http: false`). FE → runtime-status는 클러스터 안 HTTP(:8080) — 파드 메타데이터만이라 허용.
  - **비밀값 관리**: 변경 사항은 gcp oauth2-proxy 시크릿 복제(배포 뒤 10-a). Terraform은 빈 시크릿만 만들고 값은 사람이 넣는다 — 이전 Tailscale · onprem DB 자격증명과 같은 방식, 교체 주기 없음. runtime-status는 projected SA 토큰을 요청마다 다시 읽어 회전을 따른다(`server.mjs:15-16`).
  - **백업 보존**: 변경 없음.
  - **접근 로그**: 변경 없음. `/api/load/cpu` · `/api/runtime` 호출은 FE nginx access log(stdout → CloudWatch)와 BE 로그(`LOG_LEVEL: warn`이라 요청 로그 없음)에 남는다 — 부하 API 남용을 사후 추적하려면 nginx 로그뿐이다.
  - **네트워크**: NetworkPolicy는 DB 통로 egress 프록시에만 있고 앱 파드 간 정책은 여전히 없다. runtime-status가 생기면서 "네임스페이스 안 어느 파드든 다른 서비스를 부른다"의 사례가 하나 늘었다(배포 뒤 3). 자동 확장 상한(파드 6 · 노드 5)은 비용 상한이기도 하다(막는 문제 1).
  - **인증 · 접근 통제**: 변경 없음(승인자 SSO, MFA 꺼짐, Grafana 익명).
  - **삭제 · 보존**: 변경 없음.
- 브리프 답변과 코드 발견의 불일치:
  - "민감 데이터 **예**" ↔ 데이터 모델 변경 없음, `regulated` 유지. **새 불일치**: `regulated` 환경의 prod에 인증 없는 CPU 소모 API(막는 문제 1)와 파드 인벤토리 공개(배포 뒤 3)가 생겼다. 둘 다 시연 편의 기능이라 `none`은 제안하지 않고, prod에서는 끄거나 SSO 뒤로 옮기는 쪽으로 좁힌다.
  - "월 10만 원 이하" ↔ 공개 부하 API가 HPA · Cluster Autoscaler를 통해 **외부인이 비용을 올릴 수 있는 경로**가 됐다. 예산 분석기가 노드 상한 비용을 `aws-nodes-max` 대안으로 산정해 두었으므로 승인자는 그 수치로 수용 여부를 정한다.
  - "가용성 시연용" ↔ 부하 API · runtime-status 모두 시연 기능. 맞는 선택이지만 prod에서 상시로 켤 이유는 없다.
  - "선호 대상 AWS" ↔ 유지. gcp 미리보기 · T39 다중 대상은 부가 기능이고 gcp publish는 아직 실패 상태.
  - `.trivyignore`: **변경 없음**, **새로 넣을 예외 없음** — lockfile · IaC · Dockerfile HIGH 0건. 파이프라인 `iac-scan` · `vuln-scan` · `image-scan` 전부 성공(run 38107790313 · 38107769329).

## 확인 못 한 것

- **`/api/load/cpu` 한 건의 실제 CPU 시간**(sha256 30,000회) — 실행 · 측정하지 않았다. 파드당 워커 1개라 "파드당 1코어 상한"은 코드로 확정되지만, 요청당 ms는 추정이다. HPA가 실제로 6까지 가는지, Cluster Autoscaler가 몇 대를 더 띄우는지는 prod에서 재현하지 않았다.
- **t3.medium의 `cpu_credits`(unlimited 여부)** — `modules/cluster/aws@v2.11.0` 노드 그룹 설정을 이번에 읽지 않았다. unlimited면 버스트 초과분이 추가 과금된다.
- **runtime-status 이미지(`ghcr.io/…/runtime-status@sha256:…`)의 OS 패키지 취약점** — 로컬 pull 금지. platform CI가 검사한다고 README에 적혀 있으나(`runtime-status/README.md:73`) 이 레포 파이프라인의 `image-scan`은 앱 이미지(be · fe)만 본다 — 차트 · 모듈로 들어오는 서드파티 이미지 미검사는 이전과 같고 대상이 하나 늘었다.
- **runtime-status 설치가 prod에서 성공하는지** — test는 run 38107769329 `test (aws) / deploy` 성공(설치 스크립트가 그 job 안에 있음)으로 간접 확인. prod는 승인 대기 중.
- **gcp green 미리보기 실측**(로그인 성공 · 미할당 사용자 거부 · ManagedCertificate 발급) — gcp publish가 실패해 배포 자체가 안 됐다(run 38106825277). `GCP_CLUSTER` 변수 · WIF 설정은 레포 밖.
- **gitleaks** 미실행(미설치). 패턴 grep으로 대신했고 파이프라인 `secret-scan` 성공. **osv-scanner** 없음.
- **trivy DB 최신 여부** — 이번 실행에서 DB 갱신(`mirror.gcr.io/aquasec/trivy-db`)이 시간 초과로 실패해 캐시된 DB(이전 분석 때 받은 2026-10-10자)로 검사했다. 파이프라인 `vuln-scan`이 최신 DB로 다시 본다.
- 이전 분석의 미확인 항목(GitHub `prod` · `prod-auto` environment 설정, Grafana 익명 Explore, tailnet ACL, 맥북 디스크 암호화, Secrets Manager 작성자 · 교체 이력, 서드파티 이미지 취약점, Identity Center MFA, ALB SG, `rds.force_ssl`)은 그대로다.
- `.deploy/report.md` · `plan.yaml`과 이 문서의 정합은 보지 않았다(요청 범위 밖).

## 가정

- **`POST /api/load/cpu`는 "인증 없는 관리 기능"이 아니다**: 관리 기능을 "상태 · 설정을 바꾸거나 권한 있는 동작을 하는 기능"으로 읽었다(장애 주입 `POST /api/chaos`가 그 예). 부하 API는 입력이 enum 3개로 고정되고 응답이 고정 checksum이라 서비스 자원 소모 외의 효과가 없다. 그래서 test 배포는 막지 않되 prod 승격 전 결정 사항으로 올렸다. 스킬 사용자가 "외부인이 비용을 올릴 수 있는 공개 엔드포인트"를 막는 기준으로 본다면 1번은 막는 문제가 된다.
- **파드당 CPU 소모 상한은 워커 1코어 + 메인 스레드 약간**: `CpuPool`이 워커를 하나만 만들고(`dispatch()`가 `this.worker` 재사용) 대기열 8을 넘기면 429를 돌려준다는 코드 읽기에 근거. 실행으로 확인하지 않았다.
- **`/api/runtime` 응답에 비밀값이 없다**: `podView()`가 허용 필드만 재구성하고 원본 spec · env · Secret을 돌려주지 않는다는 코드 읽기(`runtime.mjs:35-56`)와 platform README의 설계 기술에 근거. 파드 이름 · 버전 · 재시작 수는 정찰 정보로 보고 "배포 뒤"에 뒀다.
- **gcp 고정 IP · 미리보기 호스트 · Cognito Pool ID · Secrets Manager ARN은 비밀값이 아니다**: 모두 DNS · 인프라 식별자이고, 이 값만으로는 인증 · 시크릿 읽기가 되지 않는다.
- **`.gitleaksignore`의 예외는 정당하다**: 특정 커밋 · 파일 · 규칙 · 줄 하나로 한정된 fingerprint이고 대상이 이 분석 문서의 산문이다. 전체 규칙을 끄지 않는다.
- **마이그레이션 Job 라벨 허용은 통제 약화가 아니다**: `batch.kubernetes.io/job-name`은 Job 컨트롤러가 붙이고, 같은 이름의 Job을 test 네임스페이스에 만들려면 그 네임스페이스의 Job 생성 권한이 필요하다 — 그 권한이 있으면 BE 파드 라벨도 흉내 낼 수 있으므로 위협 모델이 같다.
- **맥북은 국내에 있다**, **"민감 데이터 예"는 방명록 자유 텍스트를 가리킨다**, **test의 `CHAOS_ENABLED=true`는 수용한다**, **Grafana 익명 공개는 platform의 의도다**, **platform 태그 내용이 배포에 쓰이는 것과 같다**(`git show v2.17.0:…`, OCI 차트 2.17.0이 그 태그와 같다고 본다): 이전과 같다.
- **trivy 결과 신뢰 범위**: 캐시된 DB(갱신 실패), 대상은 lockfile 2개 · Terraform 루트(`.terraform` 캐시 포함 모듈까지 0건) · Dockerfile 2개. 이미지는 파이프라인에 맡긴다.
