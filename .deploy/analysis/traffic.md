# 트래픽 분석

브리프: 하루 이용자 0~100명(상한 100명으로 계획), 가용성 `demo`(시연용), 선호 대상 **AWS**, 월 예산 10만 원 이하, 민감 데이터 취급(`regulated`). 이전 분석(온프레미스 · 일반 운영 기준)을 현재 코드와 새 브리프로 다시 검증해 고쳐 썼다.

## 예상 부하

이 앱의 부하는 **하루 이용자 수가 아니라 동시에 열려 있는 브라우저 탭 수**에 비례한다. 프런트엔드(`fe/src/App.tsx`)가 화면을 열어 둔 동안 계속 폴링하고, PR #44로 들어온 관리자 패널은 탭 하나가 **의도적으로 초당 최대 60회** 요청을 만든다.

### 탭 1개가 만드는 기본 부하 (`fe/src/App.tsx`)

| 호출 | 주기 | 탭 1개당 | BE 처리 (`be/src/routes`) | DB 쿼리 |
|---|---|---|---|---|
| `GET /api/info` | 1초 | 1.0 req/s | 메타데이터 조립 + `checkDbHealth()` | **파드당 ≤ 0.33/s** (`SELECT 1`, 3초 TTL 캐시 · in-flight 합치기, `be/src/db/index.ts`) |
| `GET /api/metrics` | 1초 | 1.0 req/s | 인메모리 60초 윈도 집계 (`routes/metrics.ts`) | 없음 |
| `GET /api/votes` | 3초 | 0.33 req/s | 3행 SELECT + 합산 | 1회 |
| `GET /api/guestbook` | 3초 | 0.33 req/s | `ORDER BY created_at DESC LIMIT 50` | 1회 |
| `GET /api/chaos` | 열 때 1회 | — | 인메모리 상태 반환 | 없음 |
| `POST /api/votes/:id`, `POST /api/guestbook` | 사용자 행동 | 방문당 1~2회 | UPDATE / INSERT | 1회 |

- 탭 1개 ≈ **2.67 req/s, DB 쿼리 0.67/s**. 이전 분석(1.67 req/s)보다 늘어난 것은 PR #44의 `/api/metrics` 1초 폴링 때문이고, DB 쿼리가 줄어든 것은 `/api/info`의 `SELECT 1`이 3초 캐시로 바뀌어 탭 수와 무관하게 파드당 최대 0.33/s가 됐기 때문이다(이전 분석의 병목 1번은 이미 코드에서 해결됐다).
- 하루 총량: 100명 × 5분 체류 × 2.67 req/s ≈ **8만 req/일**, 평균 0.9 req/s. 쓰기는 하루 200건 미만.
- 모두 수 ms급 단순 쿼리(테이블 2개 `votes` 3행, `guestbook` 수백~수천 행)다. N+1, 무거운 계산은 없다.

### 관리자 패널(PR #44)이 만드는 합성 부하

| 기능 | 선택지 | 부하 특성 |
|---|---|---|
| 트래픽 부하 생성기 (`loadRps`) | 0 / 10 / 30 / 60 RPS | 브라우저가 `setInterval`로 `GET /api/votes`를 쏜다. **탭 1개당 최대 60 req/s = DB 60 q/s**. 서버가 아니라 브라우저가 만들기 때문에 켠 탭 수만큼 곱해진다 |
| 지연 주입 (`chaos.latencyMs`) | 0 / 1,000 / 2,500 ms | `preHandler`에서 `setTimeout`으로 응답을 붙잡는다. CPU는 안 쓰지만 **in-flight 요청이 RPS × 지연만큼 쌓인다**(60 rps × 2.5s = 150개/탭). Node의 대기 타이머 150개는 메모리 수십 KB 수준 |
| 에러율 주입 (`chaos.errorRate`) | 0 / 0.5 / 1.0 | 500을 바로 돌려 부하가 오히려 준다 |
| DB 단절 (`chaos.dbError`) | on/off | `checkDbHealth()`가 즉시 false → votes · guestbook이 파드 메모리 fallback으로 전환. DB 부하 0 |

시연용 사이징에 미치는 영향:

