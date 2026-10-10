# 트래픽 분석

분석일: 2026-10-10 (yolo 재검증, 기준 커밋 b8bc6d8)

브리프: 하루 이용자 0~100명(상한 100명으로 계획), 가용성 `demo`(시연용), 선호 대상 **AWS**, 월 예산 10만 원 이하, 민감 데이터 취급(`regulated`). 같은 날 2차 분석(커밋 3b0caf7 기준)이 있어 **그 이후 변경(`git log 3b0caf7..HEAD`, 10개 커밋)만 델타 재검증**했다.

## 재검증 요약 (3b0caf7 → b8bc6d8)

| 변경 | 파일 | 부하 · 크기에 미치는 영향 | 결론 |
|---|---|---|---|
| FE 다국어(en/ja/ko) #54 | `fe/src/App.tsx`, `fe/src/i18n.ts`(384줄, 16KB 소스) | 번들 크기만 수십 KB 증가. 세 언어가 한 번들에 들어가고 지연 로딩이 없다. 폴링 주기 · 요청 수는 **그대로**(`setInterval` 1초 × 2, 3초 × 1묶음) | 사이징 영향 없음 |
| FE p95를 클라이언트 측정으로 계산 #56 | `fe/src/App.tsx` (+2/-1) | 이미 쌓던 `beats`(최근 60개, `HISTORY = 60`)를 정렬해 95번째 백분위를 표시. 새 요청 없음. `/api/metrics` 폴링은 그대로 1초(RPS 차트 · 파드별 시리즈에 계속 쓴다) | 사이징 영향 없음 |
| `LOG_LEVEL: warn` | `deploy/values-be.yaml` | 이전 분석의 1단계 권고가 **이미 반영됐다**. 피크 260 req/s × 2줄 info 로그가 사라져 CloudWatch 수집량 · BE CPU가 준다 | 확장 계획 1단계 완료 처리 |
| `APP_VERSION: v2.0.0` | `deploy/values-be.yaml` | 메타데이터 값만 | 없음 |
| Dockerfile `--platform=$BUILDPLATFORM` #57 | `be/Dockerfile`, `fe/Dockerfile` | 빌드 시간만. 런타임 이미지 · 자원 무관 | 없음 |
| 템플릿 · 차트 v2.1.3 → v2.2.1 | `.github/workflows/*.yml`, `.deploy/config.yaml` | `chart-version: 2.2.1`. 차트 본문은 로컬에 없어 자원 기본값이 바뀌었는지 확인 불가(가정 참조) | 가정 |
| T31 green 미리보기 #59 #60 | `deploy/values-fe.yaml` `previewAuth.enabled: true`, `infra/envs/aws/main.tf` `module.preview_auth`, deploy.yml `preview-host` | **AWS에서만** 켠다(onprem · gcp는 `false`). Cognito User Pool(SAML → OIDC 중계) + Secrets Manager 시크릿이 인프라에 추가되고, 클러스터 안에는 oauth2-proxy가 green 미리보기 앞에 붙는다. **승인자 몇 명이 승격 전 green을 열어 보는 경로**라 사용자 트래픽에는 없고, 파드 슬롯과 FE 파드 자원에만 영향을 줄 수 있다 | 아래 "미리보기 영향" 절 |
| BE · DB 코드 | `be/src/**`, `db/init.sql` | **변경 없음** (`git diff 3b0caf7..HEAD -- be/ db/`는 Dockerfile 4줄뿐). 커넥션 풀 `max: 5`, `HEALTH_TTL_MS = 3000`, chaos · metrics 파드별 인메모리 상태 모두 그대로 | 이전 결론 유지 |

**결론: 서비스별 `replicas` · `resources` 추천값은 바뀌지 않는다.** 피크 추정(BE 260 req/s, DB 210 q/s)도 그대로다. 바뀐 것은 (1) 확장 계획 1단계(LOG_LEVEL)가 완료됐고, (2) AWS 파드 슬롯 계산에 미리보기 oauth2-proxy 몫을 더했으며, (3) FE 번들이 커져 첫 방문 전송량이 늘었다는 세 가지다.

