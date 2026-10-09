# 트래픽 분석

## 예상 부하

브리프: 하루 이용자 0~100명(상한 100명으로 계획), 가용성 `standard`(일반 운영), 선호 대상 온프레미스.

이 앱의 부하는 **하루 이용자 수가 아니라 동시에 열려 있는 브라우저 탭 수**에 비례한다. 프런트엔드(`fe/src/App.tsx`)가 화면을 열어 둔 동안 계속 폴링하기 때문이다.

| 호출 | 주기 | 탭 1개당 | BE 처리 | DB 쿼리 |
|---|---|---|---|---|
| `GET /api/info` | 1초 | 1.0 req/s | 메타데이터 조립 | `SELECT 1` (checkDbHealth) 1회 |
| `GET /api/votes` | 3초 | 0.33 req/s | 3행 SELECT + 합산 | 1회 |
| `GET /api/guestbook` | 3초 | 0.33 req/s | `ORDER BY created_at DESC LIMIT 50` | 1회 |
| `POST /api/votes/:id`, `POST /api/guestbook` | 사용자 행동 | 방문당 1~2회 | UPDATE / INSERT | 1회 |

- 탭 1개 ≈ **1.67 req/s, DB 쿼리 1.67/s**. 모두 수 ms급 단순 쿼리(테이블 2개, 수십~수천 행).
- 하루 총량: 100명 × 5분 체류 × 1.67 req/s ≈ **5만 req/일**, 평균 0.6 req/s. 쓰기는 하루 200건 미만.
- 피크(시연 · 발표 중 링크 공유): 동시 탭 30개 → **약 50 req/s, DB 50 q/s**. Fastify 단순 JSON 라우트는 요청당 CPU 1ms 미만이라 BE 파드 1개(요청 100m)로 여유가 크고, 커넥션 풀 `max: 5`(`be/src/db/index.ts`)로 ms급 쿼리 50 q/s는 풀 점유율 10% 안쪽이다.
- 정적 자산: Vite 빌드 결과를 nginx가 서빙한다. 첫 방문 때만 받고(JS 번들 수백 KB), 이후는 API 폴링만 남아 nginx 부하는 무시할 수준이다. `/api/`, `/health`는 nginx가 `demo-app-be:8000`으로 프록시하므로 FE 파드도 BE와 같은 요청 수를 통과시킨다.
- 헬스체크: readiness `/health`(10초 주기, 파드당)와 AWS ALB 헬스체크(`/health` → FE nginx → BE, `SELECT 1`)가 더해지지만 초당 1회 미만이다.

결론: 현재 코드 그대로 **replicas 1, 차트 기본 자원**이면 피크 추정의 5~10배까지도 소화한다.

## 병목 후보

1. **1초 폴링 `/api/info`가 DB까지 간다.** 메타데이터 응답인데 호출마다 `checkDbHealth()`로 `SELECT 1`을 날린다. 전체 DB 쿼리의 60%가 이 호출이다. 동시 탭이 수백 개가 되면 가장 먼저 커지는 부하이고, 몇 초 캐시만 해도 DB 부하가 절반 이하로 준다(앱 수정 사항, 이번 범위 아님).
2. **방명록 목록에 인덱스가 없다.** `guestbook(created_at)`에 인덱스가 없어 `ORDER BY created_at DESC LIMIT 50`은 전체 정렬이다. 하루 100건이면 1년에 약 3.6만 행이라 수 ms 수준이지만, 10만 행을 넘기면 3초 주기 폴링마다 비용이 는다. 페이지네이션(offset/cursor)도 없어 50건 고정이다 — 부하 면에서는 오히려 안전한 상한이다.
3. **요청 로그 양.** `logger.level=info`라 요청마다 2줄(수신 · 완료)이 찍힌다. 피크 50 req/s면 100줄/s, 하루 수백만 줄이다. 온프레미스 k3d(맥북)는 kubelet 로그 회전(파일당 10Mi)으로 디스크는 지키지만 로그 수집을 붙이면 가장 큰 볼륨이 된다. `LOG_LEVEL=warn`은 `deploy/values-be.yaml`의 `env`로 끌 수 있다.
4. **DB 커넥션 수.** 파드당 최대 5개(`max: 5`, `idle_timeout: 10`). test · prod가 RDS 하나를 공유하는 AWS에서 Blue-Green 중 최대치는 2환경 × 2(blue+green) × 5 = 20 + 마이그레이션 Job 1~2 = **약 22개**. `db.t4g.micro`의 max_connections(약 110)에 넉넉하다. replicas 2로 올려도 42개로 문제없다.
5. **메모리 fallback은 파드별 상태다.** 기동 시 DB 연결에 실패하면(`initDb`) 그 파드는 `db`가 끝까지 `null`이라 투표 · 방명록이 파드 메모리에 쌓이고, 다른 파드와 값이 다르다. `/health`는 이 상태에서도 200을 돌려 Blue-Green 승격을 막지 못한다. **replicas를 2 이상으로 늘리는 전제는 DB가 항상 먼저 떠 있는 것**이다(두 대상 모두 Terraform이 DB를 앱보다 먼저 만들므로 평상시엔 해당 없음, 재기동 순서 꼬임만 주의).
6. **N+1 쿼리, 무거운 계산은 없다.** 라우트 4개가 모두 쿼리 1회로 끝난다. 득표율 계산은 3행 합산이다.