- **크기(cpu · memory)는 안 바꾼다.** 60 rps `/api/votes`는 Fastify 단순 JSON 라우트 + 3행 SELECT라 요청당 CPU 1ms 미만이고, 탭 3개가 동시에 60 RPS를 켜도 BE CPU는 약 200m 안팎이다. CPU는 요청(100m)만 두고 한도를 두지 않아 순간 부하는 노드 여유 CPU를 쓴다. 메모리는 `routes/metrics.ts`의 60초 윈도(요청당 숫자 2개, 180 rps면 약 1만 건)와 지연 주입의 대기 타이머가 전부라 수 MiB다.
- **replicas는 1이 오히려 맞다.** `chaosState`(`routes/chaos.ts`)와 `/api/metrics`의 집계는 **파드별 인메모리 싱글톤**이다. 파드가 2개면 `POST /api/chaos`는 한 파드에만 적용돼 요청의 절반만 지연 · 에러가 나고, "정상화" 버튼도 한 파드만 되돌린다. 시연에서 장애 주입이 예측 가능하게 보이려면 환경당 BE 파드 1개여야 한다. 가용성 `demo`는 이 선택과 충돌하지 않는다.
- **Blue-Green과 자연스럽게 맞물린다.** green 파드는 새 프로세스라 chaos 상태가 0으로 시작한다. "장애 주입 → 승격 → 정상 복귀"가 시연 흐름이 되고, 승격 전 blue에 주입한 상태는 green에 안 넘어간다.
- 브라우저 한도: ALB(HTTP/2)는 연결당 스트림 128개가 기본이라 2.5초 지연 + 60 RPS(150 in-flight)에서는 브라우저 쪽이 먼저 큐잉된다. 실제 도달 RPS는 명목값보다 낮을 수 있고, 서버 사이징에는 명목값(보수적)을 썼다.

### 피크 추정

**BE 약 250 req/s, DB 약 200 q/s** (환경 1개, prod 기준). 근거:

| 성분 | 계산 | req/s | DB q/s |
|---|---|---|---|
| 청중 탭 30개 폴링 | 30 × 2.67 | 80 | 30 × 0.67 = 20 |
| 부하 생성기 60 RPS × 탭 3개 (발표자 1 + 따라 켠 청중 2) | 3 × 60 | 180 | 180 |
| 헬스체크 (readiness 10초 + ALB `/health`) + Prometheus 수집 | — | < 1 | ≤ 0.33 |
| 합계 | | **≈ 260** | **≈ 200** |

test 환경은 시연 중 거의 비어 있다고 보고(발표자 확인용 탭 1~2개), RDS 공유 합계는 약 210 q/s로 잡는다. 단순 쿼리 200 q/s는 `db.t4g.micro`(2 vCPU 버스트)에서 CPU 10% 안팎, 커넥션 풀 `max: 5` 점유율은 수 % 수준이다.

정적 자산: Vite 번들(수백 KB)은 첫 방문 때만 받고 이후는 API 폴링만 남는다. `/api/`, `/health`는 nginx가 `demo-app-be:8000`으로 프록시하므로(`fe/nginx.conf`) FE 파드도 BE와 같은 요청 수를 통과시키지만 프록시 비용은 요청당 수십 µs다.

결론: 현재 코드 그대로 **환경당 replicas 1, BE 차트 기본 자원, FE 축소 자원**이면 피크 추정의 3~4배까지 소화한다.

## 병목 후보

