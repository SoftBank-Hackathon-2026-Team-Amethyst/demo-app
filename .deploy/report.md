# 분석 보고서

생성: 2026-10-11, `/yolo-deploy` 실행(deploy-analyze, yolo 모드, 기준 origin/main 55b1586). 2026-10-10 분석(b0d3df7)을 **부분 재사용**했다: 예산은 target · services(replicas · resources · DB) · `infra/envs/aws` 과금 자원 목록이 그대로라 재사용, 코드베이스 · 서비스 · 트래픽 · 보안은 T25(CPU 부하 API, 새 환경변수 `LOAD_TEST_ENABLED`) · T38(gcp green 미리보기) · T39(대상 matrix) 변경으로 다시 돌렸다. 상세는 `.deploy/analysis/*.md`, 브리프는 변경 없음.

## 추천

- **배포 대상: `aws`** (팀 공용 EKS `one-tatchi`, 서울 리전, RDS `db.t4g.micro`, ALB + HTTPS `onetatchi.soulee.dev`)
- 이유 한 줄: 브리프가 AWS를 선호하고, 민감 데이터 "예"에도 서비스 분석상 **사내 보관을 강제하는 데이터가 없다**(방명록 닉네임 · 자유 텍스트, 집계 숫자뿐). 국내 보관 요구까지는 서울 리전(`region == ap-northeast-2` validation)으로 충족한다. 클러스터 · RDS · CI 역할 · DNS가 이미 떠 있고 레포 변수 `DEPLOY_TARGET=aws`로 운영 중이다.
- 검토한 대안
  - `onprem`: 클라우드 비용 0원이지만 선호 대상이 아니고, 맥북 상시 가동과 재시작 때 바뀌는 Quick Tunnel 주소가 시연용 공개 주소로 불안정하다. state가 맥북에만 있다.
  - `gcp`: 구현체(T4)와 플랫폼 변수는 있으나 전체 비용이 AWS와 같은 자릿수(USD 310 이상)이고, 증분 · 무료 구간이 미산정이며 plan 계정의 Helm 조회 문제(`infra/T17-VALIDATION.md`)가 미해결이다.
- 예산: **초과(over)**. 월 10만 원 이하(≈ USD 74.5) 대비 AWS 전체 루트 확인 소계 USD 308.248 이상, 이 앱의 **증분만 따져도** USD 68.72 이상이다. 클라우드 후보 중 예산 안에 드는 것은 없다. 절감은 별도 견적이 없어 미산정이며, 검토 방향은 시연 시간 외 노드 축소 · ALB 묶기다(가용성 `demo`라 가능). T25 이후 `/api/load/cpu`가 HPA를 상한 6까지, Cluster Autoscaler를 4~5대째까지 밀 수 있어 **노드 비용 상한이 외부 입력에 좌우된다**(5대 상시 시나리오 +USD 79.568은 `analysis/alternatives/aws-nodes-max/`).

<!-- pricing-summary:start -->
### 예상 월 비용

- 배포 후보: AWS (demo-aws)
- 구성: 가정이 포함된 구성
- 전체 자원 비용: 확인된 소계 USD 308.248 이상 (상한 미정); 추가 비용 미정
- 앱 추가 증분: 확인된 소계 USD 68.72 이상 (상한 미정); 추가 비용 미정
- 전체 원화: 미산정
- 앱 추가 원화: 미산정
- 예산 비교 범위: 전체 비용
- 예산 초과: 알려진 비용 하한만으로도 예산 상한을 넘습니다.
- 절감액 미산정: 기준 또는 대안의 비교 범위가 완전하지 않습니다.
- 단가 조회/시도 시각 (UTC): 2026-10-09T14:06:30Z
- 입력·단가·계산 근거: 9caf1d1126e8 / e5af155ffc38 / b30ada7b3ed1
- 환율: USD 1 = 1,341.486704원; 기준일 2026-10-09; 출처 ECB EXR daily reference rates 2026-10-09 (data-api.ecb.europa.eu EXR/D.KRW.EUR.SP00.A 1503.27 ÷ EXR/D.USD.EUR.SP00.A 1.1206), 2026-10-11(KST) 재조회에서도 최신 관측이 2026-10-09(주말 미발표), 소수 6자리 반올림
- 미산정·확인 필요 항목: 월 사용량 또는 상한 미정; 앱 추가 사용량 또는 상관관계 미정

<!-- pricing-summary:end -->

## 인프라 구성

