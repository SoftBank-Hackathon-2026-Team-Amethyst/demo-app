# 트래픽 분석

분석일: 2026-10-11 (yolo 재검증, 기준 커밋 55b1586)

브리프: 하루 이용자 0~100명(상한 100명으로 계획), 가용성 `demo`(시연용), 선호 대상 **AWS**, 월 예산 10만 원 이하, 민감 데이터 취급(`regulated`). 직전 분석(기준 커밋 951feac, 기록 커밋 b0d3df7)이 있어 **그 이후 변경(`git diff b0d3df7..HEAD`, 16개 파일)만 델타 재검증**했다. 이번에는 앱 코드가 바뀌었다: `be/src`에 CPU 부하 테스트 API(T25)가 들어왔고 `fe/src`에 그 조작 패널이 붙었다. 값 파일은 `deploy/values-be.yaml`의 `env`(APP_VERSION, `LOAD_TEST_ENABLED`)만 바뀌었고 replicas · HPA · resources는 그대로다.

## 재검증 요약 (b0d3df7 → 55b1586)

**사이징 값(replicas · HPA · resources)은 바꿀 이유가 없지만, 부하의 성격이 바뀌었다.** 직전까지 BE 부하는 "요청 수"였고 HPA(100m × 70%)를 움직이는 건 test의 부하 생성기(60 RPS × 3탭)뿐이었다. T25의 `POST /api/load/cpu`는 요청 하나가 **파드 안 worker thread에서 수십 ms CPU를 태우는** 엔드포인트라, 브라우저 탭 하나가 HPA를 바로 최대(6개)까지 끌어올린다. 그리고 `LOAD_TEST_ENABLED: "true"`가 **공통 값 파일**에 있어 test · prod · onprem · gcp 모두에서 켜진다(장애 주입 `CHAOS_ENABLED`와 달리 prod도 포함). 이 엔드포인트의 자원 사용은 파드당 worker 1개(≈ 1코어) · 대기열 8 · 2초 데드라인으로 **스스로 상한이 잡혀 있어** 현재 값으로 안전하다 — 상세는 "병목 후보 1".

| 변경 | 파일 | 부하 · 크기에 미치는 영향 | 결론 |
|---|---|---|---|
| **T25 CPU 부하 테스트 API** #106 | `be/src/routes/load.ts`, `be/src/load/cpu-pool.ts`, `be/src/load/cpu-worker.ts`, `be/src/index.ts` | `POST /api/load/cpu {intensity}`가 sha256 반복(light 5,000 / medium 15,000 / heavy 30,000회)을 worker thread에서 돈다. 파드당 worker 1개 + 대기열 최대 8(초과 429) + 요청당 2초 데드라인(초과 503, 풀 리셋). `/api/load/`는 chaos preHandler(지연 · 에러율 주입)를 건너뛴다 | **HPA 동작 · 노드 CPU 재계산** |
| `LOAD_TEST_ENABLED: "true"` 공통 값 | `deploy/values-be.yaml` env | test · prod · onprem · gcp 모두 등록. `false`면 `/api/load/cpu` 라우트 자체가 없다(`/api/load/config`만 남아 `enabled: false` 응답) | prod 피크에 CPU 부하 성분 추가 |
| FE CPU 부하 패널 | `fe/src/CpuLoadPanel.tsx`, `App.tsx`, `i18n.ts` | 탭당 5 / 10 / 20 RPS(서버 `maxRps: 20`), 1 / 3 / 5분(`maxDurationSec: 300`), 동시 요청 8개 초과 시 건너뜀, 4초 abort, 탭 숨김 · 패널 닫기 · 전체 초기화로 중지. 기본값 10 RPS · medium · 3분 | 탭당 CPU 부하 상한 ≈ 1코어 |
| `cpuPercent` 100% 상한 제거 | `be/src/routes/metrics.ts:19` | 프로세스 CPU에 worker thread가 포함돼 대시보드 파드 CPU가 100%를 넘을 수 있다(최대 ≈ 200%: main + worker). HPA 비율(요청 100m 기준)과는 다른 수치 | 표시만, 사이징 무관 |
| APP_VERSION v2.0.2 → v2.1.0 (작업 트리에는 yolo 커밋용 v2.1.1) | `deploy/values-be.yaml` | 없음. replicas · HPA · resources · LOAD_TEST_ENABLED는 작업 트리에서도 HEAD와 같다 | 없음 |
| **T39 배포 대상 matrix** #107 #108 #109 | `.github/workflows/deploy.yml`, `.github/scripts/deploy-targets.sh` | `DEPLOY_TARGETS`로 aws · gcp · onprem을 병렬 배포하고 모든 대상 test 통과 뒤 prod. **클러스터별** 파드 슬롯 · HPA 계산은 그대로(대상끼리 자원을 나누지 않는다) | 없음 |
| T33 onprem-wsl 대상 추가 #105 | `.github/workflows/deploy.yml`, `rollout.yml` | WSL 기기 검증용 보조 onprem 클러스터. `deploy/onprem/values.yaml`(replicas 1 · HPA 끔)을 같이 쓴다. green 미리보기는 끔 | 없음 |
| T38 gcp green 미리보기 · 템플릿 v2.17.0 | `deploy/gcp/values.yaml`, `infra/envs/gcp`, `infra/envs/aws/main.tf`(Route53 A), `.deploy/config.yaml` | gcp에도 oauth2-proxy 파드 환경당 1개. AWS 쪽은 DNS 레코드뿐, 파드 추가 없음 | gcp 파드 +2, AWS 영향 없음 |
| 폴링 · 커넥션 풀 · 파드별 상태 | `fe/src/App.tsx:250, 294, 393`, `be/src/db/index.ts:37, 59`, `routes/chaos.ts`, `routes/metrics.ts` | **변경 없음.** 탭당 2.67 req/s · DB 0.67 q/s, 풀 `max: 5`, `HEALTH_TTL_MS = 3000`, `POD_TTL_MS = 6000`, chaos · metrics · fallback 파드별 싱글톤 | 탭당 기본 부하 수치 유지 |