1. **요청 로그 양이 가장 먼저 커지는 비용이다.** `logger.level=info`라 요청마다 2줄(수신 · 완료)이 찍힌다. 부하 생성기 60 RPS 탭 하나만 켜도 120줄/s, 피크 260 req/s면 **500줄/s**다. AWS에서는 CloudWatch Logs 수집 요금(GB당 약 $0.5~0.76)이 월 예산 10만 원 안에서 체감되는 항목이라 `LOG_LEVEL=warn`을 `deploy/values-be.yaml`의 `env`로 두는 것을 권장한다(요청 · 응답 지표는 `/metrics`의 Prometheus 카운터와 nginx 로그 익스포터가 이미 따로 낸다). 이 결정은 예산 분석기와 종합에서 확정한다.
2. **커넥션 수가 저장 용량보다 먼저 한계다.** 파드당 최대 5개(`max: 5`, `idle_timeout: 10`). test · prod가 RDS 하나를 공유하므로 Blue-Green 중 최대치는 2환경 × 2(blue+green) × 5 = 20 + 마이그레이션 Job 1~2 = **약 22개**. `db.t4g.micro` max_connections(약 110)에 넉넉하다. replicas 2로 올려도 42개다.
3. **방명록 목록에 인덱스가 없다.** `guestbook(created_at)`에 인덱스가 없어 `ORDER BY created_at DESC LIMIT 50`은 전체 정렬이다. 하루 100건이면 1년에 약 3.6만 행이라 수 ms 수준이고, 50건 고정 LIMIT라 응답 크기는 안전한 상한이다. 10만 행을 넘길 때 인덱스를 더한다(앱 수정, 이번 범위 아님).
4. **파드별 상태가 세 군데다.** `chaosState`, `/api/metrics` 윈도, DB 단절 · 기동 실패 때의 `memoryFallback`. replicas를 2 이상으로 올리면 시연 기능이 파드마다 달라지고, DB 단절 시연 중 쓴 투표 · 방명록은 파드 메모리에만 남아 정상화 뒤 사라진다. **replicas 1이 시연 품질의 전제**다.
5. **지연 주입 중 `/api/info` 폴링은 3.5초에 abort한다.** 2,500ms 지연 + 네트워크 왕복이면 경계에 가깝다. 폴링은 `inflight` 가드로 겹치지 않아 서버 부하는 늘지 않지만, 화면이 "오프라인"으로 깜빡일 수 있다. 사이징 문제가 아니라 시연 연출 참고 사항이다.
6. **FE nginx 로그 익스포터 사이드카.** `metrics.nginxLogExporter.enabled: true`라 FE 파드에 컨테이너가 하나 더 붙는다. 파드 수에는 영향이 없고 자원은 차트가 정한다. 피크 260 req/s의 access log(syslog 경유)는 수십 KB/s로 무시할 수준이다.

## 추천 크기

| 서비스 | replicas (공통 / aws / onprem) | cpu 요청 | memory 요청 | memory 한도 |
|---|---|---|---|---|
| demo-app-be (Fastify, Node 22) | 2 (차트 기본, 공통 파일에 안 씀) / **1** / **1** | 100m | 128Mi | 256Mi |
| demo-app-fe (nginx-unprivileged, 정적 + 프록시) | 2 (차트 기본, 공통 파일에 안 씀) / **1** / **1** | 50m | 32Mi | 64Mi |

- **replicas**: `deploy/aws/values.yaml`, `deploy/onprem/values.yaml`에 이미 `replicas: 1`이 들어 있고 그대로 둔다. 공통 파일(`deploy/values-be.yaml`, `values-fe.yaml`)에는 replicas를 쓰지 않아 차트 기본 2가 남는다. 1로 두는 이유는 세 가지다.
  - **파드 슬롯(AWS)**: t3.medium 3대 = 51개(`infra/envs/aws/main.tf` `node_count = 3`, 노드당 17). 시스템 · 애드온(aws-node, kube-proxy, CoreDNS, LB Controller, External Secrets, Argo Rollouts, 관측 스택) 약 20~25개 + Slack 봇 1 + 앱(test · prod × be · fe) 4개, Blue-Green 중 8개, 마이그레이션 Job 1~2개. replicas 1이면 최대 약 38개로 여유가 있고, 2로 올리면 두 환경 배포가 겹칠 때 약 46개까지 올라가 스케줄 실패 가능성이 생긴다.
  - **시연 기능의 파드별 상태**: 위 병목 4번. 장애 주입 · 정상화 · 메트릭 차트가 한 파드를 봐야 일관된다.
  - **가용성 `demo`**: 파드 1개가 재스케줄되는 수십 초 중단은 허용 범위다. 배포 중 무중단은 Blue-Green이 이미 보장한다.