## 추천 크기

| 서비스 | replicas (공통 / aws / onprem) | cpu 요청 | memory 요청 | memory 한도 |
|---|---|---|---|---|
| demo-app-be (Fastify, Node 22) | 2 (차트 기본, 공통 파일에 안 씀) / **1** / **1** | 100m | 128Mi | 256Mi |
| demo-app-fe (nginx-unprivileged, 정적 + 프록시) | 2 (차트 기본, 공통 파일에 안 씀) / **1** / **1** | 50m | 32Mi | 64Mi |

- **replicas**: `deploy/aws/values.yaml`, `deploy/onprem/values.yaml`에 이미 `replicas: 1`이 들어 있고, 그대로 둔다. 공통 파일(`deploy/values-be.yaml`, `values-fe.yaml`)에는 replicas를 쓰지 않아 차트 기본 2가 남는다.
  - AWS: t3.medium 3대 = 파드 슬롯 51개. 시스템 · 애드온(aws-node, kube-proxy, CoreDNS, LB Controller, External Secrets, Argo Rollouts, 관측 스택) 약 20~25개 + Slack 봇 1 + 앱(test · prod × be · fe) 4개, Blue-Green 중 8개. replicas 1이면 약 35개로 여유가 있고, 2로 올리면 배포 중 약 45개까지 올라가 두 환경 배포가 겹치면 스케줄 실패가 날 수 있다.
  - 온프레미스: k3d 1노드라 replicas 2는 노드 장애를 못 막고 자원만 두 배 쓴다. Blue-Green이 배포 중 무중단은 이미 보장한다.
  - 가용성 `standard`: 파드 1개가 재스케줄되는 수십 초 중단은 허용 범위다.
- **BE 자원**: 차트 기본값 유지. Node 22 + Fastify + drizzle의 기동 RSS는 약 60~90MiB라 128Mi 요청 · 256Mi 한도 안에서 피크(50 req/s)도 메모리 증가가 거의 없다. CPU는 요청만 있고 한도가 없어 순간 부하는 노드 여유 CPU를 쓴다.
- **FE 자원**: nginx는 마스터 + 워커(`worker_processes auto`, 코어 수만큼) 합쳐 10~30MiB면 충분해 기본값(128Mi/256Mi)이 과하다. 50m / 32Mi / 64Mi를 두 대상의 `deploy/values-fe.yaml`(공통)에 둔다. 코어가 많은 맥북 k3d에서 워커가 8~12개여도 64Mi 안이다.
- 마이그레이션 Job(`postgres:17` 이미지, `psql` 1회)은 차트 기본 자원 그대로 둔다.

## DB 크기

- **온프레미스(선호 대상)**: 클러스터 안 Postgres 17, 환경(test · prod)마다 1개(`infra/envs/onprem/main.tf`의 `module.database` for_each). 크기 선택 없음. 데이터는 k3d 로컬 PV(맥북 디스크)에 있고, 테이블 2개 · 하루 수백 행이라 연간 수십 MB 수준이다. 커넥션은 환경당 최대 10~11개(파드 2개 × 5 + Job)로 Postgres 기본 `max_connections=100`에 문제없다.
- **AWS**: RDS `db.t4g.micro`(2 vCPU 버스트, 1GiB, 현재 `main.tf`에 설정됨), gp3 20GB, 단일 AZ. test · prod가 같은 인스턴스를 공유해도 피크 50 q/s · 커넥션 22개로 버스트 크레딧을 거의 안 쓴다. 가용성 `standard`라 Multi-AZ는 넣지 않는다. **가장 작은 클래스를 유지한다** — 월 예산 10만 원 제약에서 더 키울 여지도 이유도 없다.
- 두 대상 모두 저장 용량보다 **커넥션 수**가 먼저 한계다. 파드 수 × 5(풀 max)로 계산하면 된다.