## 예상 부하

이 앱의 부하는 **하루 이용자 수가 아니라 동시에 열려 있는 브라우저 탭 수**에 비례한다. 프런트엔드(`fe/src/App.tsx`)가 화면을 열어 둔 동안 계속 폴링하고, 관리자 패널(PR #44)은 탭 하나가 **의도적으로 초당 최대 60회** 요청을 만든다. 이 구조는 3b0caf7 이후 바뀌지 않았다.

### 탭 1개가 만드는 기본 부하 (`fe/src/App.tsx`, b8bc6d8 기준 재확인)

| 호출 | 주기 | 탭 1개당 | BE 처리 (`be/src/routes`) | DB 쿼리 |
|---|---|---|---|---|
| `GET /api/info` | 1초 (`App.tsx:250`), 3.5초 abort, `inflight` 가드 | 1.0 req/s | 메타데이터 조립 + `checkDbHealth()` | **파드당 ≤ 0.33/s** (`SELECT 1`, 3초 TTL 캐시 · in-flight 합치기, `be/src/db/index.ts:59`) |
| `GET /api/metrics` | 1초 (`App.tsx:294`) | 1.0 req/s | 인메모리 60초 윈도 집계 (`routes/metrics.ts`) | 없음 |
| `GET /api/votes` | 3초 (`App.tsx:393`) | 0.33 req/s | 3행 SELECT + 합산 | 1회 |
| `GET /api/guestbook` | 3초 (같은 interval) | 0.33 req/s | `ORDER BY created_at DESC LIMIT 50` | 1회 |
| `GET /api/chaos` | 열 때 1회 | — | 인메모리 상태 반환 | 없음 |
| `POST /api/votes/:id`, `POST /api/guestbook` | 사용자 행동 | 방문당 1~2회 | UPDATE / INSERT | 1회 |

- 탭 1개 ≈ **2.67 req/s, DB 쿼리 0.67/s** — 이전 분석과 같다. p95 클라이언트 계산(#56)은 이미 받고 있던 `/api/info` 응답 시간(`beats`)을 재활용할 뿐 요청을 추가하지 않는다. `/api/metrics`의 서버 p95는 화면에서 안 쓰지만 폴링 자체는 RPS 차트 · 파드별 시리즈 때문에 남아 있다.
- 하루 총량: 100명 × 5분 체류 × 2.67 req/s ≈ **8만 req/일**, 평균 0.9 req/s. 쓰기는 하루 200건 미만.
- 모두 수 ms급 단순 쿼리(테이블 2개 `votes` 3행, `guestbook` 수백~수천 행)다. N+1, 무거운 계산은 없다.

### 관리자 패널이 만드는 합성 부하 (변경 없음)

| 기능 | 선택지 | 부하 특성 |
|---|---|---|
| 트래픽 부하 생성기 (`loadRps`, `App.tsx:349-357`) | 0 / 10 / 30 / 60 RPS | 브라우저가 `setInterval(max(15ms, 1000/rps))`로 `GET /api/votes`를 쏜다. **탭 1개당 최대 60 req/s = DB 60 q/s**. 켠 탭 수만큼 곱해진다 |
| 지연 주입 (`chaos.latencyMs`) | 0 / 1,000 / 2,500 ms | `preHandler`에서 응답을 붙잡는다. CPU는 안 쓰지만 in-flight가 RPS × 지연만큼 쌓인다(60 rps × 2.5s = 150개/탭) |
| 에러율 주입 (`chaos.errorRate`) | 0 / 0.5 / 1.0 | 500을 바로 돌려 부하가 오히려 준다 |
| DB 단절 (`chaos.dbError`) | on/off | `checkDbHealth()` 즉시 false → 파드 메모리 fallback. DB 부하 0 |

시연용 사이징에 미치는 영향(이전 결론 유지):

- **크기(cpu · memory)는 안 바꾼다.** 60 rps `/api/votes`는 Fastify 단순 JSON 라우트 + 3행 SELECT라 요청당 CPU 1ms 미만이고, 탭 3개가 동시에 60 RPS를 켜도 BE CPU는 약 200m 안팎이다. `LOG_LEVEL=warn`이 들어가 요청당 로그 직렬화가 빠졌으므로 이 수치는 이전보다 약간 낮아졌을 뿐 높아질 요인은 없다.
- **replicas는 1이 오히려 맞다.** `chaosState`(`routes/chaos.ts`)와 `/api/metrics` 집계가 **파드별 인메모리 싱글톤**인 구조가 그대로다. 파드가 2개면 장애 주입 · 정상화 · 메트릭 차트가 파드마다 갈린다.
- **Blue-Green과 맞물린다.** green 파드는 새 프로세스라 chaos 상태가 0으로 시작한다. T31 미리보기가 들어오면서 승인자는 승격 전에 green의 "깨끗한 상태"를 SSO 뒤에서 먼저 볼 수 있다 — 시연 흐름(blue에 장애 주입 → green 미리보기 확인 → 승격 → 정상 복귀)이 더 자연스러워졌고 부하는 승인자 탭 1~2개(각 2.67 req/s)뿐이다.

### 피크 추정 (변경 없음)

**BE 약 260 req/s, DB 약 200 q/s** (환경 1개, prod 기준).

| 성분 | 계산 | req/s | DB q/s |
|---|---|---|---|
| 청중 탭 30개 폴링 | 30 × 2.67 | 80 | 30 × 0.67 = 20 |
| 부하 생성기 60 RPS × 탭 3개 | 3 × 60 | 180 | 180 |
| 헬스체크(readiness 10초 + ALB `/`) + Prometheus 수집 | — | < 1 | ≤ 0.33 |
| green 미리보기 승인자 탭 1~2개 (T31, 배포 중에만) | 2 × 2.67 | ≈ 5 | ≈ 1.3 |
| 합계 | | **≈ 265** | **≈ 200** |

미리보기 탭은 green 파드로 가므로 blue(서비스 중) 파드 부하에는 더해지지 않는다. test 환경은 시연 중 거의 비어 있다고 보고 RDS 공유 합계는 약 210 q/s로 둔다. 단순 쿼리 200 q/s는 `db.t4g.micro`에서 CPU 10% 안팎, 커넥션 풀 `max: 5` 점유율은 수 % 수준이다.

정적 자산: i18n 추가로 Vite 번들이 커졌다. 로컬 빌드 산출물(`fe/dist`, gitignore, 2026-10-10 17:22 빌드)은 JS 262KB + CSS 28KB = **약 290KB(비압축)**, gzip이면 80~100KB 수준으로 추정한다(가정 참조). 첫 방문 때만 받고 이후는 API 폴링만 남으므로, 100명/일 × 290KB ≈ 29MB/일 — ALB · 데이터 전송 비용에서 무시할 수준이고 nginx 정적 서빙 CPU에도 영향이 없다. `/api/`, `/health`는 nginx가 `demo-app-be:8000`으로 프록시하므로(`fe/nginx.conf`) FE 파드도 BE와 같은 요청 수를 통과시키지만 프록시 비용은 요청당 수십 µs다.

결론: 현재 코드 그대로 **환경당 replicas 1, BE 차트 기본 자원, FE 축소 자원**이면 피크 추정의 3~4배까지 소화한다.

## 병목 후보

1. ~~요청 로그 양~~ → **해결됨.** `deploy/values-be.yaml`에 `LOG_LEVEL: warn`이 들어가 요청마다 2줄 찍히던 info 로그가 사라졌다(`be/src/index.ts:21`이 `process.env.LOG_LEVEL || 'info'`로 읽는다). 요청 · 응답 지표는 `/metrics` Prometheus 카운터와 nginx 로그 익스포터가 계속 낸다. 예산 분석기는 CloudWatch Logs 수집량을 "요청 로그 없음 + 경고 · 에러 + 기동 로그"로 잡으면 된다.
2. **커넥션 수가 저장 용량보다 먼저 한계다.** 파드당 최대 5개(`max: 5`, `idle_timeout: 10`). test · prod가 RDS 하나를 공유하므로 Blue-Green 중 최대치는 2환경 × 2(blue+green) × 5 = 20 + 마이그레이션 Job 1~2 = **약 22개**. `db.t4g.micro` max_connections(약 110)에 넉넉하다. replicas 2로 올려도 42개다. oauth2-proxy는 DB를 쓰지 않는다.
3. **방명록 목록에 인덱스가 없다.** `guestbook(created_at)`에 인덱스가 없어 `ORDER BY created_at DESC LIMIT 50`은 전체 정렬이다. 하루 100건이면 1년에 약 3.6만 행이라 수 ms 수준. 10만 행을 넘길 때 인덱스를 더한다(앱 수정, 이번 범위 아님).
4. **파드별 상태가 세 군데다.** `chaosState`, `/api/metrics` 윈도, DB 단절 · 기동 실패 때의 `memoryFallback`. replicas를 2 이상으로 올리면 시연 기능이 파드마다 달라진다. **replicas 1이 시연 품질의 전제**다(변경 없음).
5. **지연 주입 중 `/api/info` 폴링은 3.5초에 abort한다.** 2,500ms 지연 + 왕복이면 경계에 가깝다. 클라이언트 p95(#56)는 abort된 비트를 `ok: false`로 빼고 계산하므로 p95 숫자는 지연 주입 중 오히려 낮게 보일 수 있다 — 사이징 문제가 아니라 시연 연출 참고 사항이다.
6. **FE 파드의 보조 컨테이너가 늘었다.** `metrics.nginxLogExporter.enabled: true`(이전부터) + T31 `previewAuth.enabled: true`(AWS만). oauth2-proxy가 FE 파드 사이드카인지 별도 Deployment인지는 차트 본문이 로컬에 없어 확정 못 한다(가정 참조). 어느 쪽이든 **승인자 1~2명의 트래픽만 통과**하므로 자원은 차트 기본값(또는 oauth2-proxy 일반 RSS 20~40MiB)으로 충분하고, FE 컨테이너 자체의 50m / 32Mi / 64Mi는 영향받지 않는다 — 차트가 컨테이너별로 `resources`를 따로 두는 것이 통상이기 때문이다.
7. **i18n 번들 비지연 로딩.** 세 언어 문자열이 전부 한 번들에 들어간다. 16KB 소스라 분할할 이유가 없다. 병목이 아니라 기록용이다.

## 추천 크기

| 서비스 | replicas (공통 / aws / onprem) | cpu 요청 | memory 요청 | memory 한도 |
|---|---|---|---|---|
| demo-app-be (Fastify, Node 22) | 2 (차트 기본, 공통 파일에 안 씀) / **1** / **1** | 100m | 128Mi | 256Mi |
| demo-app-fe (nginx-unprivileged, 정적 + 프록시) | 2 (차트 기본, 공통 파일에 안 씀) / **1** / **1** | 50m | 32Mi | 64Mi |

**이전 분석(3b0caf7)과 동일하다. 바뀌지 않았다.** 현재 `.deploy/plan.yaml`, `deploy/values-fe.yaml`, `deploy/aws/values.yaml`, `deploy/onprem/values.yaml` 값이 이 표와 일치하므로 산출물 수정이 필요 없다.

- **replicas**: `deploy/aws/values.yaml`, `deploy/onprem/values.yaml`에 `replicas: 1`이 들어 있고 그대로 둔다. 공통 파일에는 replicas를 쓰지 않아 차트 기본 2가 남는다. 근거 세 가지(파드 슬롯 · 파드별 상태 · 가용성 `demo`)는 그대로이고, 파드 슬롯 계산만 T31로 갱신한다.
  - **파드 슬롯(AWS, 갱신)**: t3.medium 3대 = 51개(`infra/envs/aws/main.tf:85` `node_count = 3`, 변경 없음). 시스템 · 애드온 약 20~25개 + Slack 봇 1 + 앱(test · prod × be · fe) 4개, Blue-Green 중 8개, 마이그레이션 Job 1~2개, **여기에 T31 oauth2-proxy가 별도 파드라면 환경당 1개(배포 중에만 떠도 최대 2개)**. replicas 1이면 최대 약 **40개**로 여전히 여유가 있다. replicas 2로 올리면 두 환경 배포가 겹칠 때 약 48개까지 올라가 51 한도에 바짝 붙는다 — 이전(46개)보다 2단계 여유가 더 줄었으므로 **replicas 2는 더 권하지 않는다**.
  - **시연 기능의 파드별 상태**: 병목 4번. 변경 없음.
  - **가용성 `demo`**: 파드 1개 재스케줄 수십 초 중단 허용. 변경 없음.
- **BE 자원**: 차트 기본값 유지. Node 22 + Fastify + drizzle 기동 RSS 약 60~90MiB, 피크에도 증가 수 MiB. `LOG_LEVEL=warn`으로 요청당 CPU가 약간 줄었다. CPU 한도 없음 → 순간 부하는 노드 여유 CPU 사용. 노드 요청 합계는 BE 100m × 2환경 + FE 50m × 2환경 = 300m / 320Mi(+ oauth2-proxy 차트 기본값 추정 2 × 100m / 128Mi)로 노드 용량(6 vCPU / 12GiB)의 10% 미만이다.
- **FE 자원**: `deploy/values-fe.yaml`(공통)의 50m / 32Mi / 64Mi 유지. nginx 마스터 + 워커 10~30MiB면 충분하다. i18n으로 커진 정적 파일(약 290KB)은 페이지 캐시에 올라가는 수준이라 메모리 영향이 없다. `previewAuth`가 FE 파드에 컨테이너를 더하더라도 `resources`는 nginx 컨테이너에만 적용된다고 보며, oauth2-proxy 몫은 차트 기본값에 맡긴다.
- 마이그레이션 Job(`postgres:17` 이미지, `psql` 1회)은 차트 기본 자원 그대로 둔다.

## DB 크기 (변경 없음)

- **AWS(선호 대상)**: RDS `db.t4g.micro`(2 vCPU 버스트, 1GiB), gp3 20GB, 단일 AZ — `infra/envs/aws/main.tf:119-121` 값 그대로다. test · prod 공유, 피크 약 210 q/s(단순 쿼리) · 커넥션 22개는 버스트 크레딧을 거의 안 쓴다. 가용성 `demo`라 Multi-AZ 없음. **가장 작은 클래스를 유지한다.** `regulated`에 따른 암호화 · 백업은 보안 분석기 몫이고 크기에는 영향이 없다. T31의 Cognito · Secrets Manager는 DB와 무관하다.
- **온프레미스**: 클러스터 안 Postgres 17, 환경(test · prod)마다 1개. 크기 선택 없음. 커넥션은 환경당 최대 11개.
- 두 대상 모두 저장 용량보다 **커넥션 수**가 먼저 한계다. 파드 수 × 5(풀 max)로 계산하면 된다.

## 확장 계획

| 단계 | 조치 | 버티는 한계(추정) | 비용 | 상태 |
|---|---|---|---|---|
| 현재 | 환경당 replicas 1, BE 100m/128Mi, FE 50m/32Mi, `db.t4g.micro`, `LOG_LEVEL=warn` | 피크 추정 265 req/s의 3~4배: 약 **800~1,000 req/s**(동시 탭 약 300개, 또는 60 RPS 부하 탭 15개). Node 단일 스레드 CPU가 먼저 찬다 | 없음 | 적용됨 |
| 1 | `LOG_LEVEL=warn` (`deploy/values-be.yaml` `env`) | 요청당 CPU · 로그 비용 감소 | 절감 | **완료** (3b0caf7 이후 반영) |
| 2 | AWS `deploy/aws/values.yaml` `replicas: 2` (test · prod 공통 적용) | 약 1,600~2,000 req/s. 파드 슬롯 51 중 배포 중 약 **48개**(T31 oauth2-proxy 포함) — `kubectl get pods -A`로 시스템 파드 수를 확인한 뒤 올린다. **시연 기능이 파드별로 갈리므로 시연용에서는 권하지 않는다** | 없음 | 보류 |
| 3 | AWS 노드 추가: `node_count.max` 3→4(슬롯 +17) 또는 `t3.large`(노드당 파드 35개) | replicas 3~4, 동시 탭 1,000개 안팎 | t3.medium 1대 ≈ 월 5만 원 → 예산 초과 | 보류 |
| 4 | 구조 변경: chaos · 메트릭 상태를 공유 저장소(Redis 등)로, 폴링 → SSE/WebSocket, 정적 자산 CloudFront, i18n 언어별 청크 분할, `guestbook(created_at)` 인덱스, RDS `db.t4g.small` 이상 | 사용자 수가 브리프 상한(100명/일)의 10배를 넘거나 replicas 2 이상이 필요할 때 | 별도 산정 | 보류 |

순서는 **replicas → 노드 → 구조**가 원칙이지만, 이 앱은 시연 기능이 파드별 상태에 묶여 있어 **replicas를 올리기 전에 4단계의 상태 공유가 선행**돼야 한다. 1단계가 끝났으므로 100명/일 · 시연용 범위에서는 **당장 할 일이 없다**.

## 가정

- **체류 시간 5분/방문, 하루 방문 100회**: 시연용 대시보드 성격에서 추정. 브리프 상한 100명을 그대로 썼다.
- **피크 동시 탭 30개**: 발표 · 시연 중 청중이 링크를 함께 여는 상황. 근거는 README의 "원터치 배포 시연용"과 브리프 가용성 `demo`.
- **부하 생성기 동시 3탭 × 60 RPS**: 발표자 1명 + 청중 2명. 명목값 기준이며 브라우저 · ALB 스트림 한도로 실제 도달량은 더 낮을 수 있다.
- **폴링 수치 2.67 req/s/탭, DB 0.67 q/s/탭**: b8bc6d8의 `fe/src/App.tsx:250, 294, 393`(`setInterval` 1초 × 2, 3초 × 1묶음)과 `be/src/db/index.ts:59`(`HEALTH_TTL_MS = 3000`)에서 다시 확인했다. 3b0caf7 이후 폴링 코드 변경은 없다(`git diff`에 `setInterval`/`fetch(` 변경 줄 0개).
- **FE 번들 약 290KB 비압축, gzip 80~100KB**: 로컬 `fe/dist`(gitignore, 2026-10-10 17:22 빌드)의 `index-*.js` 261,505B + `index-*.css` 27,714B. 이 빌드가 b8bc6d8과 정확히 같은 소스인지는 확인하지 못했다(i18n 커밋도 같은 날이라 포함됐을 가능성이 높다). gzip 비율은 React 번들 일반값 3:1 가정. 이번 재검증에서 빌드는 실행하지 않았다.
- **oauth2-proxy의 배치와 자원**: App Chart v2.2.1 본문이 로컬에 없어(`~/.claude/skills/deploy-provision/references/artifacts.md`에도 `previewAuth` 항목 없음) 사이드카인지 별도 Deployment인지 확정하지 못했다. 파드 슬롯은 보수적으로 **별도 파드, 환경당 1개(배포 중 최대 2개)**로 더했고, 자원은 oauth2-proxy 일반 RSS 20~40MiB · 차트 기본 100m/128Mi로 가정했다. FE 컨테이너의 `resources`에는 영향이 없다고 봤다. 실제 배치는 `kubectl get pods -n test`로 첫 배포 뒤 확인한다.
- **승인자 미리보기 탭 1~2개**: 승격 승인자(CODEOWNERS)가 1~2명이라는 가정. green 파드로만 가므로 blue 피크에 더하지 않았다.
- **요청당 BE CPU 1ms 미만, 쿼리 수 ms**: Fastify 단순 JSON 라우트와 수천 행 이하 Postgres 테이블의 일반값. 측정하지 않았다. 배포 뒤 `/api/metrics`의 `cpuPercent`와 `kubectl top pod`로 확인한다.
- **Node 22 + Fastify 기동 RSS 60~90MiB, nginx 10~30MiB**: 같은 스택의 일반적인 컨테이너 RSS. 측정하지 않았다 — 배포 뒤 `kubectl top pod`로 확인하고 한도를 조정한다.
- **AWS 시스템 · 애드온 파드 20~25개**: `cluster_addons/aws` · `observability` 모듈 구성에서 추정. 실제 수는 클러스터에서 확인해야 한다(네트워크 명령은 이번에 실행하지 않았다).
- **`db.t4g.micro` max_connections ≈ 110**: RDS 기본 공식 `LEAST(DBInstanceClassMemory/9531392, 5000)`에 1GiB를 넣은 값.
- **t3.medium 1대 ≈ 월 5만 원**: 서울 리전 온디맨드 시간당 약 $0.052 × 730h ≈ $38, 환율 1,350원 가정. 정확한 값은 예산 분석기가 산정한다. Cognito User Pool(월 MAU 50명 미만 무료 구간) · Secrets Manager 시크릿 1개(월 약 $0.4)의 비용도 예산 분석기 몫이다.
- **ALB HTTP/2 연결당 스트림 128개**: ALB 기본값. 부하 생성기의 실제 도달 RPS 상한을 설명하는 데만 썼다.
- **test 환경은 시연 중 거의 비어 있다**: RDS 공유 합계를 prod 피크 + 탭 1~2개로 잡았다. test에서도 부하 생성기를 켜면 합계가 최대 2배가 되지만 여전히 `db.t4g.micro` 범위다.

## 사이징 결과 (기계용)

```yaml
# 예산 분석기 · 종합이 읽는 최종 값. 단위는 App Chart 값과 같다.
# 2026-10-10 yolo 재검증(b8bc6d8): services · database 값은 3b0caf7 분석과 동일. 바뀌지 않았다.
analyzed_at: 2026-10-10
base_commit: b8bc6d8
previous_commit: 3b0caf7
changed_since_previous: false   # replicas · resources · database 결론 변경 없음
peak:
  be_rps: 265          # prod 환경 1개 기준 명목 피크 (승인자 미리보기 탭 ≈5 포함, green 파드 몫)
  db_qps: 210          # test + prod 합계, RDS 공유
  fe_bundle_kb: 290    # 비압축, i18n 포함 (로컬 dist 기준 추정)
services:
  - name: demo-app-be
    replicas: { default: 2, aws: 1, onprem: 1 }
    resources: { cpu: 100m, memory: 128Mi, memoryLimit: 256Mi }
  - name: demo-app-fe
    replicas: { default: 2, aws: 1, onprem: 1 }
    resources: { cpu: 50m, memory: 32Mi, memoryLimit: 64Mi }
    extra_containers:   # 자원은 차트 기본값에 맡긴다. FE 컨테이너 resources에 포함되지 않음
      - nginx-log-exporter
      - oauth2-proxy    # aws만 (previewAuth.enabled). 사이드카 여부는 가정 — 파드 슬롯은 별도 파드로 계산
database:
  aws: { instance_class: db.t4g.micro, storage_gb: 20, multi_az: false, shared_by: [test, prod] }
  onprem: { in_cluster_postgres: true, per_environment: true }
aws_pod_slots:
  capacity: 51                 # t3.medium × 3, 노드당 17
  peak_estimate_replicas_1: 40 # 시스템 20~25 + 봇 1 + 앱 Blue-Green 8 + Job 2 + oauth2-proxy 2
  peak_estimate_replicas_2: 48
recommendations:
  - key: LOG_LEVEL
    value: warn
    where: deploy/values-be.yaml env
    status: applied            # 3b0caf7 이후 반영됨. 예산 분석기는 요청 로그 0으로 계산
    reason: 요청당 2줄 로그 × 피크 260 req/s → CloudWatch Logs 비용 · CPU 절감
```