- **BE 자원**: 차트 기본값 유지. Node 22 + Fastify + drizzle의 기동 RSS는 약 60~90MiB라 128Mi 요청 · 256Mi 한도 안에서 피크(260 req/s, 지연 주입 in-flight 수백 개)에도 메모리 증가가 수 MiB다. CPU는 요청만 있고 한도가 없어 부하 생성기 순간 부하(약 200m)는 노드 여유 CPU를 쓴다. t3.medium 3대의 요청 합계는 BE 100m × 2환경 + FE 50m × 2환경 = 300m / 320Mi로 노드 용량(6 vCPU / 12GiB)의 5% 미만이다.
- **FE 자원**: nginx는 마스터 + 워커(`worker_processes` 기본 `auto`, t3.medium이면 2개) 합쳐 10~30MiB면 충분해 차트 기본값(128Mi/256Mi)이 과하다. `deploy/values-fe.yaml`(공통)에 이미 50m / 32Mi / 64Mi가 들어 있고 그대로 둔다. 맥북 k3d에서 워커가 8~12개여도 64Mi 안이다.
- 마이그레이션 Job(`postgres:17` 이미지, `psql` 1회)은 차트 기본 자원 그대로 둔다.

## DB 크기

- **AWS(선호 대상)**: RDS `db.t4g.micro`(2 vCPU 버스트, 1GiB), gp3 20GB, 단일 AZ — 현재 `infra/envs/aws/main.tf` 값이다. test · prod가 같은 인스턴스를 공유해도 피크 약 210 q/s(단순 쿼리) · 커넥션 22개는 버스트 크레딧을 거의 안 쓴다. 가용성 `demo`라 Multi-AZ는 넣지 않는다. **가장 작은 클래스를 유지한다** — 월 예산 10만 원 제약에서 더 키울 여지도 이유도 없다. `regulated` 데이터 취급에 따른 암호화 · 백업 설정은 보안 분석기 몫이고 크기에는 영향이 없다.
- **온프레미스**: 클러스터 안 Postgres 17, 환경(test · prod)마다 1개. 크기 선택 없음. 커넥션은 환경당 최대 11개로 기본 `max_connections=100`에 문제없다.
- 두 대상 모두 저장 용량(테이블 2개, 연간 수십 MB)보다 **커넥션 수**가 먼저 한계다. 파드 수 × 5(풀 max)로 계산하면 된다.

## 확장 계획

| 단계 | 조치 | 버티는 한계(추정) | 비용 |
|---|---|---|---|
| 현재 | 환경당 replicas 1, BE 100m/128Mi, FE 50m/32Mi, `db.t4g.micro` | 피크 추정 260 req/s의 3~4배: 약 **800~1,000 req/s**(동시 탭 약 300개, 또는 60 RPS 부하 탭 15개). Node 단일 스레드 CPU가 먼저 찬다 | 없음 |
| 1 | `LOG_LEVEL=warn` (`deploy/values-be.yaml` `env`) | 같은 파드 수로 요청당 CPU · 로그 비용 감소. 시연 중 로그 폭증 차단 | 없음, 오히려 절감 |
| 2 | AWS `deploy/aws/values.yaml` `replicas: 2` (test · prod 공통 적용) | 약 1,600~2,000 req/s. 파드 슬롯 51 중 배포 중 약 46개 — `kubectl get pods -A`로 시스템 파드 수를 확인한 뒤 올린다. **시연 기능(장애 주입 · 메트릭)이 파드별로 갈리므로 시연용에서는 권하지 않는다** | 없음 |
| 3 | AWS 노드 추가: `node_count.max` 3→4(슬롯 +17) 또는 `t3.large`(노드당 파드 35개) | replicas 3~4, 동시 탭 1,000개 안팎 | t3.medium 1대 ≈ 월 5만 원 → 예산 초과 |
| 4 | 구조 변경: chaos · 메트릭 상태를 공유 저장소(Redis 등)로, 폴링 → SSE/WebSocket, 정적 자산 CloudFront, `guestbook(created_at)` 인덱스, RDS `db.t4g.small` 이상 | 사용자 수가 브리프 상한(100명/일)의 10배를 넘거나 replicas 2 이상이 필요할 때 | 별도 산정 |

순서는 **replicas → 노드 → 구조**가 원칙이지만, 이 앱은 시연 기능이 파드별 상태에 묶여 있어 **replicas를 올리기 전에 4단계의 상태 공유가 선행**돼야 한다. 100명/일 · 시연용 범위에서는 1단계(로그 레벨) 외에 어느 단계도 당장 필요하지 않다.