직전 분석(T29 · T33 · T35 · T31)의 결론 중 그대로인 것: BE는 환경당 2개 + HPA 2~6(CPU 70%), FE 1개, onprem은 둘 다 1개 · HPA 끔, 노드 t3.medium 3~5대(Cluster Autoscaler), AWS test의 DB는 맥북 k3d Postgres(Tailscale), RDS `db.t4g.micro`는 prod 전용, `CHAOS_ENABLED`는 test 전용, green 미리보기 `/api/`는 green BE로 직결. `.deploy/plan.yaml`은 직전 분석이 적은 반영값대로 **이미 맞춰져 있다**(`replicas: { default: 2, aws: 2, onprem: 1 }`, HPA 2~6, 노드 3~5) — 이번에 종합 단계가 고칠 사이징 값은 없다.

**결론: 자원 요청값 · replicas · HPA 범위는 유지(`changed_since_previous: true`는 부하 모델 변경 때문).** 100명/일 · 시연 범위에서 현재 값은 안전하다. 바뀐 점은 (1) HPA 최대 6개가 "일어나기 어려운 조합"에서 "탭 하나로 1분 안에 도달"로 바뀌어 파드 슬롯 표의 최악 조합(4대째 노드)이 시연 중 실제로 일어날 수 있고, (2) prod에서도 익명 방문자가 BE를 6개 × ≈ 1코어까지 끌어올릴 수 있으며(상한은 있음), (3) 축소 안정화 300초 때문에 부하를 멈춘 뒤에도 5분 이상 6개가 유지된다는 것이다.

## 예상 부하

이 앱의 부하는 **하루 이용자 수가 아니라 동시에 열려 있는 브라우저 탭 수**에 비례한다. 프런트엔드(`fe/src/App.tsx`)가 화면을 열어 둔 동안 계속 폴링하고, 관리자 패널의 부하 생성기(요청 수)와 CPU 부하 테스트(CPU 시간)는 탭 하나가 각각 초당 최대 60회 요청 · 약 1코어의 부하를 만든다.

### 탭 1개가 만드는 기본 부하 (`fe/src/App.tsx`, 55b1586 기준 재확인)

| 호출 | 주기 | 탭 1개당 | BE 처리 | DB 쿼리 |
|---|---|---|---|---|
| `GET /api/info` | 1초 (`App.tsx:250`), 3.5초 abort | 1.0 req/s | 메타데이터 + `checkDbHealth()` | 파드당 ≤ 0.33/s (`SELECT 1`, 3초 TTL 캐시) |
| `GET /api/metrics` | 1초 (`App.tsx:294`) | 1.0 req/s | 인메모리 60초 윈도 집계 | 없음 |
| `GET /api/votes` · `GET /api/guestbook` | 3초 (`App.tsx:393`) | 0.67 req/s | 3행 SELECT, `ORDER BY created_at DESC LIMIT 50` | 2회 |
| `GET /api/chaos` · `GET /api/load/config` | 열 때 1회 | — | 인메모리 상태 | 없음 |
| `POST /api/votes/:id`, `POST /api/guestbook` | 사용자 행동 | 방문당 1~2회 | UPDATE / INSERT | 1회 |

- 탭 1개 ≈ **2.67 req/s, DB 쿼리 0.67/s** — 변경 없음.
- 하루 총량: 100명 × 5분 체류 × 2.67 req/s ≈ **8만 req/일**, 평균 0.9 req/s. 쓰기는 하루 200건 미만.
- 모두 수 ms급 단순 쿼리. N+1 · 무거운 계산 없음(CPU 부하 API는 의도된 계산이라 아래에 따로).

### 관리자 패널이 만드는 합성 부하

| 기능 | 선택지 | 부하 특성 | 환경 |
|---|---|---|---|
| 트래픽 부하 생성기 (`loadRps`, `App.tsx:352`) | 0 / 10 / 30 / 60 RPS | 브라우저가 `GET /api/votes`를 쏜다. 탭당 최대 60 req/s = DB 60 q/s. 요청당 CPU 1ms 미만이라 HPA에는 60m 정도만 보탠다. 프런트 전용 기능이라 어느 환경에서든 켤 수 있다 | test · prod |
| **CPU 부하 테스트 (`CpuLoadPanel.tsx`, T25)** | 5 / 10 / 20 RPS × light / medium / heavy × 1 / 3 / 5분 | 브라우저가 `POST /api/load/cpu`를 쏜다. **요청 수는 작지만 요청마다 파드 worker thread가 CPU를 태운다.** 탭당 CPU 상한 ≈ 20 req/s × heavy 50ms = **1코어**. 동시 요청 8개 초과는 보내지 않고(skipped), 탭 숨김 · 패널 닫기에 멈춘다. DB를 쓰지 않는다 | **test · prod · onprem · gcp** (`LOAD_TEST_ENABLED` 공통 값) |
| 지연 · 에러율 · DB 단절 주입 (`POST /api/chaos`) | — | `values-be.test.yaml`에만 `CHAOS_ENABLED: "true"`. prod는 POST 라우트가 등록되지 않아 UI가 비활성 | **test만** |

CPU 부하 요청 한 건의 비용(가정, 로컬 측정 M2 Node 24: light 3 / medium 9 / heavy 18ms, t3.medium은 약 2.5배로 잡음):

| intensity | 반복 | CPU/요청 (t3.medium 가정) | 파드당 처리 상한 (worker 1개, 대기열 8) | HPA 문턱(파드당 70ms CPU/s)에 닿는 요청률 |
|---|---|---|---|---|
| light | 5,000 | ≈ 8 ms | ≈ 125 req/s | ≈ 9 req/s/파드 |
| medium | 15,000 | ≈ 25 ms | ≈ 40 req/s | ≈ 3 req/s/파드 |
| heavy | 30,000 | ≈ 50 ms | ≈ 20 req/s | ≈ 1.4 req/s/파드 |

### HPA와 파드별 상태 — 주의 (변경 없음)

BE가 환경당 2개 이상이고 HPA가 늘리고 줄인다. 시연 기능 세 가지가 **파드별 인메모리**인 사실은 그대로다(`be/src/routes/chaos.ts:3`, `metrics.ts:4`, `db/index.ts:22` `memoryFallback`). CPU 부하 풀(`CpuPool`)도 파드별이지만 이건 의도된 설계다(`cpu-worker.ts` 주석: "replicas를 늘리면 같은 총 CPU 수요가 분산된다").

