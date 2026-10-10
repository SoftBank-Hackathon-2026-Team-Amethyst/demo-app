# 트래픽 분석

분석일: 2026-10-11 (yolo 재검증, 기준 커밋 951feac)

브리프: 하루 이용자 0~100명(상한 100명으로 계획), 가용성 `demo`(시연용), 선호 대상 **AWS**, 월 예산 10만 원 이하, 민감 데이터 취급(`regulated`). 직전 분석(2026-10-10, 기준 커밋 b8bc6d8, yolo 커밋 6b48d77)이 있어 **그 이후 변경(`git diff 6b48d77..HEAD -- deploy infra`, 21개 파일)만 델타 재검증**했다. 앱 코드(`be/`, `fe/`, `db/`)는 변경이 없다(`git diff --stat 6b48d77..HEAD -- be fe db` 0건).

## 재검증 요약 (6b48d77 → 951feac)

**직전 분석의 사이징 결론이 뒤집혔다.** 직전 분석과 `.deploy/plan.yaml`은 "시연 기능(장애 주입 · `/api/metrics` · 메모리 폴백)이 파드별 메모리라 **aws replicas 1**"을 전제했는데, PR #79(T29)가 그 사이 BE를 `replicas: 2` + HPA(2~6, CPU 70%)로 바꿨고 `deploy/aws/values.yaml`의 `replicas: 1`을 지웠다. 이 값 파일이 지금 test · prod에 올라가 있는 실제 상태이므로, 이번 분석은 **현재 값(BE 2 + HPA)을 기준**으로 부하 · 파드 슬롯 · 노드 수용량을 다시 계산하고, 파드별 상태가 갈리는 영향은 "주의"로 남긴다. `.deploy/plan.yaml`은 아직 `aws: 1`이라 **값 파일과 어긋나 있다** — 종합 단계가 바꿔야 할 값을 맨 끝 "plan.yaml 반영값" 절에 적었다.