| 서비스 | 런타임 | 포트 | 헬스체크 | 외부 노출 | replicas (공통 / aws / onprem) | 자원 요청 / 한도 | DB |
|---|---|---|---|---|---|---|---|
| `demo-app-be` | Node 22 · Fastify 5.12 (pnpm, 3단계 Dockerfile, UID 1000) | 8000 | `/health`, `/healthz/liveness` | 아니오 (FE nginx가 `/api`, `/health` 프록시) | 2 / **2 (HPA 2~6, CPU 70%)** / 1 | 100m · 128Mi / 256Mi (CPU 한도 없음, 의도) | prod: RDS Postgres 17 · test: 맥북 k3d Postgres(T33 db_link, Tailscale). Secret `demo-app-db`, 마이그레이션 `db/init.sql` |
| `demo-app-fe` | Vite + React 19 → nginx-unprivileged (UID 101) | 3000 | `/` | 예 (aws: ALB Ingress + HTTPS, onprem: Quick Tunnel) | 1 / **1** / 1 | 50m · 32Mi / 64Mi | 없음 |

- 네임스페이스 `test` · `prod`, Blue-Green(승격은 Slack 버튼). aws test는 온프레미스 DB, prod는 RDS(T33). prod smoke의 INSERT는 prod DB에 남으므로 넣지 않는다.
- T29(#79)로 AWS BE가 `replicas: 2` + HPA(2~6)가 됐고 노드는 t3.medium 3~5대(Cluster Autoscaler). 파드별 인메모리 상태 3종(장애 주입 · 메트릭 버킷 · CPU Worker 큐)은 파드 ≥ 2에서 1/N에만 걸린다. T25 이후 파드 6개가 흔해져 test-only replicas 1 옵션은 비추천(트래픽 분석).
- T25(#106): `POST /api/load/cpu`(intensity light/medium/heavy)가 파드당 worker thread 1개 · 대기열 8(초과 429) · 2초 데드라인(초과 503)으로 CPU를 태운다. `GET /api/load/config`는 항상 등록된다. `LOAD_TEST_ENABLED: "true"`가 공통 `values-be.yaml`에 있어 **test · prod · onprem · gcp 모두 켜진다**.
- T31 · T38 미리보기: 릴리스마다 oauth2-proxy Deployment 1개(10m/32Mi)가 FE 옆에 추가되고 green은 Cognito SSO 뒤에만 열린다(aws · gcp). promote-judge smoke는 `svc/<release>-preview`에 port-forward로 직접 붙는다(ADR 0015).
- 템플릿 버전 표기는 v2.17.0 bump(#104)로 정합이 맞다(`check-artifacts.sh` 통과). `infra_versions.aws v2.11.0` · `gcp v1.16.2`는 고정 유지.

## 확장 계획

부하는 사용자 수보다 **열린 탭 수**에 비례한다(탭당 2.67 req/s: `/api/info` · `/api/metrics` 1초 폴링 + votes · guestbook 3초). 청중 30탭 ≈ 80 req/s, 관리자 패널 부하 생성기(60 RPS × 3탭) 포함 **피크 약 260 req/s**, DB는 3초 TTL 캐시 덕에 약 210 q/s. 현재 구성 한계 ≈ 800~1,000 req/s(동시 탭 300개).

T25 CPU 부하는 요청 수가 아니라 요청당 CPU(t3.medium 환산 ≈ 8/25/50 ms, 가정)로 HPA를 움직인다. 패널 기본값(10 RPS · medium)이면 BE 4개, 20 RPS · heavy면 **탭 1개로 1~2분 안에 상한 6개**에 닿고, 축소 안정화 300초 때문에 3분 테스트가 8분 이상 6개를 유지한다. 파드 수준 백프레셔(워커 1 · 대기열 8 · 2초 데드라인)가 있어 유계다. `limits.cpu`는 넣지 않는다(CFS 스로틀로 503만 늘고 HPA 비율에는 도움이 없다).

1. `LOG_LEVEL=warn` 적용됨(요청당 2줄 × 260 req/s → CloudWatch 비용 · CPU)
2. 파드 간 상태 공유(Redis 등) · SSE · `guestbook(created_at)` 인덱스 — 시연 기능이 파드별로 갈리는 문제의 근본 해결
3. 노드 추가(예산 초과). Autoscaler 4~5대째는 CPU 부하 + 배포 겹침에서 "가능"으로 바뀜

## 필요한 코드 수정

**배포에 필요한 수정: 없음.** T25 Worker는 읽기 전용 FS · `USER 1000` 조건을 충족하고 CJS 컴파일 경로(`dist/load/cpu-worker.js`)가 유효하다. 로컬 검사: be lint · test 14/14 · build, fe lint · build, 이미지 빌드 2개, `terraform fmt`(infra 변경은 origin/main 대비 없음 → init · validate 생략), `check-artifacts.sh` 통과.

이번 yolo push가 바꾸는 것:
1. `deploy/values-be.yaml` `APP_VERSION: v2.1.0 → v2.1.1`. 환경변수 하나만 바꾸는 배포 실측용 표식(`/api/info` `version`에 보인다). `changes` 필터(`deploy/values-*.yaml`) 통과용이기도 하다.
2. `.deploy/analysis/{codebase,service,traffic,security}.md` · 이 보고서 갱신. `plan.yaml` · `smoke.json` · `config.yaml`은 변경 없음.

**권장(사람 결정, 이번 push에 포함하지 않음)**
- a. `LOAD_TEST_ENABLED`를 `values-be.test.yaml`로 옮길지(T35 `CHAOS_ENABLED` 규약), 시연 뒤 false로 바꿀지, 유지할지. 보안 · 예산 관점은 아래.
- b. `be/src/load/cpu-pool.ts`의 Worker 경로가 `__dirname` 기반이라 `package.json`에 `"type": "module"`이 들어가면 `/api/load/cpu`가 503이 된다. 주석 또는 `import.meta.url` 경로 권장.
- c. smoke 선택 추가: `GET /api/load/config → 200`(본문 조건 없이), FE `GET /health → 200`. 플래그를 끄는 배포가 승격을 막지 않도록 `expect_body {"enabled": true}`는 넣지 않는다.
- d. 시연 중 승격 금지 원칙에 CPU 부하 포함(승격 때 blue `pool.close()`가 대기 작업을 503으로 거부, HPA 파드 2배).

## 보안 · 규제

- test 배포를 막는 문제: **없음.** prod 승격 전 권고 1건: **`POST /api/load/cpu`가 인증 없이 인터넷(FE nginx `/api/` 프록시)에 열려 있고 prod에도 켜져 있다**(`deploy/values-be.yaml` `LOAD_TEST_ENABLED`). `maxRps: 20`은 클라이언트에 알려주는 값일 뿐 서버 속도 제한은 없다. 상태 · 설정 · 데이터를 바꾸지 않고 피해 상한이 코드(워커 1 · 대기열 8 · 데드라인 2초) · HPA 6 · 노드 5대로 묶여 "인증 없는 관리 기능"은 아니지만, 비용 · 가용성 DoS 증폭 경로다(CORS `origin: true`로 브라우저 분산도 가능). 권고: test 값 파일로 이동 또는 IP 제한. 이미 PR #106 · prod 승인으로 의도된 결정임은 확인했다.
- 비밀값 커밋 0, lockfile HIGH 0(`trivy fs`), `pnpm audit` be moderate 2(esbuild, `drizzle-kit` devDependency · 런타임 이미지 밖) · fe 0, IaC HIGH 0 / MEDIUM 6(이전과 동일), `.trivyignore` 변경 없음.
- 이전 "막는 문제 2"(T33 NetworkPolicy가 마이그레이션 Job 차단)는 실제 발생 뒤 PR #90으로 해소됐다. prod 장애 주입은 T35로 해소 유지.
- T38: preview oauth2-proxy 시크릿이 AWS · onprem · GCP 세 곳에 복제돼 교체 절차에 영향. T39 `targets` 입력은 `case`로만 해석돼 주입 경로 없음.
- 접근 로그: BE `LOG_LEVEL: warn`이라 남용 IP는 nginx 로그에만 남는다. 값 파일 위치 규약(`deploy/values-*.yaml`은 CODEOWNERS 밖)에만 기대는 prod 차단은 T25에서 실제로 재현됐다.
- `compliance: regulated` 유지 → prod 반영은 사람 승인. yolo 경로의 `compliance` · CODEOWNERS 변경은 `config-guard`가 막는다.

## 가정

- 브리프 "민감 데이터 예"는 방명록 자유 텍스트에 개인정보가 들어올 수 있다는 뜻이며 사내 보관 요구가 아니다. 조직 정책으로 사내 보관이 필요하면 추천은 `onprem`으로 바뀐다.
- 단가는 2026-10-09T14:06:30Z 플랫폼 실조회를 `reuse-prices`로 재사용했다. 환율 ECB 2026-10-09 1,341.486704. 본 견적은 상시 노드 3대이고, 5대 상시 시나리오(+USD 79.568)는 `analysis/alternatives/aws-nodes-max/`에 따로 뒀다. Cognito MAU · GCP Monitoring read API · Tailscale 플랜 · T38 gcp 고정 IP · ManagedCertificate(gcp 대상 과금)는 aws 견적에 미반영.
- CPU 부하 요청당 비용은 맥북 M2 실측(3/9/18 ms)을 t3.medium 기준 1.5~3배로 환산한 추정이며 측정값이 아니다. HPA 추정치도 README T29 시나리오 기준.
- `.deploy/config.yaml`은 건드리지 않았다(템플릿 v2.17.0, #104).