| 기능 | 파드 2개 이상일 때 | 심각도 |
|---|---|---|
| **장애 주입 (`chaosState`)** | `POST /api/chaos`는 Service 라운드로빈으로 **파드 하나**에만 적용된다. 이후 `GET`은 매번 다른 파드가 답하므로 관리자 패널의 상태 표시가 켜짐/꺼짐 사이를 오가고, 지연 · 에러율은 요청의 1/N에만 걸린다. HPA가 늘린 새 파드는 깨끗한 상태로 시작한다. **test 전용이지만 장애 훈련(T36)이 이 경로를 쓴다.** T25로 test에서 HPA가 6개까지 쉽게 올라가므로 CPU 부하 직후 장애 주입을 하면 1/6에만 걸린다 | 높음 (test) |
| **`/api/metrics` 집계** | FE가 **파드별로 받아 합산**한다(`App.tsx:269-291`, `hostname` 키, `POD_TTL_MS = 6000`). 파드 2개면 1초 폴링으로 각 파드를 평균 2초마다 본다. **T25로 파드 6개가 흔해져** 평균 6초마다 보여 TTL 경계에서 파드가 나타났다 사라지는 깜빡임이 시연 중 보일 수 있다 | 중간 (6개가 흔해짐) |
| **메모리 폴백** | DB 단절 주입(test) 또는 실제 DB 장애 때 파드마다 폴백 데이터가 따로 쌓여 투표 수 · 방명록이 요청마다 달라 보인다 | 중간 |

구조 해결(상태를 Redis 등으로 공유, chaos POST를 모든 파드에 전파)은 앱 수정이라 이번 범위 밖이다(확장 계획 4단계). **값 파일만으로 되돌리려면** `deploy/values-be.test.yaml`에 `replicas: 1`, `autoscaling.enabled: false`를 넣어 test만 1개로 두는 방법이 있지만, T25의 목적(README "먼저 test에서 10 RPS · 중간 · 3분으로 측정")이 test HPA 관찰이라 **T25 이후로는 2 + HPA 유지 쪽이 더 자연스럽다.** 이 분석은 현재 값(2 + HPA)을 기준으로 둔다.

### HPA 동작 추정

- 분모: `resources.requests.cpu: 100m`, 목표 70% → 파드 평균 **70m**(= CPU 시간 70ms/s)를 넘으면 늘린다. 대시보드 `cpuPercent`는 1코어 기준이라 화면 7%가 HPA 100%다(README도 같은 주의).
- **폴링 · 부하 생성기(요청 수)**: 요청당 BE CPU 1ms 미만(가정) 기준 파드당 약 70 req/s가 확장 문턱. 평상시(탭 30개 80 req/s, 파드 2개) 40m → **2개 유지**. test 부하 생성기 180 + 폴링 80 = 260 req/s → 130m/파드 → 목표 복제 수 ceil(2 × 130/70) = **4개**.
- **CPU 부하 테스트(T25)** — 탭 1개 기준, t3.medium 비용 가정:

| 설정 | 총 CPU 수요 | 파드 2개일 때 파드당 | HPA 목표 복제 수 | 안정 상태 |
|---|---|---|---|---|
| 5 RPS · light | 40 ms/s | 20m (20%) | 2 | 2 (HPA 안 움직임) |
| 20 RPS · light | 160 ms/s | 80m (80%) | 3 | 3 |
| **10 RPS · medium (패널 기본값)** | 250 ms/s | 125m (125%) | ceil(2 × 1.25/0.7) = **4** | 4 (파드당 62m) |
| 20 RPS · medium 또는 10 RPS · heavy | 500 ms/s | 250m (250%) | 8 → **6 (상한)** | 6 (파드당 83m, 여전히 > 70) |
| **20 RPS · heavy** | 1,000 ms/s | 500m (500%) | 15 → **6 (상한)** | 6 (파드당 167m) |

- Kubernetes 기본 확장 정책(15초마다 4개 또는 100% 중 큰 쪽)이면 2 → 6은 **한 번에**, 메트릭 반영 · 파드 준비까지 **약 1~2분** 안에 6개에 닿는다. 축소 안정화 300초이므로 3분 테스트 한 번이 **8분 이상 6개**를 유지한다. 이것이 README가 말하는 "test 부하를 올려 replicas 증가를 관찰"의 새 경로다.
- 탭이 늘어도 HPA 상한은 6이라 복제 수는 더 늘지 않는다. 대신 파드당 처리 상한(heavy 20 req/s)을 넘는 요청은 **429(대기열 가득)**로 돌아오고 패널의 429 카운트에 보인다. 예: 3탭 × 20 RPS heavy = 60 req/s는 파드 2개 때 파드당 30 → 10/s가 429, 6개로 늘면 파드당 10 → 모두 성공.
- 지연 · 에러율 주입은 CPU를 안 쓰고(HPA 무관), `/api/load/`는 chaos preHandler를 건너뛰므로 두 기능은 서로 영향이 없다. worker thread가 계산을 맡아 main 스레드는 비어 있으므로 **CPU 부하 중에도 폴링 p95는 거의 그대로**다(노드 CPU가 포화되지 않는 한).

### 피크 추정 (환경별로 분리)

| 환경 | 성분 | req/s | BE CPU | DB q/s | DB |
|---|---|---|---|---|---|
| **prod** | 청중 탭 30개 폴링 (30 × 2.67) + 헬스체크 · 수집 (< 1) | **≈ 80** | ≈ 80m 합계 | 30 × 0.67 ≈ **20** | RDS `db.t4g.micro` (prod 전용) |
| prod + CPU 부하 테스트 1~3탭 (T25, prod에서도 켜짐) | + 20 RPS × 1~3탭 | ≈ 100~140 | **+1~3코어** → HPA 6 | ≈ 20 | RDS |
| prod + 부하 생성기 3탭 (프런트 전용, 막혀 있지 않음) | + 60 RPS × 3탭 | ≈ 260 | ≈ 260m | ≈ 200 | RDS |
| **test** | 청중 탭 30개 + 부하 생성기 60 RPS × 3탭 + CPU 부하 1~3탭 + 승인자 미리보기 탭 1~2개(green 파드 몫) | **≈ 285~325** | **+1~3코어** → HPA 6 | **≈ 200** | 맥북 k3d Postgres (Tailscale 경유, T33) |