| 변경 | 파일 | 부하 · 크기에 미치는 영향 | 결론 |
|---|---|---|---|
| **T29 BE 자동 확장** #79 | `deploy/values-be.yaml` `replicas: 2`, `autoscaling {enabled, min 2, max 6, CPU 70%}`, `resources` 명시(100m/128Mi/256Mi) | BE 파드가 환경당 상시 2개, 부하 시 최대 6개. 차트 기본값에 맡기던 자원이 값 파일에 고정됐다(HPA 분모) | **사이징 결론 변경** (아래 전부) |
| `deploy/aws/values.yaml`에서 `replicas: 1` 삭제 #79 | `deploy/aws/values.yaml` (주석만 남음) | AWS는 공통 값(BE 2 + HPA, FE 1)을 그대로 쓴다 | 변경 |
| FE `replicas: 1` · `autoscaling.enabled: false` 명시 #79 | `deploy/values-fe.yaml` | 이전엔 공통 파일에 replicas가 없어 "차트 기본 2 / aws 1 / onprem 1"이었다. 지금은 **모든 대상 1**로 고정 | 변경 (default 2 → 1) |
| onprem `autoscaling.enabled: false` 추가 #79 | `deploy/onprem/values.yaml` (`replicas: 1` 유지) | 맥북 k3d는 BE · FE 모두 1, HPA 없음 | 변경 없음 |
| **노드 자동 확장** #79 | `infra/envs/aws/main.tf:85` `node_count = {min 3, desired 3, max 5}` (이전 max 3), 모듈 v2.11.0(Metrics Server + Cluster Autoscaler, `infra/envs/aws/README.md`) | Pending 파드가 생기면 t3.medium을 최대 5대까지 늘린다. 파드 슬롯 한도가 51 고정에서 **51~85 가변**이 됐다. Metrics Server · Cluster Autoscaler 파드 2개가 kube-system에 추가된다 | 노드 수용량 재계산 |
| **T33 test DB를 온프레미스로** #69 #81 | `infra/envs/aws/main.tf` `module.db_link`, `variables.tf` `db_link = { test = ... }`, service_base가 test에는 tailnet 주소를 넘김 | **AWS test 환경의 BE는 RDS가 아니라 맥북 k3d Postgres를 Tailscale로 쓴다.** RDS는 prod 전용이 됐다. 쿼리마다 WAN 왕복이 붙고, NetworkPolicy로 test BE 파드만 통로를 쓴다. tailscale 네임스페이스에 operator + 프록시 파드가 추가된다 | DB 부하 · 커넥션 분리, 파드 슬롯 +2 |
| CHAOS_ENABLED를 test 전용으로 #74 | `deploy/values-be.test.yaml` `CHAOS_ENABLED: "true"` (prod에는 없음) | prod에서 `POST /api/chaos`가 등록되지 않는다(`be/src/routes/chaos.ts:33`). 장애 주입 · 부하 생성기 흐름은 **test에서만** 돈다. prod 피크에서 "부하 생성기 180 req/s" 성분이 빠진다 | prod 피크 하향, test 피크 유지 |
| T31 green 미리보기 routes · onprem Named Tunnel #65 #82 | `deploy/values-fe.yaml` `previewAuth.routes`, `deploy/onprem/values.yaml` `previewAuth.remoteKey`, `infra/envs/onprem/main.tf` green 터널 | green 화면의 `/api/`가 green BE(`demo-app-be-preview`)로 바로 간다. 승인자 탭 부하가 green 파드로 가는 구조는 그대로. onprem도 미리보기가 켜져 oauth2-proxy 파드 1개가 환경당 생긴다 | 파드 슬롯(onprem) +2, 부하 영향 없음 |
| 템플릿 v2.2.1 → v2.12.0, 승인 시간 초과 취소(T6), test 전용 값 변경은 prod 생략(#86) | `.deploy/config.yaml`, `.github/workflows/*.yml` | 파이프라인 동작. 자원 · 부하 무관. #86으로 `values-be.test.yaml`만 바꾼 push는 prod 배포를 건너뛴다 | 없음 |
| BE · FE · DB 코드 | `be/src/**`, `fe/src/**`, `db/init.sql` | **변경 없음.** 폴링 주기(`App.tsx:250, 294, 393`), 커넥션 풀 `max: 5`(`be/src/db/index.ts:37`), `HEALTH_TTL_MS = 3000`(`:59`), chaos · metrics 파드별 싱글톤 모두 그대로 | 탭당 부하 수치 유지 |

**결론: 탭당 부하 · 자원 요청값은 그대로지만, replicas · HPA · 노드 범위 · DB 분리가 바뀌어 `changed_since_previous: true`.** 현재 값은 100명/일 · 시연 범위를 여유 있게 수용하고, 3대 노드로 평상시와 통상 Blue-Green을 버틴다. 다만 (1) 장애 주입 상태가 파드별로 갈리고, (2) RDS 커넥션 설계 최대치가 22 → 61로 올라가며, (3) test 부하 생성기와 배포가 겹치면 Cluster Autoscaler가 4대째 노드를 띄울 수 있다(비용).

## 예상 부하

이 앱의 부하는 **하루 이용자 수가 아니라 동시에 열려 있는 브라우저 탭 수**에 비례한다. 프런트엔드(`fe/src/App.tsx`)가 화면을 열어 둔 동안 계속 폴링하고, 관리자 패널의 부하 생성기는 탭 하나가 초당 최대 60회 요청을 만든다. 이 구조는 b8bc6d8 이후 바뀌지 않았다.

### 탭 1개가 만드는 기본 부하 (`fe/src/App.tsx`, 951feac 기준 재확인)

| 호출 | 주기 | 탭 1개당 | BE 처리 | DB 쿼리 |
|---|---|---|---|---|
| `GET /api/info` | 1초 (`App.tsx:250`), 3.5초 abort | 1.0 req/s | 메타데이터 + `checkDbHealth()` | 파드당 ≤ 0.33/s (`SELECT 1`, 3초 TTL 캐시) |
| `GET /api/metrics` | 1초 (`App.tsx:294`) | 1.0 req/s | 인메모리 60초 윈도 집계 | 없음 |
| `GET /api/votes` · `GET /api/guestbook` | 3초 (`App.tsx:393`) | 0.67 req/s | 3행 SELECT, `ORDER BY created_at DESC LIMIT 50` | 2회 |
| `GET /api/chaos` | 열 때 1회 | — | 인메모리 상태 | 없음 |
| `POST /api/votes/:id`, `POST /api/guestbook` | 사용자 행동 | 방문당 1~2회 | UPDATE / INSERT | 1회 |

- 탭 1개 ≈ **2.67 req/s, DB 쿼리 0.67/s** — 변경 없음.
- 하루 총량: 100명 × 5분 체류 × 2.67 req/s ≈ **8만 req/일**, 평균 0.9 req/s. 쓰기는 하루 200건 미만.
- 모두 수 ms급 단순 쿼리. N+1 · 무거운 계산 없음.

### 관리자 패널이 만드는 합성 부하 — 이제 test 환경에서만

| 기능 | 선택지 | 부하 특성 | 환경 |
|---|---|---|---|
| 트래픽 부하 생성기 (`loadRps`, `App.tsx:352`) | 0 / 10 / 30 / 60 RPS | 브라우저가 `GET /api/votes`를 쏜다. 탭당 최대 60 req/s = DB 60 q/s. **CHAOS_ENABLED와 무관하게 어느 환경에서든 켤 수 있다**(프런트 전용 기능) | test · prod |
| 지연 · 에러율 · DB 단절 주입 (`POST /api/chaos`) | — | `values-be.test.yaml`에만 `CHAOS_ENABLED: "true"`. prod는 POST 라우트가 등록되지 않아 UI가 비활성(`chaos.enabled === false`, `App.tsx:924`) | **test만** |

### HPA와 파드별 상태 — 주의

BE가 환경당 2개 이상이고 HPA가 늘리고 줄인다. 시연 기능 세 가지가 **파드별 인메모리**인 사실은 그대로다(`be/src/routes/chaos.ts:3` "파드마다 따로 있다", `metrics.ts:4` "파드 1개 기준", `db/index.ts:22` `memoryFallback`). 영향을 기능별로 나누면:

| 기능 | 파드 2개 이상일 때 | 심각도 |
|---|---|---|
| **장애 주입 (`chaosState`)** | `POST /api/chaos`는 Service 라운드로빈으로 **파드 하나**에만 적용된다. 이후 `GET`은 매번 다른 파드가 답하므로 관리자 패널의 상태 표시가 켜짐/꺼짐 사이를 오가고, 지연 · 에러율은 요청의 1/N에만 걸린다. HPA가 늘린 새 파드는 깨끗한 상태로 시작하고, 줄인 파드의 상태는 사라진다. **test 환경 전용이지만 장애 훈련(T36)이 이 경로를 쓴다** | 높음 (test) |
| **`/api/metrics` 집계** | FE가 이미 **파드별로 받아 합산**한다(`App.tsx:257-282`, `hostname` 키, `POD_TTL_MS = 6000`). 파드 2개면 1초 폴링으로 각 파드를 평균 2초마다 보므로 합계 RPS 차트가 맞는다. **파드가 6개면 평균 6초마다 보여 TTL 경계에서 파드가 나타났다 사라지는 깜빡임**이 생길 수 있다 | 낮음 (2개) · 중간 (6개) |
| **메모리 폴백** | DB 단절 주입(test) 또는 실제 DB 장애 때 파드마다 폴백 데이터가 따로 쌓여 투표 수 · 방명록이 요청마다 달라 보인다 | 중간 |

구조 해결(상태를 Redis 등으로 공유, 또는 chaos POST를 모든 파드에 전파)은 앱 수정이라 이번 범위 밖이다(확장 계획 4단계). **값 파일만으로 되돌리려면** `deploy/values-be.test.yaml`에 `replicas: 1`, `autoscaling.enabled: false`를 넣어 test만 1개로 두는 방법이 있다 — 그러면 T29의 "test 부하로 HPA 증가 관찰"(`infra/envs/aws/README.md`) 검증과 충돌하므로 종합 단계가 어느 쪽을 택할지 정한다. 이 분석은 **현재 값(2 + HPA)을 기준**으로 둔다.

### HPA 동작 추정

- 분모: `resources.requests.cpu: 100m`, 목표 70% → 파드 평균 **70m**를 넘으면 늘린다. 요청당 BE CPU 1ms 미만(가정) 기준 파드당 약 70 req/s가 확장 문턱이다.
- 평상시(탭 30개 폴링 80 req/s, 파드 2개): 파드당 40 req/s ≈ 40m → 40% → **2개 유지**.
- test 부하 생성기 60 RPS × 3탭(180 req/s) + 폴링 80 = 260 req/s: 파드 2개면 130m/파드 → HPA 목표 복제 수 = ceil(2 × 130/70) = **4개** (300초 안정화 뒤 2개로 복귀). 이것이 README가 말하는 "test 부하를 올려 replicas 증가를 관찰"하는 시나리오다.
- 최대 6개에 닿는 부하: 약 420 req/s 지속(동시 폴링 탭 약 160개, 또는 60 RPS 부하 탭 6~7개). 그 위로는 파드가 CPU 한도 없이 노드 여유 CPU를 쓰므로 바로 실패하지는 않는다.
- 지연 주입은 CPU를 안 쓰고 에러율 주입은 CPU를 줄이므로 **HPA를 움직이지 않는다.** HPA를 움직이는 건 부하 생성기뿐이다.

### 피크 추정 (환경별로 분리)

| 환경 | 성분 | req/s | DB q/s | DB |
|---|---|---|---|---|
| **prod** | 청중 탭 30개 폴링 (30 × 2.67) + 헬스체크 · 수집 (< 1) | **≈ 80** | 30 × 0.67 ≈ **20** | RDS `db.t4g.micro` (prod 전용) |
| prod (부하 생성기를 prod에서 켜는 경우) | + 60 RPS × 3탭 | ≈ 260 | ≈ 200 | RDS |
| **test** | 청중 탭 30개 + 부하 생성기 60 RPS × 3탭 + 승인자 미리보기 탭 1~2개(green 파드 몫) | **≈ 265** | **≈ 200** | 맥북 k3d Postgres (Tailscale 경유, T33) |

- 직전 분석의 "BE 265 req/s · RDS 210 q/s"는 **test 피크**로 옮겨졌고, RDS는 prod만 받는다. prod에서 부하 생성기를 켜는 것은 막혀 있지 않으므로(프런트 전용) 보수적으로 RDS 피크는 200 q/s로 유지한다.
- **test DB 경로의 지연 — 주의.** AWS test BE → Tailscale → 맥북 Postgres는 쿼리마다 WAN 왕복(수십 ms, 가정)이 붙는다. 풀 `max: 5`로 파드당 처리량 상한은 약 5 / RTT (RTT 30ms면 ≈ 166 q/s). 부하 생성기 3탭(180 q/s)은 파드 1개의 상한에 걸리지만 HPA가 4개로 늘려 분산한다. `/api/info`의 DB 헬스는 3초 TTL 캐시라 폴링은 영향이 작다. 시연 체감 지연(p95)은 **test에서 prod보다 수십 ms 높게** 보인다 — 사이징이 아니라 연출 참고 사항.

정적 자산: 변경 없음(i18n 포함 약 290KB 비압축, gzip 80~100KB 추정). 100명/일 × 290KB ≈ 29MB/일.

## 병목 후보

1. ~~요청 로그 양~~ → 해결됨(`LOG_LEVEL: warn`, 유지).
2. **RDS 커넥션 설계 최대치가 올라갔다.** 파드당 풀 `max: 5`. prod BE가 HPA 최대 6개 × Blue-Green 2 = 12개면 60 + 마이그레이션 Job 1 = **61개**(직전 22개). `db.t4g.micro` max_connections ≈ 110 안이지만, **T33 db_link를 제거해 test를 RDS로 되돌리면 두 환경 합계 122개로 한도를 넘는다.** postgres.js는 동시 쿼리가 있을 때만 커넥션을 열어 실측은 훨씬 낮겠지만, 설계값으로는 다음 중 하나가 필요하다: (a) test를 RDS로 되돌릴 때 `maxReplicas`를 3으로 낮추거나, (b) 풀 `max`를 3으로 줄이거나(앱 수정), (c) RDS를 `db.t4g.small`(≈ 220)로 올린다. 지금 구성(test는 온프레미스 DB)에서는 **조치 불필요**.
3. **온프레미스 test DB 커넥션.** test BE 최대 12개 × 5 = 60개가 Tailscale을 거쳐 맥북 Postgres로 간다. 플랫폼 `database/onprem` 모듈의 max_connections는 로컬에 없어 확인 못 했다(Postgres 기본 100 가정). onprem 자체 test · prod 환경이 같은 맥북에서 각자 Postgres를 쓰므로 공유 문제는 없다.
4. **파드 슬롯 — 3대로는 "양쪽 환경 HPA 최대 + 동시 배포"를 못 버티고, Cluster Autoscaler가 받는다.** 아래 "노드 수용량" 참조. 슬롯 부족은 파드를 Pending으로 만들고 Cluster Autoscaler는 Pending을 보고 노드를 늘리므로 자동 복구되지만, 노드 합류에 2~4분(가정)이 걸려 그 사이 HPA가 요구한 파드는 뜨지 않는다. 가용성 `demo`에서 허용.
5. **파드별 상태 세 군데**(chaos · metrics · fallback) — 위 "주의" 절. replicas 2 + HPA의 전제와 충돌하는 유일한 항목.
6. **방명록 `created_at` 인덱스 없음** — 변경 없음. 10만 행 넘을 때 추가.
7. **지연 주입 중 `/api/info` 3.5초 abort** — 변경 없음, test만 해당.
8. **`/api/metrics` 파드 TTL.** `POD_TTL_MS = 6000`은 파드 2~3개를 전제한 값이다. HPA 6개에서 깜빡이면 FE 상수를 올리면 된다(앱 수정, 선택).

## 추천 크기

현재 값 파일을 그대로 추천값으로 둔다. 바꾸라고 권하는 값은 없다(주의 사항은 위 절과 확장 계획에).

| 서비스 | replicas (공통 / aws / onprem) | HPA | cpu 요청 | memory 요청 | memory 한도 |
|---|---|---|---|---|---|
| demo-app-be (Fastify, Node 22) | **2 / 2 / 1** | aws · gcp: **min 2 · max 6 · CPU 70%** (`values-be.yaml`), onprem: 끔 (`onprem/values.yaml`) | 100m | 128Mi | 256Mi |
| demo-app-fe (nginx-unprivileged, 정적 + 프록시) | **1 / 1 / 1** | 끔 (`values-fe.yaml`) | 50m | 32Mi | 64Mi |
| demo-app-fe-preview-auth (oauth2-proxy, 차트 생성) | 1 / 1 / 1 (aws · onprem 기본 기기, gcp 끔) | 없음 | 10m (차트 기본) | 32Mi | 64Mi |

- **BE replicas 2 + HPA 2~6**: T29가 넣은 값. 평상시 2개로 100명/일 피크(80 req/s)의 40%만 쓴다. 부하 생성기 시연 때 4개까지 늘고 300초 뒤 2개로 돌아온다. 자원은 차트 기본값과 같은 100m/128Mi/256Mi를 값 파일에 고정했으므로 HPA 분모가 차트 버전에 흔들리지 않는다. **유지.** 파드별 상태 문제는 "주의"로 남기고, 종합 단계가 test만 1개로 되돌릴지(`values-be.test.yaml`) 정한다.
- **FE replicas 1**: 공통 파일에 명시됐다. nginx 정적 + 프록시는 BE 요청 수를 그대로 통과시키지만 요청당 수십 µs라 1개로 265 req/s를 여유 있게 넘긴다. 파드 재스케줄 수십 초 중단은 가용성 `demo`에서 허용. **유지.**
- **onprem replicas 1 · HPA 끔**: 맥북 k3d. Metrics Server 유무를 확인하지 않았고(README "용량 검증 전까지 HPA를 끈다"), 단일 노드라 복제의 의미가 없다. **유지.**
- **gcp**: `deploy/gcp/values.yaml`에 replicas · autoscaling 덮어쓰기가 없어 BE 2 + HPA 2~6, FE 1이 그대로 적용된다. GKE는 Metrics Server가 기본이라 HPA는 동작한다. GCP 인프라는 v1.16.2 고정이라 노드 자동 확장은 이번 델타에 없다(모듈 기본값, 예산 분석기 참고).
- 마이그레이션 Job(`postgres:17`, `psql` 1회)은 차트 기본 자원 그대로.

### 노드 수용량 (AWS, 재계산)

입력: t3.medium 노드당 파드 17개, 3대 = 51슬롯(`infra/envs/aws/main.tf:85` min 3), Cluster Autoscaler가 Pending 파드에 맞춰 **최대 5대 = 85슬롯**. 시스템 · 애드온 파드 20~25개(가정) + T29 Metrics Server 1 + Cluster Autoscaler 1 = **22~27개**. 앱 쪽 상시 파드: Slack 봇 1, tailscale operator + 프록시 2(T33), oauth2-proxy 환경당 1 = 2.

| 상황 | BE | FE | 기타 상시 | Job | 앱 소계 | 시스템 포함 합계 | 필요 노드 |
|---|---|---|---|---|---|---|---|
| 평상시 (test · prod, HPA 최소) | 2 × 2 = 4 | 2 | 5 | 0 | 11 | **33~38** | 3대 (51) |
| 한 환경 Blue-Green 배포 중 | 4 + 2 = 6 | 3 | 5 | 1 | 15 | 37~42 | 3대 |
| 양 환경 Blue-Green 동시 (yolo test + main prod) | 8 | 4 | 5 | 2 | 19 | **41~46** | 3대 (여유 5~10) |
| test 부하 생성기(HPA 4) + test 배포 중, prod 평상시 | 4 + 4 + 2 = 10 | 3 | 5 | 1 | 19 | 41~46 | 3대 |
| test HPA 최대 6 + test 배포 중, prod 평상시 | 6 + 6 + 2 = 14 | 3 | 5 | 1 | 23 | 45~50 | 3대 (한계) |
| 양 환경 HPA 최대 6 + 동시 배포 (최악) | 24 | 4 | 5 | 2 | 35 | **57~62** | **4대** (68) |

- **결론: 3대로 평상시 · 통상 배포 · 부하 시연을 모두 버틴다.** 4대째 노드는 "양 환경이 HPA 최대인 채로 동시에 배포"처럼 시연에서 일어나기 어려운 조합에서만 뜬다. 다만 **test에서 부하 생성기를 최대로 켠 채 yolo 배포가 겹치면 45~50개로 한계에 닿아** 시스템 파드 수에 따라 4대째가 뜰 수 있다. 5대 상한(85)은 최악 조합(62)보다 넉넉하다.
- CPU · 메모리 요청 합계는 슬롯보다 한참 여유다: 최악 조합도 BE 24 × 100m + FE 4 × 50m + 기타 ≈ **2.9 vCPU / 3.9GiB** 요청으로, 3대 가용(ADR-0014 가정 4,700m / 7,168Mi) 안이다. **노드 확장을 부르는 것은 CPU가 아니라 파드 슬롯(ENI IP)**이다.
- 비용 측면(예산 분석기 참고): 평상시는 3대 그대로이고, 4대째는 조건부 · 일시적(Cluster Autoscaler 축소 지연 뒤 반납)이다. 월 예산 10만 원이 이미 초과 상태(직전 예산 분석)이므로 노드 1대 추가분(≈ 월 5만 원, 가정)은 "시연 중 몇 시간" 단위로만 계산하면 된다.

## DB 크기

- **AWS prod — RDS `db.t4g.micro`**(2 vCPU 버스트, 1GiB), gp3 20GB, 단일 AZ(`infra/envs/aws/main.tf:131-136`). **이제 prod만 쓴다**(T33). 피크 20~200 q/s(단순 쿼리)는 CPU 10% 안팎, 커넥션 설계 최대 61개(< ≈110). **가장 작은 클래스 유지.** 병목 2번의 조건(test를 RDS로 되돌림)이 생기면 그때 `maxReplicas` 또는 클래스를 조정한다.
- **AWS test — 온프레미스 맥북 k3d Postgres**(`db_link.test`, `demo-app-db-test.tailb7ed7e.ts.net`). 크기 선택 없음. 쿼리 지연은 Tailscale 경로에 좌우된다(위 "주의"). 맥북이 꺼지면 test BE는 메모리 폴백으로 동작한다 — smoke가 `database: connected`(`.deploy/smoke.json`)를 요구하므로 **맥북이 꺼진 동안 test 승격이 실패**한다. 사이징이 아니라 운영 의존성으로 종합 단계에 넘긴다.
- **온프레미스(onprem 대상)**: 클러스터 안 Postgres 17, 환경마다 1개. 커넥션은 환경당 최대 11개(BE 1 + green 1 → 10 + Job 1).
- 세 경로 모두 저장 용량보다 **커넥션 수**가 먼저 한계다. 계산식은 `BE 파드 수(HPA 최대 × Blue-Green 2) × 5 + Job`.

## 확장 계획

| 단계 | 조치 | 버티는 한계(추정) | 비용 | 상태 |
|---|---|---|---|---|
| 현재 | BE 2 + HPA 2~6(100m/128Mi), FE 1(50m/32Mi), 노드 3~5대 자동, prod RDS `db.t4g.micro`, test 온프레미스 DB, `LOG_LEVEL=warn` | HPA 6개 기준 약 **2,000~2,500 req/s**(동시 폴링 탭 약 800개). 그 전에 파드 슬롯 → 노드 4~5대로 자동 확장. 그보다 먼저 **test DB 경로(Tailscale RTT × 풀 5)**가 test 환경의 실질 상한 | 평상시 노드 3대, 피크 때 조건부 +1~2대 | 적용됨 |
| 1 | `LOG_LEVEL=warn` | — | 절감 | 완료 |
| 2 | ~~`replicas: 2`~~ → **T29로 2 + HPA 적용 완료.** 남은 조치는 파드별 상태 완화: (a) test만 `values-be.test.yaml`에 `replicas: 1`, `autoscaling.enabled: false`(장애 훈련 정확도 우선) 또는 (b) 현재 유지(HPA 시연 우선). 종합 단계 결정 | — | 없음 | **결정 필요** |
| 3 | 노드: 이미 자동(3~5대). 수동 조치는 `node_count.max`를 더 올리거나 `t3.large`(노드당 35 파드)로 교체 | 슬롯 85 → 그 이상 | t3.medium 1대 ≈ 월 5만 원 → 예산 초과 | 자동 적용 중 |
| 4 | 구조 변경: chaos · 메트릭 · 폴백 상태를 공유 저장소로(또는 chaos POST를 전 파드에 전파), 폴링 → SSE/WebSocket, `POD_TTL_MS` 상향, `guestbook(created_at)` 인덱스, 풀 `max` 조정, RDS `db.t4g.small` | 사용자 수가 브리프 상한의 10배를 넘거나, replicas 2 이상에서 시연 정확도가 필요할 때 | 별도 산정 | 보류 |

순서 원칙(replicas → 노드 → 구조)에서 1 · 2 · 3단계가 **이미 자동화됐다.** 100명/일 · 시연 범위에서 남은 결정은 2단계(test 파드 수)뿐이고, 사이징으로 당장 바꿀 값은 없다.

## plan.yaml 반영값 (종합 단계가 수정, 이 분석기는 건드리지 않음)

`.deploy/plan.yaml`은 `replicas: { default: 2, aws: 1, onprem: 1 }`(BE · FE 모두)과 "시연용: … 1이 전제" 주석을 갖고 있어 현재 값 파일과 어긋난다. 종합 단계가 아래로 맞춘다.

```yaml
services:
  - name: demo-app-be
    resources: { cpu: 100m, memory: 128Mi, memoryLimit: 256Mi }
    replicas: { default: 2, aws: 2, onprem: 1 }     # T29(#79): aws는 공통 값 그대로. 장애 주입 · 메트릭이 파드별 메모리라 test 시연 정확도는 주의
    autoscaling:
      default: { enabled: true, minReplicas: 2, maxReplicas: 6, targetCPUUtilizationPercentage: 70 }
      onprem: { enabled: false }
  - name: demo-app-fe
    resources: { cpu: 50m, memory: 32Mi, memoryLimit: 64Mi }
    replicas: { default: 1, aws: 1, onprem: 1 }     # values-fe.yaml에 명시(#79)
    autoscaling: { default: { enabled: false } }
nodes:
  aws: { instance_type: t3.medium, min: 3, desired: 3, max: 5, autoscaler: true }   # infra/envs/aws/main.tf:85, 모듈 v2.11.0
```

## 가정

- **체류 시간 5분/방문, 하루 방문 100회, 피크 동시 탭 30개, 부하 생성기 3탭 × 60 RPS**: 직전 분석과 같다(시연용 대시보드 · README "원터치 배포 시연용" · 브리프 `demo`).
- **폴링 수치 2.67 req/s/탭, DB 0.67 q/s/탭**: 951feac의 `fe/src/App.tsx:250, 294, 393`과 `be/src/db/index.ts:59`에서 재확인. 6b48d77 이후 `fe/src`, `be/src` 변경 0건.
- **요청당 BE CPU 1ms 미만**: Fastify 단순 JSON 라우트의 일반값. HPA 문턱(파드당 ≈ 70 req/s)과 목표 복제 수 계산이 이 값에 비례한다. 측정하지 않았다 — 배포 뒤 `kubectl top pod -n test`와 `kubectl get hpa -n test demo-app-be`(README T29 절)로 보정한다.
- **HPA 산식**: Kubernetes 표준 `desired = ceil(current × usage / target)`, 축소 안정화 300초(README). 차트가 HPA를 Rollout에 붙이는지, Blue-Green preview ReplicaSet이 stable과 같은 복제 수로 뜨는지는 App Chart v2.12.0 본문이 로컬에 없어 **Argo Rollouts 기본 동작(preview = spec.replicas)**으로 가정했다. 파드 슬롯 표의 "배포 중 ×2"는 이 가정이다.
- **Cluster Autoscaler 노드 합류 2~4분**: EKS 관리형 노드 그룹의 일반값. 측정하지 않았다.
- **AWS 시스템 · 애드온 파드 20~25개 + Metrics Server 1 + Cluster Autoscaler 1**: `cluster_addons/aws` · `observability` 모듈 구성에서 추정(직전 분석과 같은 범위, 예산 분석기의 ADR-0014 가정 "예약 25 파드"와 일치). 실제 수는 `kubectl get pods -A`로 확인한다(이번에 네트워크 명령은 실행하지 않았다).
- **tailscale 파드 2개(operator + 프록시)**: `modules/db_link/tailscale` v2.12.0 본문이 로컬에 없어 Tailscale Kubernetes operator의 일반 구성(operator 1 + consumed Service당 프록시 1)으로 가정했다.
- **oauth2-proxy는 환경당 Deployment 1개, 10m/32Mi/64Mi**: 직전 예산 분석이 App Chart v2.2.1 `preview-auth.yaml`에서 확인한 값. v2.12.0에서 바뀌었는지는 확인하지 못했다.
- **Tailscale 경유 쿼리 RTT 수십 ms(30ms 예시)**: 서울 리전 ↔ 국내 가정 네트워크의 일반값. DERP 중계로 떨어지면 더 길다. 측정하지 않았다 — test의 `/api/info` 응답 시간(`beats`)과 prod를 비교하면 바로 보인다.
- **`db.t4g.micro` max_connections ≈ 110**: RDS 기본 공식에 1GiB 대입. 온프레미스 Postgres는 기본 100 가정.
- **t3.medium 1대 ≈ 월 5만 원**: 서울 온디맨드 ≈ $0.052/h × 730h, 환율 1,350원 가정. 정확한 값과 조건부 노드의 시간 단위 계산은 예산 분석기 몫.
- **test 환경은 시연 중 거의 비어 있다**는 직전 가정은 **버렸다.** 장애 주입이 test 전용이 되면서 시연 부하의 중심이 test로 옮겨갔다. prod 피크는 폴링만(80 req/s)으로 두되, 부하 생성기가 prod에서도 켜질 수 있어 RDS는 200 q/s로 보수적으로 잡았다.

## 사이징 결과 (기계용)

```yaml
# 예산 분석기 · 종합이 읽는 최종 값. 단위는 App Chart 값과 같다.
# 2026-10-11 yolo 재검증(951feac): T29(#79)로 BE replicas · HPA · 노드 범위가 바뀌었다. 자원 요청값은 동일.
analyzed_at: 2026-10-11
base_commit: 951feac
previous_commit: b8bc6d8          # 직전 분석 기준 커밋 (yolo 커밋 6b48d77)
changed_since_previous: true      # replicas(BE 1→2+HPA, FE default 2→1) · 노드 max 3→5 · test DB 경로(RDS→onprem) 변경
plan_yaml_out_of_date: true       # .deploy/plan.yaml은 aws: 1 — 종합 단계가 위 "plan.yaml 반영값"으로 맞춘다
peak:
  prod_be_rps: 80           # 폴링만 (chaos POST는 prod에서 닫힘). 부하 생성기를 prod에서 켜면 260
  test_be_rps: 265          # 폴링 + 부하 생성기 3탭 + 승인자 미리보기 탭(green 몫)
  rds_qps: 200              # prod 전용(T33). 보수적으로 부하 생성기 포함
  onprem_test_db_qps: 200   # AWS test → Tailscale → 맥북 Postgres
  fe_bundle_kb: 290
services:
  - name: demo-app-be
    replicas: { default: 2, aws: 2, onprem: 2, gcp: 2 }   # onprem은 deploy/onprem/values.yaml이 1로 덮어씀 → 실효 1
    effective_replicas: { aws: 2, onprem: 1, gcp: 2 }
    autoscaling:
      aws:    { enabled: true, minReplicas: 2, maxReplicas: 6, targetCPUUtilizationPercentage: 70 }
      gcp:    { enabled: true, minReplicas: 2, maxReplicas: 6, targetCPUUtilizationPercentage: 70 }
      onprem: { enabled: false }
    resources: { cpu: 100m, memory: 128Mi, memoryLimit: 256Mi }   # values-be.yaml에 명시 (HPA 분모)
    per_pod_state: [chaosState, metrics_window, memoryFallback]    # 주의: replicas ≥ 2에서 파드별로 갈림. test에서만 chaos POST 열림
  - name: demo-app-fe
    replicas: { default: 1, aws: 1, onprem: 1, gcp: 1 }
    autoscaling: { enabled: false }
    resources: { cpu: 50m, memory: 32Mi, memoryLimit: 64Mi }
    extra_workloads:
      - { name: nginx-log-exporter, kind: sidecar }
      - { name: demo-app-fe-preview-auth, kind: deployment, replicas: 1, resources: { cpu: 10m, memory: 32Mi, memoryLimit: 64Mi }, targets: [aws, onprem] }
database:
  aws:
    prod:   { instance_class: db.t4g.micro, storage_gb: 20, multi_az: false, shared_by: [prod], design_max_connections: 61 }
    test:   { db_link: onprem, fqdn: demo-app-db-test.tailb7ed7e.ts.net, via: tailscale, design_max_connections: 61 }
  onprem: { in_cluster_postgres: true, per_environment: true, design_max_connections_per_env: 11 }
aws_nodes:
  instance_type: t3.medium
  pods_per_node: 17
  min: 3
  desired: 3
  max: 5                      # Cluster Autoscaler (platform v2.9.0+, infra 모듈 v2.11.0), Pending 파드 기준
  slots: { min: 51, max: 85 }
  system_pods_estimate: { min: 22, max: 27 }   # 애드온 20~25 + Metrics Server 1 + Cluster Autoscaler 1
aws_pod_slots:
  steady: { min: 33, max: 38 }                 # BE 4 + FE 2 + oauth2 2 + 봇 1 + tailscale 2 + 시스템
  both_envs_bluegreen: { min: 41, max: 46 }    # 3대 안
  test_hpa_max_plus_test_deploy: { min: 45, max: 50 }   # 3대 한계, 시스템 수에 따라 4대째 가능
  worst_case_both_hpa_max_both_deploy: { min: 57, max: 62 }   # 4대 필요 (68), 5대 상한 안
  expected_nodes: { steady: 3, peak_conditional: 4, hard_max: 5 }
hpa_estimate:
  scale_out_threshold_rps_per_pod: 70     # 100m × 70% ÷ 1ms/req (가정)
  demo_load_generator_target_replicas: 4  # 260 req/s, test
  max_replicas_reached_at_rps: 420
recommendations:
  - key: LOG_LEVEL
    value: warn
    where: deploy/values-be.yaml env
    status: applied
  - key: test-only replicas 1
    value: "replicas: 1, autoscaling.enabled: false"
    where: deploy/values-be.test.yaml
    status: decision_needed        # 장애 훈련 정확도(1) vs HPA 시연(2+HPA). 이 분석은 현재 값(2+HPA)을 기준으로 둠
    reason: chaosState · memoryFallback이 파드별 인메모리라 파드 ≥ 2에서 장애 주입이 1/N에만 걸림
  - key: RDS connections guard
    value: "test를 RDS로 되돌릴 때 maxReplicas 3 또는 풀 max 3 또는 db.t4g.small"
    where: deploy/values-be.yaml autoscaling / be/src/db/index.ts / infra/envs/aws/main.tf
    status: conditional            # 지금 구성(test=onprem DB)에서는 불필요
    reason: 두 환경 HPA 최대 × Blue-Green × 풀 5 = 122 > db.t4g.micro ≈ 110
```