## 가정

- **체류 시간 5분/방문, 하루 방문 100회**: 시연용 대시보드(투표 1회, 방명록 1회) 성격에서 추정. 브리프 상한 100명을 그대로 썼다.
- **피크 동시 탭 30개**: 발표 · 시연 중 청중이 링크를 함께 여는 상황. 근거는 README의 "원터치 배포 시연용"과 브리프 가용성 `demo`.
- **부하 생성기 동시 3탭 × 60 RPS**: 발표자 1명이 최대치를 켜고 청중 2명이 따라 켜는 상황으로 잡았다. 명목값 기준이며 브라우저 · ALB 스트림 한도로 실제 도달량은 더 낮을 수 있다.
- **폴링 수치 2.67 req/s/탭, DB 0.67 q/s/탭**: `fe/src/App.tsx`의 `setInterval` 주기(1초 × 2, 3초 × 2)와 `be/src/db/index.ts`의 `HEALTH_TTL_MS = 3000`에서 직접 계산했다.
- **요청당 BE CPU 1ms 미만, 쿼리 수 ms**: Fastify 단순 JSON 라우트와 수천 행 이하 Postgres 테이블의 일반적 수치. 측정하지 않았다. 배포 뒤 `/api/metrics`의 `cpuPercent` · `p95`와 `kubectl top pod`로 확인한다.
- **Node 22 + Fastify 기동 RSS 60~90MiB, nginx 10~30MiB**: 같은 스택의 일반적인 컨테이너 RSS. 측정하지 않았다 — 배포 뒤 `kubectl top pod`로 확인하고 한도를 조정한다.
- **AWS 시스템 · 애드온 파드 20~25개**: `cluster_addons/aws` · `observability` 모듈 구성(LB Controller, External Secrets, Argo Rollouts, 관측 스택)에서 추정. 실제 수는 클러스터에서 확인해야 한다(네트워크 명령은 이번에 실행하지 않았다).
- **`db.t4g.micro` max_connections ≈ 110**: RDS 기본 공식 `LEAST(DBInstanceClassMemory/9531392, 5000)`에 1GiB를 넣은 값.
- **t3.medium 1대 ≈ 월 5만 원, CloudWatch Logs GB당 약 $0.5~0.76**: 서울 리전 온디맨드 시간당 약 $0.052 × 730h ≈ $38, 환율 1,350원 가정. 정확한 값은 예산 분석기가 산정한다.
- **ALB HTTP/2 연결당 스트림 128개**: ALB 기본값. 부하 생성기의 실제 도달 RPS 상한을 설명하는 데만 썼다.
- **FE 자원을 공통 파일에 두는 것**: 두 대상의 nginx 부하 특성이 같아 대상별로 나눌 이유가 없다고 봤다.
- **test 환경은 시연 중 거의 비어 있다**: RDS 공유 합계를 prod 피크 + 탭 1~2개로 잡았다. test에서도 부하 생성기를 켜면 합계가 최대 2배가 되지만 여전히 `db.t4g.micro` 범위다.

## 사이징 결과 (기계용)

```yaml
# 예산 분석기 · 종합이 읽는 최종 값. 단위는 App Chart 값과 같다.
peak:
  be_rps: 260          # prod 환경 1개 기준 명목 피크
  db_qps: 210          # test + prod 합계, RDS 공유
services:
  - name: demo-app-be
    replicas: { default: 2, aws: 1, onprem: 1 }
    resources: { cpu: 100m, memory: 128Mi, memoryLimit: 256Mi }
  - name: demo-app-fe
    replicas: { default: 2, aws: 1, onprem: 1 }
    resources: { cpu: 50m, memory: 32Mi, memoryLimit: 64Mi }
database:
  aws: { instance_class: db.t4g.micro, storage_gb: 20, multi_az: false, shared_by: [test, prod] }
  onprem: { in_cluster_postgres: true, per_environment: true }
recommendations:
  - key: LOG_LEVEL
    value: warn
    where: deploy/values-be.yaml env
    reason: 요청당 2줄 로그 × 피크 260 req/s → CloudWatch Logs 비용 · CPU 절감
```