- 직전 "prod 피크 = 폴링만(80 req/s)"에 **CPU 부하 성분이 추가됐다.** 요청 수는 적지만 HPA와 노드 CPU를 움직이는 건 이쪽이다. RDS는 CPU 부하 API가 DB를 쓰지 않으므로 그대로 200 q/s 보수적 유지.
- **test DB 경로의 지연 — 주의(변경 없음).** AWS test BE → Tailscale → 맥북 Postgres는 쿼리마다 WAN 왕복(수십 ms, 가정). 풀 `max: 5`로 파드당 처리량 상한은 약 5 / RTT. `/api/info`의 DB 헬스는 3초 TTL 캐시라 폴링은 영향이 작다. 시연 체감 지연(p95)은 test에서 prod보다 수십 ms 높게 보인다.
- **onprem(맥북)에서 CPU 부하를 돌리면** BE 파드 1개의 worker가 맥북 코어 1개를 쓰고, 같은 맥북이 AWS test의 DB(T33)를 호스팅하므로 그 동안 AWS test 쿼리 지연이 조금 늘 수 있다. 사이징이 아니라 연출 참고.

정적 자산: `CpuLoadPanel` · i18n 추가로 약 +5KB(가정). 약 295KB 비압축, gzip 80~100KB 추정. 100명/일 × 295KB ≈ 30MB/일.

## 병목 후보

1. **CPU 부하 API(T25) vs 요청 100m · CPU 한도 없음 — 상한이 있어 안전, 다만 HPA 6개가 "흔한 일"이 된다.**
   - **파드당 CPU 상한 ≈ 1코어.** `CpuPool`은 파드당 worker thread **1개**(`cpu-pool.ts:17` "One reusable CPU worker per pod")이고 worker는 단일 스레드다. 요청이 아무리 몰려도 파드가 끌어 쓰는 CPU는 main 스레드(수 %) + worker 1코어를 넘지 못한다. CPU 한도(`limits.cpu`)가 없어 이 1코어를 실제로 쓴다 — **한도를 넣지 말 것을 권한다.** 넣으면 CFS 스로틀로 요청당 시간이 늘어 2초 데드라인(503, 풀 리셋)에 걸리고, HPA 비율은 요청(100m) 기준이라 확장 시연에는 도움이 안 된다.
   - **대기열 8 · 2초 데드라인 = 파드 수준 백프레셔.** 대기열이 차면 429(즉시), active 작업이 2초를 넘기면 503 + **풀 전체 리셋**(worker terminate, 대기 중 요청 전부 503). 정상 상태에서는 가장 무거운 heavy 8개 대기 = 400ms라 503은 나오지 않고, 노드 CPU가 심하게 경합해 요청당 시간이 4배(200ms) 넘게 늘어야 503이 난다. 즉 503은 "노드 CPU 포화" 신호다. 풀 리셋 뒤 다음 요청이 worker를 다시 만든다(수십 ms).
   - **HPA 영향.** 요청 100m 대비 worker 1코어는 1,000%다. 패널 기본값(10 RPS · medium)만으로 4개, 20 RPS · heavy면 2 → **6(상한)** 한 번에. 노드 슬롯 표의 "HPA 최대 6" 행들이 시연 중 **실제로 일어나는 상황**으로 바뀐다(아래 4번). 상한 6은 유지가 맞다 — 더 올리면 슬롯과 RDS 커넥션 설계값(2번)이 같이 올라간다.
   - **노드 CPU.** 수요는 탭 수에 비례(탭당 ≤ 1코어)하고 파드 수와 무관하다. 시연 1~3탭 = 1~3코어는 3대 × 2 vCPU 안이다. 6개 파드가 모두 worker를 돌리는 최대치(6코어)는 탭 6개가 heavy 20 RPS를 동시에 쏠 때뿐이고, 그때도 노드 포화 → 요청당 시간 증가 → 429/503으로 스스로 줄어든다. t3는 버스트 인스턴스라 기준 성능(vCPU당 20%)을 넘는 동안 크레딧을 쓴다(가정: 관리형 노드 그룹 기본 unlimited → 초과분 과금, 5분 3코어 ≈ 0.15 vCPU-h ≈ $0.01).
   - **메모리.** worker는 V8 isolate 하나(≈ +10~20MiB, 가정)와 32바이트 버퍼뿐이다. BE RSS 기본 70~90MiB(가정) + worker로 128Mi 요청 안, 256Mi 한도에 여유. OOM 위험 없음.
   - **prod에도 켜져 있다.** `/api/load/cpu`에 인증이 없어 익명 방문자가 prod BE를 6개 × 1코어까지 올릴 수 있다(상한은 위와 같이 존재). 트래픽 관점에서는 "최대 6코어 · 파드 슬롯 +4 · 축소까지 5분"으로 유계라 값을 바꾸지 않지만, prod에서 끌지는 **보안 · 예산 분석기와 종합 단계의 결정**이다. 끄는 방법은 값 파일만으로 된다: `values-be.yaml`을 `"false"`로, `values-be.test.yaml`에 `LOAD_TEST_ENABLED: "true"`.
2. **RDS 커넥션 설계 최대치(변경 없음, 도달 가능성 상승).** 파드당 풀 `max: 5`. prod BE가 HPA 최대 6개 × Blue-Green 2 = 12개면 60 + 마이그레이션 Job 1 = **61개**. `db.t4g.micro` max_connections ≈ 110 안. T25로 "HPA 6"이 시연 중 실제로 일어나므로 61은 이제 이론값이 아니라 **배포가 겹치면 닿는 값**이다 — 그래도 110 안. CPU 부하 API는 DB를 안 쓰므로 커넥션을 더 열지는 않는다. **T33 db_link를 제거해 test를 RDS로 되돌리면 두 환경 합계 122개로 한도를 넘는다**: (a) `maxReplicas` 3 또는 (b) 풀 `max` 3(앱 수정) 또는 (c) `db.t4g.small`(≈ 220). 지금 구성(test는 온프레미스 DB)에서는 **조치 불필요**.
3. **온프레미스 test DB 커넥션(변경 없음).** test BE 최대 12개 × 5 = 60개가 Tailscale을 거쳐 맥북 Postgres로 간다(Postgres 기본 100 가정).
4. **파드 슬롯 — HPA 최대가 흔해져 4대째 노드가 "시연 중 일어날 수 있는 일"이 됐다.** 아래 "노드 수용량" 참조. test에서 CPU 부하(HPA 6)를 켠 채 yolo 배포가 겹치면 45~50개로 3대 한계, 여기에 prod에서도 누가 CPU 부하를 켜면 57~62개로 **4대째가 뜬다.** Cluster Autoscaler가 Pending을 보고 2~4분(가정) 뒤 노드를 붙이고, 축소 안정화 300초 + 노드 반납 지연 뒤 돌아온다. 가용성 `demo`에서 허용, 비용은 시간 단위.
5. **파드별 상태 세 군데**(chaos · metrics · fallback) — 위 "주의" 절. T25로 파드 6개가 흔해지면서 `/api/metrics` 깜빡임(`POD_TTL_MS = 6000`)과 chaos 1/N 문제가 더 자주 보인다.
6. **방명록 `created_at` 인덱스 없음** — 변경 없음. 10만 행 넘을 때 추가.
7. **지연 주입 중 `/api/info` 3.5초 abort** — 변경 없음, test만 해당. CPU 부하는 preHandler를 건너뛰어 서로 무관.
8. ~~요청 로그 양~~ → 해결됨(`LOG_LEVEL: warn`, 유지). CPU 부하 요청도 warn 레벨에서 로그를 남기지 않는다.