## 확장 계획

| 단계 | 조치 | 버티는 한계(추정) | 비용 |
|---|---|---|---|
| 현재 | replicas 1, BE 100m/128Mi, FE 50m/32Mi, 가장 작은 DB | 동시 탭 약 200개(≈330 req/s, DB 330 q/s). BE 파드 1개 CPU가 먼저 찬다 | 없음 |
| 1 | 앱 수정: `/api/info`의 `SELECT 1`을 수 초 캐시, 폴링 주기 완화(1s→3~5s), `guestbook(created_at)` 인덱스 | 같은 파드 수로 DB 부하 60% 이상 감소, 동시 탭 500개 이상 | 없음(코드 변경, 이번 배포 범위 밖) |
| 2 | AWS `deploy/aws/values.yaml` `replicas: 2` (test · prod 공통 적용) | 동시 탭 약 400개. 파드 슬롯 51 중 배포 중 약 45개 — 시스템 파드 수를 `kubectl get pods -A`로 확인한 뒤 올린다. 온프레미스는 1노드라 의미 없음 | 없음 |
| 3 | AWS 노드 추가: `node_count.max` 3→4(슬롯 +17) 또는 `t3.large`(노드당 파드 35개) | replicas 3~4, 동시 탭 1,000개 안팎 | t3.medium 1대 ≈ 월 5만 원 → 예산 초과 |
| 4 | 구조 변경: 폴링 → SSE/WebSocket, 정적 자산 CDN(CloudFront), 방명록 페이지네이션, RDS `db.t4g.small` 이상 | 사용자 수가 브리프 상한(100명/일)의 10배를 넘을 때 | 별도 산정 |

순서는 **replicas → 노드 → 구조**다. 다만 이 앱은 폴링 구조 때문에 1단계(앱 수정)가 replicas보다 싸고 효과가 커서 먼저 둔다. 100명/일 범위에서는 어느 단계도 당장 필요하지 않다.

## 가정

- **체류 시간 5분/방문, 하루 방문 100회**: 시연용 대시보드(투표 1회, 방명록 1회) 성격에서 추정. 브리프 상한 100명을 그대로 썼다.
- **피크 동시 탭 30개**: 발표 · 시연 중 청중이 링크를 함께 여는 상황을 가정. 근거는 README의 "원터치 배포 시연용"과 Hackathon 문구.
- **요청당 BE CPU 1ms 미만, 쿼리 수 ms**: Fastify 단순 JSON 라우트와 수천 행 이하 Postgres 테이블의 일반적 수치. 측정하지 않았다.
- **Node 22 + Fastify 기동 RSS 60~90MiB, nginx 10~30MiB**: 같은 스택의 일반적인 컨테이너 RSS. 측정하지 않았다 — 배포 뒤 `kubectl top pod`로 확인하고 한도를 조정한다.
- **AWS 시스템 · 애드온 파드 20~25개**: `cluster_addons/aws` · `observability` 모듈 구성(LB Controller, External Secrets, Argo Rollouts, 관측 스택)에서 추정. 실제 수는 클러스터에서 확인해야 한다(네트워크 명령은 이번에 실행하지 않았다).
- **`db.t4g.micro` max_connections ≈ 110**: RDS 기본 공식 `LEAST(DBInstanceClassMemory/9531392, 5000)`에 1GiB를 넣은 값.
- **t3.medium 1대 ≈ 월 5만 원**: 서울 리전 온디맨드 시간당 약 $0.052 × 730h ≈ $38, 환율 1,350원 가정. 정확한 값은 예산 분석기가 산정한다.
- **FE 자원을 공통 파일에 두는 것**: 두 대상의 nginx 부하 특성이 같아 대상별로 나눌 이유가 없다고 봤다.