## 추천 크기

현재 값 파일을 그대로 추천값으로 둔다. **바꾸라고 권하는 값은 없다.** T25가 만드는 부하는 파드당 ≈ 1코어 · HPA 6 · 축소 5분으로 유계이고, 100m 요청은 "탭 하나로 HPA가 움직이는" 시연 목적과 맞다(요청을 250m로 올리면 기본 설정 10 RPS · medium이 50%에 머물러 확장이 안 보인다). CPU 한도는 넣지 않는다(병목 1).

| 서비스 | replicas (공통 / aws / onprem) | HPA | cpu 요청 | memory 요청 | memory 한도 |
|---|---|---|---|---|---|
| demo-app-be (Fastify, Node 22) | **2 / 2 / 1** | aws · gcp: **min 2 · max 6 · CPU 70%** (`values-be.yaml`), onprem · onprem-wsl: 끔 (`onprem/values.yaml`) | 100m (CPU 한도 없음, 의도) | 128Mi | 256Mi |
| demo-app-fe (nginx-unprivileged, 정적 + 프록시) | **1 / 1 / 1** | 끔 (`values-fe.yaml`) | 50m | 32Mi | 64Mi |
| demo-app-fe-preview-auth (oauth2-proxy, 차트 생성) | 1 / 1 / 1 (aws · onprem 기본 기기 · gcp(T38); onprem 보조 기기 끔) | 없음 | 10m (차트 기본) | 32Mi | 64Mi |

- **BE replicas 2 + HPA 2~6, 100m/128Mi/256Mi**: T29 값 유지. 평상시 2개로 100명/일 피크(80 req/s)의 40%만 쓴다. CPU 부하 테스트 때 1~2분 안에 4~6개로 늘고, 멈춘 뒤 5분 지나 2개로 돌아온다. 자원은 값 파일에 고정돼 HPA 분모가 차트 버전에 흔들리지 않는다. **유지.** `maxReplicas` 6도 유지 — 슬롯 · RDS 커넥션 설계값의 분모다.
- **FE replicas 1, 50m/32Mi/64Mi**: nginx는 `/api/load/cpu`도 BE로 그대로 넘기며 탭당 20 req/s가 추가될 뿐이다. 1개로 325 req/s를 여유 있게 넘긴다. 파드 재스케줄 수십 초 중단은 가용성 `demo`에서 허용. **유지.**
- **onprem · onprem-wsl replicas 1 · HPA 끔**: 단일 노드 k3d. README도 "온프레미스는 HPA가 꺼져 있어 CPU 부하는 가능하지만 자동 확장은 별도 활성화 필요"라고 적는다. worker 1개가 맥북 코어 1개를 쓰는 정도. **유지.**
- **gcp**: `deploy/gcp/values.yaml`에 replicas · autoscaling 덮어쓰기가 없어 BE 2 + HPA 2~6, FE 1, oauth2-proxy 1이 적용된다. GKE는 Metrics Server가 기본이라 HPA는 동작한다. 노드 풀 크기는 `infra/envs/gcp`가 모듈 v1.16.2 기본값에 맡겨 로컬에서 확인 못 했다 — CPU 부하 6코어 수요가 GKE 노드 풀에 들어가는지는 예산 · 코드베이스 분석기 참고.
- `LOAD_TEST_ENABLED`: 사이징 값이 아니다. prod에서 켜 둘지는 종합 단계 결정(병목 1).
- 마이그레이션 Job(`postgres:17`, `psql` 1회)은 차트 기본 자원 그대로.

### 노드 수용량 (AWS, 재해석)

입력: t3.medium 노드당 파드 17개, 3대 = 51슬롯(`infra/envs/aws/main.tf:89` min 3), Cluster Autoscaler가 Pending 파드에 맞춰 **최대 5대 = 85슬롯**. 시스템 · 애드온 파드 20~25개(가정) + Metrics Server 1 + Cluster Autoscaler 1 = **22~27개**. 앱 쪽 상시 파드: Slack 봇 1, tailscale operator + 프록시 2(T33), oauth2-proxy 환경당 1 = 2. 파드 수는 직전과 같고, **각 행이 일어날 가능성**이 T25로 달라졌다.

| 상황 | BE | FE | 기타 상시 | Job | 앱 소계 | 시스템 포함 합계 | 필요 노드 | T25 이후 가능성 |
|---|---|---|---|---|---|---|---|---|
| 평상시 (test · prod, HPA 최소) | 2 × 2 = 4 | 2 | 5 | 0 | 11 | **33~38** | 3대 (51) | 상시 |
| 한 환경 Blue-Green 배포 중 | 4 + 2 = 6 | 3 | 5 | 1 | 15 | 37~42 | 3대 | 배포마다 |
| 양 환경 Blue-Green 동시 (yolo test + main prod) | 8 | 4 | 5 | 2 | 19 | **41~46** | 3대 (여유 5~10) | 가끔 |
| test 부하 생성기(HPA 4) + test 배포 중, prod 평상시 | 4 + 4 + 2 = 10 | 3 | 5 | 1 | 19 | 41~46 | 3대 | 가끔 |
| **test CPU 부하(HPA 6) + test 배포 중, prod 평상시** | 6 + 6 + 2 = 14 | 3 | 5 | 1 | 23 | 45~50 | 3대 (한계) | **시연 중 흔함** (탭 1개 · 3분 + 축소 5분 = 8분 창) |
| **양 환경 CPU 부하(HPA 6) + 동시 배포 (최악)** | 24 | 4 | 5 | 2 | 35 | **57~62** | **4대** (68) | **가능** (prod에서도 켜짐) |

- **결론: 3대로 평상시 · 통상 배포 · 한 환경의 CPU 부하 시연을 버틴다.** 4대째는 "양쪽 환경이 HPA 6인 채로 동시에 배포"일 때 뜨는데, 직전에는 "일어나기 어려운 조합"이었지만 T25로 **누가 test와 prod 양쪽에서 CPU 부하를 켜고 그 8분 창 안에 배포가 겹치면** 일어난다. 5대 상한(85)은 최악(62)보다 넉넉하다.
- CPU · 메모리 **요청** 합계는 슬롯보다 한참 여유다(최악 조합도 ≈ 2.9 vCPU / 3.9GiB). **실사용**은 다르다: CPU 부하 중 BE 파드가 요청 100m의 10배를 쓰므로 3대 6 vCPU 중 탭 수만큼의 코어가 실제로 찬다. 스케줄러는 요청값으로 배치하므로 같은 노드에 BE가 몰릴 수 있고, 그러면 그 노드가 먼저 포화돼 요청당 시간이 늘고 429/503으로 수요가 줄어든다 — 노드 확장을 부르는 것은 여전히 파드 슬롯(ENI IP)이지 CPU가 아니다(Cluster Autoscaler는 Pending만 본다).
- 비용 측면(예산 분석기 참고): 평상시는 3대 그대로이고, 4대째는 조건부 · 일시적이다. 월 예산 10만 원이 이미 초과 상태이므로 노드 1대 추가분(≈ 월 5만 원, 가정)은 "시연 중 몇 시간" 단위로만 계산한다. t3 크레딧 초과분은 미미하다(병목 1).

## DB 크기

- **AWS prod — RDS `db.t4g.micro`**(2 vCPU 버스트, 1GiB), gp3 20GB, 단일 AZ(`infra/envs/aws/main.tf`). **prod만 쓴다**(T33). 피크 20~200 q/s(단순 쿼리)는 CPU 10% 안팎, 커넥션 설계 최대 61개(< ≈110). CPU 부하 API는 DB를 쓰지 않는다. **가장 작은 클래스 유지.** 병목 2번의 조건(test를 RDS로 되돌림)이 생기면 그때 `maxReplicas` 또는 클래스를 조정한다.
- **AWS test — 온프레미스 맥북 k3d Postgres**(`db_link.test`, `demo-app-db-test.tailb7ed7e.ts.net`). 크기 선택 없음. 쿼리 지연은 Tailscale 경로에 좌우된다. 맥북이 꺼지면 test BE는 메모리 폴백으로 동작한다 — smoke가 `database: connected`(`.deploy/smoke.json`)를 요구하므로 **맥북이 꺼진 동안 test 승격이 실패**한다. 사이징이 아니라 운영 의존성으로 종합 단계에 넘긴다.
- **온프레미스(onprem · onprem-wsl 대상)**: 클러스터 안 Postgres 17, 환경마다 1개. 커넥션은 환경당 최대 11개(BE 1 + green 1 → 10 + Job 1).
- 세 경로 모두 저장 용량보다 **커넥션 수**가 먼저 한계다. 계산식은 `BE 파드 수(HPA 최대 × Blue-Green 2) × 5 + Job`.

## 확장 계획

| 단계 | 조치 | 버티는 한계(추정) | 비용 | 상태 |
|---|---|---|---|---|
| 현재 | BE 2 + HPA 2~6(100m/128Mi, CPU 한도 없음), FE 1(50m/32Mi), 노드 3~5대 자동, prod RDS `db.t4g.micro`, test 온프레미스 DB, `LOG_LEVEL=warn`, `LOAD_TEST_ENABLED=true`(전 환경) | 요청 수 기준 HPA 6개로 약 **2,000~2,500 req/s**(동시 폴링 탭 약 800개). CPU 부하 기준 **파드당 heavy 20 req/s × 6 = 120 req/s**(탭 6개), 그 위는 429. 그 전에 파드 슬롯 → 노드 4~5대로 자동 확장. test는 **DB 경로(Tailscale RTT × 풀 5)**가 실질 상한 | 평상시 노드 3대, CPU 부하 시연 + 배포가 겹칠 때 조건부 +1대 | 적용됨 |
| 1 | `LOG_LEVEL=warn` | — | 절감 | 완료 |
| 2 | ~~`replicas: 2`~~ → T29로 2 + HPA 적용 완료. 남은 결정 두 가지: (a) test만 `values-be.test.yaml`에 `replicas: 1`, `autoscaling.enabled: false`(장애 훈련 정확도 우선) — **T25 이후로는 비추천**(CPU 부하 시연이 test HPA를 전제); (b) `LOAD_TEST_ENABLED`를 test 전용으로 옮길지(prod 익명 부하 차단, 보안 · 예산 관점) | — | 없음 | **결정 필요 (종합)** |
| 3 | 노드: 이미 자동(3~5대). 수동 조치는 `node_count.max` 상향 또는 `t3.large`(노드당 35 파드, 2 vCPU 같음)로 교체. CPU 자체가 부족해지면(탭 6개 heavy 동시) `c6i`·`m6i` 계열이 맞지만 시연 범위 밖 | 슬롯 85 → 그 이상 | t3.medium 1대 ≈ 월 5만 원 → 예산 초과 | 자동 적용 중 |
| 4 | 구조 변경: chaos · 메트릭 · 폴백 상태를 공유 저장소로(또는 chaos POST를 전 파드에 전파), 폴링 → SSE/WebSocket, `POD_TTL_MS` 상향(파드 6개가 흔해져 우선순위 상승), `guestbook(created_at)` 인덱스, 풀 `max` 조정, RDS `db.t4g.small`, CPU 부하 API에 인증 또는 토큰 | 사용자 수가 브리프 상한의 10배를 넘거나, replicas 2 이상에서 시연 정확도가 필요할 때 | 별도 산정 | 보류 |

순서 원칙(replicas → 노드 → 구조)에서 1 · 2 · 3단계가 **이미 자동화됐다.** 100명/일 · 시연 범위에서 남은 결정은 2단계(test 파드 수, `LOAD_TEST_ENABLED` 범위)뿐이고, 사이징으로 당장 바꿀 값은 없다.

## plan.yaml 반영값 (종합 단계 참고, 이 분석기는 건드리지 않음)

`.deploy/plan.yaml`은 직전 분석의 반영값대로 이미 맞춰져 있다(`replicas: { default: 2, aws: 2, onprem: 1 }`, `autoscaling: { default: { min: 2, max: 6, cpu: 70 }, onprem: false }`, `nodes.aws: { t3.medium, 3/3/5, autoscaler }`). **이번 델타로 바꿀 사이징 값은 없다.** 기록 삼아 BE 주석에 T25 한 줄을 더하는 것은 선택이다:

```yaml
services:
  - name: demo-app-be
    resources: { cpu: 100m, memory: 128Mi, memoryLimit: 256Mi }   # CPU 한도 없음(의도): T25 worker thread가 파드당 ≈ 1코어까지 씀
    replicas: { default: 2, aws: 2, onprem: 1 }
    autoscaling: { default: { min: 2, max: 6, cpu: 70 }, onprem: false }   # T25 CPU 부하 탭 1개로 6까지 감. 상한 6 유지(슬롯 · RDS 커넥션 분모)
```

## 가정

- **체류 시간 5분/방문, 하루 방문 100회, 피크 동시 탭 30개, 부하 생성기 3탭 × 60 RPS, CPU 부하 1~3탭**: 시연용 대시보드 · README "원터치 배포 시연용" · 브리프 `demo`. CPU 부하 탭 수는 README의 "먼저 10 RPS · 중간 · 3분으로 측정"을 발표자 1명이 하는 상황에 여유를 둔 값이다.
- **폴링 수치 2.67 req/s/탭, DB 0.67 q/s/탭**: 55b1586의 `fe/src/App.tsx:250, 294, 393`과 `be/src/db/index.ts:59`에서 재확인. b0d3df7 이후 변경 없음.
- **CPU 부하 요청당 비용 light 8 / medium 25 / heavy 50ms (t3.medium)**: 로컬 M2 · Node 24에서 `cpu-worker.ts`와 같은 sha256 반복을 돌려 3 / 9 / 18ms를 쟀고, t3.medium(2.5GHz Xeon, 버스트)을 약 2.5배 느리게 잡았다. 실제 값은 패널의 응답 `elapsedMs`(`/api/load/cpu` 응답 본문)로 바로 보인다 — 배포 뒤 한 번 읽어 이 표의 HPA 목표 복제 수를 보정한다. 비용이 2배 틀려도 결론(기본값으로 4개, heavy 20 RPS로 6개)은 같다.
- **요청당 BE CPU 1ms 미만(폴링 · 부하 생성기)**: Fastify 단순 JSON 라우트의 일반값. 측정하지 않았다 — `kubectl top pod -n test`와 `kubectl get hpa -n test demo-app-be`로 보정한다.
- **HPA 산식 · 정책**: Kubernetes 표준 `desired = ceil(current × usage / target)`, 확장 정책 기본(15초마다 4개 또는 100%), 축소 안정화 300초(README). App Chart v2.17.0이 HPA를 Rollout에 붙이는지, Blue-Green preview ReplicaSet이 stable과 같은 복제 수로 뜨는지는 차트 본문이 로컬에 없어 **Argo Rollouts 기본 동작(preview = spec.replicas)**으로 가정했다. 파드 슬롯 표의 "배포 중 ×2"는 이 가정이다.
- **worker thread 메모리 +10~20MiB, BE RSS 기본 70~90MiB**: Node 22 isolate의 일반값. 측정하지 않았다 — 대시보드 `memoryMb`(RSS)로 확인한다.
- **t3 CPU 크레딧**: EKS 관리형 노드 그룹의 t3는 기본 unlimited 모드로 가정(초과분 vCPU-시간당 $0.05). standard 모드면 크레딧 소진 뒤 기준 성능(vCPU당 20%)으로 떨어져 CPU 부하 요청당 시간이 늘고 503(2초)이 날 수 있다 — 그 경우 예산 분석기와 함께 모드를 확인한다.
- **Cluster Autoscaler 노드 합류 2~4분**: EKS 관리형 노드 그룹의 일반값. 측정하지 않았다.
- **AWS 시스템 · 애드온 파드 20~25개 + Metrics Server 1 + Cluster Autoscaler 1**: `cluster_addons/aws` · `observability` 모듈 구성에서 추정(예산 분석기의 ADR-0014 가정 "예약 25 파드"와 일치). 실제 수는 `kubectl get pods -A`로 확인한다(이번에 네트워크 명령은 실행하지 않았다).
- **tailscale 파드 2개(operator + 프록시)**, **oauth2-proxy 환경당 1개 10m/32Mi/64Mi**: 플랫폼 모듈 v2.17.0 본문이 로컬에 없어 직전 분석의 가정을 유지했다.
- **Tailscale 경유 쿼리 RTT 수십 ms(30ms 예시)**: 서울 리전 ↔ 국내 가정 네트워크의 일반값. 측정하지 않았다.
- **`db.t4g.micro` max_connections ≈ 110**: RDS 기본 공식에 1GiB 대입. 온프레미스 Postgres는 기본 100 가정.
- **t3.medium 1대 ≈ 월 5만 원**: 서울 온디맨드 ≈ $0.052/h × 730h, 환율 1,350원 가정. 정확한 값은 예산 분석기 몫.
- **gcp 노드 풀**: `infra/envs/gcp`는 모듈 v1.16.2 기본값을 쓰고 로컬에 본문이 없어 CPU 부하 수요(최대 6코어)를 수용하는지 확인하지 못했다.
- **prod 피크에 CPU 부하를 넣는다**: `LOAD_TEST_ENABLED`가 공통 값이고 `/api/load/cpu`에 인증이 없어 prod에서도 누구나 켤 수 있다. 종합 단계가 test 전용으로 옮기면 prod 피크는 직전(폴링 80 req/s)으로 돌아간다.

## 사이징 결과 (기계용)

```yaml
# 예산 분석기 · 종합이 읽는 최종 값. 단위는 App Chart 값과 같다.
# 2026-10-11 yolo 재검증(55b1586): T25 CPU 부하 API로 부하 모델이 바뀌었다. replicas · HPA · 자원 요청값은 동일.
analyzed_at: 2026-10-11
base_commit: 55b1586
previous_commit: b0d3df7          # 직전 분석 기록 커밋 (분석 기준 951feac)
changed_since_previous: true      # 부하 모델: CPU 부하 API(T25, 전 환경) 추가 → HPA 6 도달이 흔해짐. 값은 동일
plan_yaml_out_of_date: false      # .deploy/plan.yaml은 직전 반영값대로 이미 맞음
peak:
  prod_be_rps: 140          # 폴링 80 + CPU 부하 3탭 × 20. 부하 생성기까지 prod에서 켜면 320
  prod_be_cpu_cores: 3      # CPU 부하 3탭 × ≈ 1코어 (worker thread, 요청 100m 대비 1,000%)
  test_be_rps: 325          # 폴링 + 부하 생성기 3탭 + CPU 부하 3탭 + 승인자 미리보기 탭(green 몫)
  test_be_cpu_cores: 3
  rds_qps: 200              # prod 전용(T33). 보수적으로 부하 생성기 포함. CPU 부하 API는 DB 미사용
  onprem_test_db_qps: 200   # AWS test → Tailscale → 맥북 Postgres
  fe_bundle_kb: 295
cpu_load_api:                               # T25, be/src/load/cpu-pool.ts · routes/load.ts
  enabled_in: [test, prod, onprem, gcp]     # deploy/values-be.yaml env LOAD_TEST_ENABLED="true" (공통)
  per_pod_max_cores: 1                      # worker thread 1개(단일 스레드) + main
  per_pod_queue: 8                          # 초과 429
  per_request_deadline_ms: 2000             # 초과 503 + 풀 리셋
  per_tab_max: { rps: 20, duration_sec: 300, inflight: 8 }
  cost_ms_per_request_t3_medium: { light: 8, medium: 25, heavy: 50 }   # 가정 (M2 실측 3/9/18 × 2.5)
  per_pod_throughput_rps: { light: 125, medium: 40, heavy: 20 }
services:
  - name: demo-app-be
    replicas: { default: 2, aws: 2, onprem: 2, gcp: 2 }   # onprem · onprem-wsl은 deploy/onprem/values.yaml이 1로 덮어씀 → 실효 1
    effective_replicas: { aws: 2, onprem: 1, gcp: 2 }
    autoscaling:
      aws:    { enabled: true, minReplicas: 2, maxReplicas: 6, targetCPUUtilizationPercentage: 70 }
      gcp:    { enabled: true, minReplicas: 2, maxReplicas: 6, targetCPUUtilizationPercentage: 70 }
      onprem: { enabled: false }
    resources: { cpu: 100m, memory: 128Mi, memoryLimit: 256Mi }   # values-be.yaml에 명시 (HPA 분모). CPU 한도 없음 — 넣지 말 것
    per_pod_state: [chaosState, metrics_window, memoryFallback, cpuPool]   # cpuPool은 파드별이 의도
  - name: demo-app-fe
    replicas: { default: 1, aws: 1, onprem: 1, gcp: 1 }
    autoscaling: { enabled: false }
    resources: { cpu: 50m, memory: 32Mi, memoryLimit: 64Mi }
    extra_workloads:
      - { name: nginx-log-exporter, kind: sidecar }
      - { name: demo-app-fe-preview-auth, kind: deployment, replicas: 1, resources: { cpu: 10m, memory: 32Mi, memoryLimit: 64Mi }, targets: [aws, onprem, gcp] }
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
  max: 5                      # Cluster Autoscaler (infra 모듈 v2.11.0), Pending 파드 기준
  slots: { min: 51, max: 85 }
  system_pods_estimate: { min: 22, max: 27 }   # 애드온 20~25 + Metrics Server 1 + Cluster Autoscaler 1
aws_pod_slots:
  steady: { min: 33, max: 38 }                 # BE 4 + FE 2 + oauth2 2 + 봇 1 + tailscale 2 + 시스템
  both_envs_bluegreen: { min: 41, max: 46 }    # 3대 안
  test_hpa_max_plus_test_deploy: { min: 45, max: 50 }   # 3대 한계. T25로 "시연 중 흔함"(CPU 부하 탭 1개 · 8분 창)
  worst_case_both_hpa_max_both_deploy: { min: 57, max: 62 }   # 4대 필요 (68), 5대 상한 안. T25로 "가능"(prod도 켜짐)
  expected_nodes: { steady: 3, peak_conditional: 4, hard_max: 5 }
hpa_estimate:
  scale_out_threshold_rps_per_pod: 70         # 폴링 · 부하 생성기: 100m × 70% ÷ 1ms/req (가정)
  demo_load_generator_target_replicas: 4      # 260 req/s, test
  cpu_load_target_replicas:                   # 탭 1개, 파드 2개에서 시작
    5rps_light: 2
    10rps_medium_default: 4
    20rps_medium: 6
    20rps_heavy: 6
  time_to_max_replicas_sec: 60-120            # 확장 정책 기본(한 번에 +4) + 메트릭 반영 + 파드 준비 (가정)
  scale_down_stabilization_sec: 300           # 3분 테스트 → 8분 이상 6개 유지
recommendations:
  - key: LOG_LEVEL
    value: warn
    where: deploy/values-be.yaml env
    status: applied
  - key: no CPU limit on BE
    value: "limits.cpu 추가하지 않음"
    where: deploy/values-be.yaml resources
    status: keep                   # worker thread가 1코어로 스스로 상한. 한도를 넣으면 CFS 스로틀 → 2초 데드라인 503
    reason: T25 CPU 부하가 요청 100m의 10배를 쓰는 것은 의도. HPA 비율은 요청 기준이라 한도는 확장 시연에 도움 안 됨
  - key: test-only replicas 1
    value: "replicas: 1, autoscaling.enabled: false"
    where: deploy/values-be.test.yaml
    status: decision_needed        # 장애 훈련 정확도(1) vs HPA 시연(2+HPA). T25 이후 2+HPA 유지 쪽을 권함
    reason: chaosState · memoryFallback이 파드별 인메모리라 파드 ≥ 2에서 장애 주입이 1/N에만 걸림. 단 CPU 부하 시연은 test HPA를 전제
  - key: LOAD_TEST_ENABLED scope
    value: "prod 유지 또는 test 전용(values-be.yaml false + values-be.test.yaml true)"
    where: deploy/values-be.yaml env / deploy/values-be.test.yaml
    status: decision_needed        # 트래픽 관점에서는 유계(6코어 · 슬롯 +4 · 5분)라 값 변경 불필요. 보안 · 예산 관점은 해당 분석기
    reason: /api/load/cpu에 인증이 없어 prod에서 익명 방문자가 BE 6개 × 1코어를 끌어올릴 수 있음
  - key: RDS connections guard
    value: "test를 RDS로 되돌릴 때 maxReplicas 3 또는 풀 max 3 또는 db.t4g.small"
    where: deploy/values-be.yaml autoscaling / be/src/db/index.ts / infra/envs/aws/main.tf
    status: conditional            # 지금 구성(test=onprem DB)에서는 불필요
    reason: 두 환경 HPA 최대 × Blue-Green × 풀 5 = 122 > db.t4g.micro ≈ 110
```
