# 서비스 분석

분석일: 2026-10-11 (yolo 재검증, 기준 커밋 origin/main 55b1586 · 브랜치 `yolo/env-var-tweak`의 작업 트리에는 `deploy/values-be.yaml` `APP_VERSION: v2.1.1`이 미커밋 상태로 있음)

브리프(2026-10-10): 하루 100명 이하 · 월 10만 원 이하 · 민감 데이터 **예**(`regulated`) · 선호 대상 **AWS** · 가용성 **시연용**.
직전 문서(기준 b0d3df7, 2026-10-11 02:54)를 `git diff b0d3df7 HEAD -- be/src fe/src deploy/values-be.yaml`로 델타 재검증했다. 그 사이 서비스 성격에 닿는 변경은 **T25 CPU 부하 테스트** 하나다: BE에 `GET /api/load/config`(항상) · `POST /api/load/cpu`(`LOAD_TEST_ENABLED=true`일 때만 등록, `be/src/routes/load.ts`)와 Worker Thread 풀(`be/src/load/cpu-pool.ts` · `cpu-worker.ts`), FE에 `CpuLoadPanel`(시연 도구 패널 두 번째 칸), `APP_VERSION` v2.1.0, `/api/metrics`의 `cpuPercent` 100% 상한 제거. 그 밖의 변경(T33 onprem-wsl 대상, T38 gcp · onprem green 미리보기, T39 다중 대상 matrix, 템플릿 v2.17.0, FE `<title>`)은 배포 체계 쪽이다. 아울러 직전 문서가 b0d3df7 시점에 이미 옛 값으로 적고 있던 네 가지 — BE `replicas: 2` + HPA(T29), `CHAOS_ENABLED`가 `values-be.test.yaml`로 이동(T35), AWS test 환경이 RDS 대신 온프레미스 DB를 씀(T33 db_link), 플랫폼 smoke가 `expect_body`로 본문을 검사(T28, 템플릿 v2.4.0+) — 를 이번에 현재 값으로 바로잡았다.

## 요약

- **무엇을 하는가**: 원터치 배포 플랫폼 **시연용 웹앱** "Real-Time Deployment Status"(영어 기본, 한국어 · 일본어 전환). 화면 하나에 네 영역이 있다.
  1. 배포 상태 · 버전 모니터링 — `/api/info`를 1초마다 폴링해 버전 · 호스트명(파드) · 가동시간 · DB 연결 상태를 표시하고, 호스트명이 바뀌면 "새 버전으로 전환됨" 배지를 띄운다(Blue-Green 승격을 눈으로 보여주는 장치). 롤아웃 타일은 최근 60회 응답의 버전별 비율을 보여준다.
  2. 파드별 트래픽 · CPU · 메모리 차트 — `/api/metrics`를 1초마다 폴링(파드별 인메모리 집계, `be/src/routes/metrics.ts`). 응답 시간 중앙값 · p95는 브라우저가 `/api/info` 폴링으로 측정한 값이다. **`cpuPercent`는 이제 100%를 넘을 수 있다**(프로세스 CPU에 Worker Thread가 포함되므로, `metrics.ts:18-19`). 파드 목록은 6초(`POD_TTL_MS`) 안에 응답한 파드만 보인다.
  3. 배포 전략 투표(`/api/votes`, 3개 항목)와 방명록(무중단 DB CRUD 검증용).
  4. **시연 관리자 패널**(`App.tsx` "Demo Tools"), 세 칸:
     - 브라우저 쪽 트래픽 부하 생성기(0 · 10 · 30 · 60 RPS로 `/api/votes` 호출).
     - **CPU 부하 테스트(T25, 새로 추가)** — `fe/src/CpuLoadPanel.tsx`. 로드 때 `GET /api/load/config`를 한 번 읽고 `enabled`가 아니면 패널을 비활성화한다. 켜져 있으면 5 · 10 · 20 RPS, 약 · 중 · 강, 1 · 3 · 5분을 골라 `POST /api/load/cpu {intensity}`를 탭에서 보낸다. 브라우저당 동시 8건 상한, 요청 타임아웃 4초, 시간 만료 · 패널 닫기 · 탭 숨김 · 전체 초기화 때 멈춘다. 서버가 404를 돌리면(플래그 꺼짐) 스스로 비활성화한다. 목적은 **HPA 자동 확장을 눈으로 보는 것**(README "CPU 오토스케일 테스트").
     - BE 장애 주입(`/api/chaos`: 지연 ms · 에러율 · DB 단절 토글, `/api/chaos/reset`으로 원복). `GET /api/chaos`의 `enabled:false`면 버튼을 비활성화한다(`App.tsx:930-971`).
- **사용자**: 시연을 보는 해커톤 심사자 · 팀원. 로그인 · 회원 개념이 없고 모두 익명이다. 언어 선택 · 투표 여부는 `localStorage`에만 남는다.
- **구성**: 서비스 두 개 + DB 하나 (+ green 미리보기가 켜진 대상에서는 FE 릴리스마다 oauth2-proxy 파드 하나).
  - `demo-app-fe`: Vite + React 19 정적 빌드를 비특권 nginx(포트 3000)가 서빙. `/api/`와 `/health`를 클러스터 내부 `demo-app-be:8000`(active Service)으로 프록시(`fe/nginx.conf`). 사용자에게 노출되는 유일한 서비스. `previewAuth.enabled: true`(공통 `deploy/values-fe.yaml`)라 aws · gcp · onprem(기본 기기)에서 oauth2-proxy(`demo-app-fe-preview-auth`)가 뜨고, 승인자가 `green[-yolo][-gcp|-onprem].…` 호스트로 green FE를 본다. onprem-secondary · onprem-wsl은 `.github/scripts/deploy-targets.sh`가 `auth=false`로 끈다. **미리보기의 `/api/`는 `previewAuth.routes`로 `demo-app-be-preview:8000`(green BE)에 바로 간다**(`values-fe.yaml:40-45`, App Chart v2.4.0+).
  - `demo-app-be`: Fastify 5 + Drizzle ORM + postgres.js(포트 8000). 라우트 — `/health`, `/healthz/liveness`, `/metrics`(Prometheus, FE가 프록시하지 않음), `/api/info`, `/api/metrics`, `/api/votes` GET, `/api/votes/:id` POST, `/api/guestbook` GET/POST, `/api/chaos` GET(항상), `/api/chaos` POST · `/api/chaos/reset` POST(**`CHAOS_ENABLED=true`일 때만**, `chaos.ts`), **`/api/load/config` GET(항상)**, **`/api/load/cpu` POST(`LOAD_TEST_ENABLED=true`일 때만, `load.ts:11-15`)**. 값 파일: 공통 `deploy/values-be.yaml`은 `replicas: 2`, HPA 2~6(CPU 70%, 요청 100m/128Mi, 한도 256Mi), `APP_VERSION: v2.1.0`(작업 트리 v2.1.1), **`LOAD_TEST_ENABLED: "true"`(test · prod 공통)**, `PGSSL: require`, `LOG_LEVEL: warn`. `CHAOS_ENABLED: "true"`는 `deploy/values-be.test.yaml`에만 있어 **prod에는 장애 주입 POST가 없다**(T35). onprem은 `deploy/onprem/values.yaml`이 `replicas: 1` · HPA 끔.
  - PostgreSQL 17. 테이블 두 개(`votes`, `guestbook`), 스키마는 `db/init.sql`. BE는 DB에 못 붙으면 **인메모리 fallback**으로 동작하되, `/health`가 503을 돌려 그 상태를 숨기지 않는다. CPU 부하 API는 DB를 쓰지 않는다.
- **성격 판단**: 금융 · 결제 · 공공 · 고객용 서비스가 아니라 **내부 시연 도구**다. 브리프의 이용자 ≤100명, 예산 ≤10만 원, 가용성 `demo`와 일치한다. `regulated` 분류는 아래 "다루는 데이터"에서 따로 다룬다. T25는 서비스 성격을 바꾸지 않지만 **사용 패턴**(요청당 CPU가 큰 온디맨드 작업)과 **릴리스 주의**(prod에서도 같은 플래그로 켜짐, Worker Thread)를 바꾼다 — 아래 두 절.

## 다루는 데이터

| 테이블 | 필드 | 성격 |
|---|---|---|
| `votes` | `option_key`, `title`, `count`, `updated_at` | 집계 숫자 3행. 누가 투표했는지 저장하지 않음(1인 1투표는 브라우저 `localStorage`에서만) |
| `guestbook` | `name`(≤50자), `message`(≤500자), `created_at` | 사용자가 자유 입력하는 **닉네임과 응원 메시지**. 삭제 · 수정 API 없음, 보존 기간 없음 |

프로세스 메모리에만 있는 상태: 장애 주입 설정(`chaosState`), 최근 60초 요청 집계(`/api/metrics`), fallback 모드일 때의 투표 · 방명록 사본, **CPU 작업 큐(최대 8건, `cpu-pool.ts:23`)**. 브라우저에만 있는 상태: 투표 여부(`demo_voted_option`), 언어(`demo_lang`), CPU 부하 패널의 집계(sent · ok · failed · 429 · skipped).

- **코드에서 찾은 것**: 로그인 · 세션 · 인증 토큰 · 결제 · 이메일 · 전화번호 · 주소 · 주민번호 필드가 **없다**. 입력 폼은 방명록의 닉네임 · 메시지 두 칸뿐이고, 투표는 버튼 클릭만 보낸다. 데이터 모델은 개인정보를 수집하도록 설계되지 않았다. T25의 `POST /api/load/cpu`는 본문이 `intensity` enum 하나(`additionalProperties: false`)이고 **아무것도 저장하지 않으며**, 응답은 `hostname`(파드 이름, `/api/info`와 같은 수준의 운영 정보) · `elapsedMs` · `checksum`(고정 입력의 sha256 반복값)뿐이다.
- **브리프와 비교 — `handles_sensitive_data: yes`**: 코드 조사 결과와 어긋난다. 분석은 답변을 고치지 않고, "예"가 무엇을 가리킬 수 있는지와 그것이 배포에 무엇을 요구하는지를 적는다.
  1. **방명록 자유 텍스트**(가장 그럴듯함). 사용자가 실명 · 소속 · 연락처를 적으면 그대로 저장되고 지울 API가 없다. 이 경우 "개인정보가 들어올 수 있는 저장소"로 보는 것이 보수적이고 타당하다. → 요구: 저장 데이터 암호화, 접근 통제, (개인정보라면) 국외 이전 금지 정도. **사내 보관을 요구하지 않는다.**
  2. **인프라 비밀값 · 운영자 식별 정보**(DB 자격증명, Slack 봇 토큰, oauth2-proxy 클라이언트 · 쿠키 시크릿 `demo-app-preview-oauth2-proxy-*`, T33 온프레미스 DB 자격증명 `demo-app-db-onprem-test`). 앱 데이터가 아니라 배포 체계의 비밀값이고, Secrets Manager → External Secrets로 다룬다. Cognito User Pool에는 Identity Center에서 SAML로 로그인한 **승인자의 페더레이션 사용자 레코드(이메일)** 가 생긴다. 이는 팀 운영자 계정 정보이며 원장은 Identity Center(ADR 0015)다. 서비스 데이터 보관 위치 판단과 무관.
  3. **운영 정보 노출**(`/api/info` · `/api/load/cpu`의 파드 호스트명 · 리전, `/api/metrics`의 CPU · 메모리). 시연 기능이지 규제 대상 데이터가 아니다.
  4. **보수적 답변**(해커톤 평가 · 조직 기본 정책). 이 경우 요구 사항은 `compliance: regulated`의 운영 승인 관문 유지가 전부다.
  어느 해석이든 금융(전자금융) · 공공(CSAP) · 의료처럼 **법령이 사내 또는 특정 설비 보관을 강제하는 데이터는 없다.**
- **결정 — 데이터 보관 위치 제한: 없음** (배포 대상 추천 규칙 1번 입력). 근거:
  - 서비스 성격(시연 · 익명 · 비금융 · 비공공)상 사내 보관 의무가 없다.
  - "예"를 가장 엄격하게 "방명록에 개인정보가 들어온다"로 읽어도 요구되는 것은 **국내 보관**이지 사내 보관이 아니다. prod 데이터가 있는 AWS 서울 리전(`ap-northeast-2`)의 RDS는 물리적으로 국내이고, `infra/envs/aws/variables.tf:7-13`이 `region == "ap-northeast-2"`를 validation으로 강제한다. Cognito User Pool도 같은 리전. RDS 저장 암호화는 모듈 기본값. → **AWS 서울 리전이 국내 보관 요구를 충족한다.** AWS test 환경의 DB는 T33으로 **온프레미스(맥북 k3d Postgres, tailnet `demo-app-db-test.tailb7ed7e.ts.net`)** 라 국내 · 사내 양쪽을 만족한다.
  - 사용자 스스로 선호 대상을 AWS로 바꿨다. "예"가 사내 보관 요구를 뜻한다고 볼 근거가 없다.
  - 따라서 규칙 1번에는 "제한 없음(국내 보관 요구가 있더라도 서울 리전으로 충족)"으로 넘긴다. `compliance: regulated`는 유지한다 — 사람이 바꾸는 값이고, 바꿀 근거 질문은 "방명록 자유 텍스트를 개인정보로 볼 것인가"다.
- **비밀값**: 코드에 비밀값은 없다. `DATABASE_URL` 기본값 `postgresql://demo:demo@localhost:5432/demo`는 로컬 전용이고, 배포에서는 `demo-app-db` Secret이 덮는다(`deploy/values-be.yaml` `envFromSecrets`). `values-fe.yaml`의 `issuerUrl` · `remoteKey`(Secrets Manager ARN)는 식별자이지 비밀값이 아니다.
- **데이터 공유 범위(변경됨)**: `infra/envs/aws/main.tf:210-222`의 `service_base`는 `var.db_link`에 적힌 환경(기본값 **test**)에 RDS 대신 온프레미스 DB를 넘긴다. 따라서 **AWS test와 prod는 이제 서로 다른 데이터베이스**를 쓴다(직전 문서의 "같은 RDS · 같은 `demo`"는 더 이상 사실이 아님). gcp(Cloud SQL) · onprem(자체 Postgres)도 각자다. test에서 쓴 방명록이 prod 화면에 보이지 않는다. 그래도 아래 smoke에서 INSERT는 넣지 않는다(prod smoke는 prod DB에 남기 때문).

## 가용성 요구

- **중단의 영향**: 멈추면 시연 화면이 깨진다(상단 상태 카드가 "Outage", 투표 · 방명록 미동작). 곤란한 사람은 시연 진행자와 관람자뿐이다. 외부 고객 · 매출 · 법적 의무는 걸려 있지 않고, 시연 밖 시간에는 아무도 쓰지 않는다.
- **브리프와 비교**: 가용성 답변 `demo`(시연용)가 서비스 성격과 정확히 맞는다. 다만 이 앱의 시연 주제가 "무중단 배포"와 "자동 확장"이므로 **배포 중 끊김 없음**과 **부하 때 파드가 늘어나는 모습**은 실제 요구다. 전자는 복제 수가 아니라 Blue-Green 승격 흐름(green 기동 → smoke → 트래픽 전환)이, 후자는 HPA가 보장한다.
- **결정 — 가용성 수준**: 가용성 요구만 보면 **인스턴스 하나로 충분**하다(`demo`). 현재 값은 **BE `replicas: 2` + HPA 2~6(aws · gcp), onprem 1; FE 모든 대상 1**이다(T29). BE 2 + HPA는 가용성 때문이 아니라 **자동 확장 시연(T29 · T25)** 때문이며, 트래픽 분석기가 현재 값 기준으로 사이징했다. 서비스 분석 관점의 결론은 "가용성으로는 1이면 되고, 2 + HPA는 시연 기능 요구"다. 시연용 `replicas: 1` 규칙과 어긋나는 부분은 종합 단계가 test만 1로 되돌릴지(`values-be.test.yaml`) 정한다(트래픽 분석 "주의").
  - 파드 ≥ 2의 부작용은 그대로다: (a) fallback 상태에서 파드마다 다른 투표 · 방명록, (b) 장애 주입 상태가 파드별(test 전용), (c) `/api/metrics`가 응답한 파드의 값만 내림(FE가 파드별로 모아 그린다). **T25의 CPU 부하는 반대로 파드가 여럿일 때 의도대로 동작한다** — 요청당 연산량이 고정이라 Service 라운드로빈으로 파드 수만큼 분산되고(`cpu-worker.ts:5` 주석), HPA가 늘린 새 파드가 바로 부하를 나눠 받는다.
- **장애 주입이 가용성에 미치는 것**: `index.ts:43-48`의 preHandler가 `/health` · `/healthz/*` · `/api/chaos` · `/api/metrics` · **`/api/load/`** 를 제외하므로 **에러율 · 지연 주입은 readiness와 CPU 부하 API에 영향이 없다.** `chaos.dbError`도 `/health`는 `ignoreChaos: true`로 실제 DB만 본다(`health.ts:9`). POST는 `CHAOS_ENABLED`로 게이트되고 **prod에는 그 값이 없어** prod에서는 조회만 된다.
- **CPU 부하가 가용성에 미치는 것(새로 추가)**: 연산은 파드당 **재사용 Worker Thread 1개**에서 돌고 메인 이벤트 루프는 비워 둔다(`be/tests/load.test.ts` "main event loop remains responsive"). 큐가 8건을 넘으면 즉시 429, 한 건이 2초를 넘으면 워커를 종료 · 재생성하며 503(`cpu-pool.ts:23,31-40`). 따라서 **부하 중에도 `/health` · `/api/info` · 폴링은 응답한다.** 다만 값 파일에 CPU **한도(limit)가 없어** 파드가 노드의 남는 코어를 그대로 쓰고(워커 1개라 파드당 최대 약 1코어), HPA가 CPU 요청 100m 대비 70%를 넘으면 늘린다. 메모리 한도 256Mi는 워커 1개 + 32바이트 버퍼라 문제 없다. 이 API에는 인증이 없어 플래그가 켜진 공개 환경(prod 포함)에서는 **누구나 CPU를 태울 수 있다** — 통제는 보안 분석기 몫이고, 끄는 스위치는 `LOAD_TEST_ENABLED: "false"` + BE 재배포다.
- **미리보기 인증이 가용성에 미치는 것**: oauth2-proxy · Cognito · Identity Center는 **승인자가 green을 눈으로 볼 때만** 쓰인다. 사용자 트래픽(active Ingress) · 승격 버튼 · promote-judge는 이 경로를 거치지 않으므로 Cognito 장애가 서비스 가용성에는 영향이 없다.
- **DB**: prod는 단일 인스턴스(RDS `db.t4g.micro`, single AZ), test는 맥북 Postgres로 충분. 데이터는 시드 + 방명록이라 유실돼도 재시드 가능(`init.sql`의 테이블 · 시드는 모두 멱등).

## 사용 패턴

- **평상시는 읽기 위주의 폴링**(변경 없음). 탭 하나가 `/api/info` 1초 1회(`App.tsx:253`), `/api/metrics` 1초 1회(`App.tsx:297`), `/api/votes` · `/api/guestbook` 3초 1회씩(`App.tsx:396`) → **탭당 약 2.7 req/s**. `/api/chaos` · `/api/load/config` GET은 로드 때 1회씩. 동시 100탭이면 약 270 req/s. 모두 FE nginx를 거쳐 active BE로 간다.
- **DB 부하는 폴링보다 작다**. `checkDbHealth()`가 3초 TTL 캐시와 타임아웃을 갖고(`db/index.ts:59-90`), `/api/info` · `/health`의 `SELECT 1`은 탭 수와 무관하게 **파드당 3초에 1회**다. `/api/metrics` · `/api/load/*`는 DB를 쓰지 않는다. 남는 DB 질의는 `/api/votes` · `/api/guestbook`(탭당 0.67 q/s)뿐이다. 연결 풀은 `max: 5`, `idle_timeout: 10`, `connect_timeout: 2`, TLS는 `PGSSL=require`.
- **온디맨드 CPU 집약 작업(새로 추가, T25)**: 시연자가 패널에서 켤 때만 발생한다. 탭당 최대 20 RPS × 최대 300초, 동시 8건. 요청 한 건의 연산은 sha256 반복 5,000(light) · 15,000(medium) · 30,000(heavy)회 고정. 이 맥북(Apple Silicon, Node 24)에서 재서 **light 3ms · medium 9ms · heavy 18ms**였고 t3.medium(x86)은 1.5~3배로 가정한다(가정 표). 파드당 워커 1개가 직렬로 처리하므로 **파드당 처리 상한 ≈ 1 / 요청당 CPU 시간**(heavy 50ms면 약 20 RPS)이고, 그 이상은 큐 8건 뒤 429다. CPU로 보면 heavy 20 RPS가 한 파드에 몰리면 요청 100m 대비 **약 4~10배**(360m~1,000m) → HPA 목표 복제 수가 바로 상한 6에 닿는다. 트래픽 분석기가 이 값으로 HPA · 노드 슬롯을 다시 산정해야 한다(직전 트래픽 분석은 "HPA를 움직이는 건 부하 생성기뿐"이라 적었는데, 이제 **CPU 부하가 훨씬 적은 RPS로 HPA를 움직인다**).
- **트래픽 부하 생성기**: 관리자 패널에서 탭당 최대 60 req/s를 `/api/votes`에 추가로 보낸다(DB SELECT 1회씩). I/O 성격이라 CPU 부하 테스트와는 다른 축(DB · 이벤트 루프)을 누른다.
- **쓰기**: 투표 POST(카운터 +1, 비멱등)와 방명록 POST(INSERT). 사람이 버튼을 누를 때만 발생하고 양이 적다. 속도 제한은 없다. `POST /api/load/cpu`는 쓰기가 아니다(저장 없음).
- **실시간 연결 없음**: WebSocket · SSE 없음. 모두 짧은 HTTP 요청(`/api/info` 폴링은 3.5초 abort, CPU 요청은 브라우저 4초 abort · 서버 2초 deadline).
- **백그라운드 · 예약 작업**: 큐 · 크론 없음. **Worker Thread는 첫 `POST /api/load/cpu`에서 lazy 생성**되고(`cpu-pool.ts:47`) 이후 프로세스가 사는 동안 유지된다(유휴 때 CPU 0). BE 안의 타이머는 CPU 샘플링 1초(`unref`)뿐. 배포 부수 작업은 차트의 `migration`(`init.sql` 적용)뿐.
- **상태**: DB 연결 시 데이터는 무상태. 프로세스 메모리 상태는 장애 주입 설정 · 메트릭 창 · fallback 데이터 · CPU 작업 큐이며 파드가 바뀌면 사라진다. oauth2-proxy 세션은 쿠키에 담겨 파드 재시작과 무관.
- **관측 식별자**: BE `onResponse` 훅과 FE nginx `map`이 User-Agent `one-tatchi-smoke`, `kube-probe/*`, `ELB-HealthChecker/*`, `GoogleHC/*`를 메트릭에서 제외한다(`metrics.ts`, `nginx.conf:2-8`). 플랫폼 v2.17.0 `smoke.sh:89`가 `-A one-tatchi-smoke`로 보내는 것을 확인했다 → 승격 smoke는 시연 차트를 오염시키지 않는다. 반대로 `POST /api/load/cpu`는 `onResponse`에 집계되므로 대시보드 `rps` · 서버 쪽 p95(`/api/metrics`, 화면에는 안 씀)가 부하 중 올라간다 — 의도된 표시.

## 외부 의존

- **런타임(앱)**: **외부 API 호출 없음**. BE가 닿아야 하는 곳은 PostgreSQL 하나 — prod: RDS(노드 보안 그룹에서만 허용), **AWS test: 온프레미스 Postgres(T33 `db_link`, Tailscale tailnet 경유)**. FE(nginx)는 클러스터 내부 DNS `demo-app-be`만 바라본다. Prometheus 스크레이프(`/metrics`, FE는 `nginx-log-exporter` 4040)는 플랫폼이 들어오는 방향이다. CPU 부하 API는 외부에 닿지 않는다.
- **런타임(브라우저 측)**: `fe/index.html`이 Pretendard 웹폰트를 `cdn.jsdelivr.net`에서 받는다. 실패해도 기본 폰트로 그려지고 기능에는 영향이 없다.
- **런타임(미리보기 인증)**: oauth2-proxy 파드 → Cognito(`cognito-idp.ap-northeast-2.amazonaws.com`, OIDC), 승인자 브라우저 → Cognito Hosted UI → Identity Center(SAML). aws뿐 아니라 gcp · onprem(기본 기기)도 같은 Cognito를 쓴다(T38, `deploy/gcp/values.yaml` · `deploy/onprem/values.yaml`). 클러스터에서 Cognito로 나가는 경로와 시크릿(`demo-app-preview-oauth2-proxy*`)이 필요하다. 이 경로가 막히면 **green 미리보기만** 안 열리고 배포 · 승격은 진행된다.
- **빌드 시**: `node:22-alpine`, `nginxinc/nginx-unprivileged:alpine`, npm 레지스트리(pnpm). 이미지는 `ghcr.io/softbank-hackathon-2026-team-amethyst/demo-app-{be,fe}`. 런타임 이미지는 `dist/*.js`를 실행하므로 워커 파일도 `dist/load/cpu-worker.js`로 컴파일돼 들어간다(`cpu-pool.ts:46` `extname(__filename)` 분기 — 추가 빌드 단계 불필요).
- **CORS**: `origin: true`(모든 출처 반사). 외부 노출이 FE뿐이고 같은 오리진에서 프록시하므로 기능상 필요 없다(보안 분석기 몫).

## 배포에 미치는 영향

1. **헬스체크가 DB 장애를 드러낸다.** `/health`는 실제 DB에 닿지 못하면 `503 {status:"degraded", database:"fallback-memory"}`다(`health.ts`). readiness와 승격 smoke가 상태 코드만 봐도 DB 미연결 green은 걸러지고, 템플릿 v2.17.0의 smoke는 `expect_body`로 `database == "connected"` · `dbConnected == true`까지 본다(`.deploy/smoke.json`). `chaos.dbError`(시연용 DB 단절)는 503을 내지 않고 `chaosDbError:true`로만 표시된다.
2. **DB는 BE보다 먼저 준비돼야 하고, 런타임 단절은 메모리로 넘어간다.** `initDb()`가 기동 때 실패하면 fallback으로 뜨지만 `/health`가 503이라 Ready가 안 되고 승격되지 않는다. 기동 뒤 DB가 살아나면 `checkDbHealth()`가 DB 경로로 복귀한다(`db/index.ts:86-90`). 잠시 끊긴 사이 들어온 투표 · 방명록 쓰기는 DB가 돌아올 때 사라진다. 차트의 `migration` Job이 BE보다 앞서 DB 접속을 확인하므로 기동 순서 문제는 평상시 없다. **AWS test는 DB 경로가 tailnet(맥북)** 이라 맥북이 꺼져 있으면 test 배포의 migration Job · readiness가 실패한다 — test 한정.
3. **장애 주입은 test 전용이고 상태는 파드 메모리에만 있다.** `CHAOS_ENABLED`는 `values-be.test.yaml`에만 있어 prod BE에는 POST 라우트가 없고 FE 패널도 비활성이다. test에서는 (a) smoke 중 누군가 장애를 켜면 — 파드 ≥ 2라 1/N 파드에만 걸리지만 — `/api/*` smoke가 무작위로 실패할 수 있다(`/health` · `/healthz` · `/api/chaos` · `/api/metrics` · `/api/load/`는 제외). (b) green 파드는 항상 깨끗한 상태로 뜬다. **승격 전 `GET /api/chaos`를 smoke에 두고(있음), 시연 중에는 승격하지 않는다.**
4. **CPU 부하 테스트는 test · prod에서 같은 플래그로 켜지며, 지금은 둘 다 켜져 있다(새로 추가).** `LOAD_TEST_ENABLED`는 `NODE_ENV`와 무관하고(`load.ts:12` 주석, `load.test.ts` 첫 케이스) 공통 `values-be.yaml`에 `"true"`다. 끄려면 값 파일을 `"false"`로 바꾸고 **BE 재배포(Blue-Green 한 번)** 가 필요하다 — `values-be.yaml`은 `prod_common` 경로라 prod까지 간다. 꺼진 BE는 `GET /api/load/config`가 `enabled:false`를 돌리고 `POST /api/load/cpu`는 404라 FE 패널이 스스로 비활성화된다. 켜진 동안 운영 쪽 의미: (a) 인증 없이 누구나 prod BE의 CPU를 태우고 HPA를 최대 6개까지 밀어 올릴 수 있다(노드 Cluster Autoscaler까지 번지면 비용 — 예산 · 보안 분석기 몫). (b) 파드별 큐 8건 · 요청 2초 deadline · 워커 1개가 상한이라 **파드 하나가 쓰는 CPU는 약 1코어를 넘지 않고** 메인 루프는 막히지 않는다. (c) prod `replicas 2` + HPA가 부하에 반응하므로 시연 뒤 **300초 축소 안정화** 동안 파드 수가 남아 있다.
5. **Blue-Green 중 CPU 부하의 동작(새로 추가).** (a) 사용자 · 시연자의 부하는 FE nginx → **active BE**로만 가므로 green BE는 승격 전까지 부하를 받지 않고 워커도 만들지 않는다. 예외는 승인자가 **green 미리보기(oauth2-proxy)** 에서 CPU 패널을 켜는 경우 — `previewAuth.routes`가 `/api/`를 `demo-app-be-preview`로 보내므로 green BE가 부하를 받는다(아래 7). (b) 승격 순간 blue 파드가 `SIGTERM`을 받으면 `app.close()` → `onClose` 훅이 `pool.close()`로 **대기 중 작업을 503으로 거부하고 워커를 종료**한다(`load.ts:21`, `cpu-pool.ts:84-87`). 진행 중이던 한 건은 최대 2초 안에 끝나거나 끊긴다. FE 패널은 이를 "실패"로 세고 다음 틱에 새 파드로 계속 보낸다 — 시연에서 보여주려는 1~2초 흔들림과 같은 성격. (c) HPA는 Rollout을 대상으로 한다(차트 `hpa.yaml` `scaleTargetRef: Rollout`). 부하 중 배포가 겹치면 HPA가 올린 복제 수가 preview ReplicaSet에도 적용돼 **파드가 2배로 뜬다**(가정 표). 부하 시연과 배포는 겹치지 않는 편이 낫다. (d) `POST /api/load/cpu`는 승격 smoke 목록에 없으므로 promote-judge의 에러율 · p95는 영향을 받지 않는다. 다만 **시연자가 active에 heavy 부하를 켠 채 승격하면** 전환 직후 green이 그 부하를 이어받아 HPA가 뛴다 — 3번과 같은 "시연 중 승격 금지" 원칙.
6. **스키마와 시드가 모두 Blue-Green에 안전하다.** `init.sql`의 `CREATE TABLE IF NOT EXISTS`, `votes` 시드(`ON CONFLICT DO NOTHING`), `guestbook` 시드(`WHERE NOT EXISTS`)가 멱등이다. 두 버전이 같은 DB를 쓰는 동안 호환되지 않는 변경이 없다(v2.0.x → v2.1.x 차이는 CPU 부하 API · `APP_VERSION` 문자열뿐이고 DB 스키마는 그대로). T25는 마이그레이션이 없다.
7. **FE→BE 경로가 둘이다 — 사용자 · smoke는 active BE, 승인자 미리보기는 green BE.** `nginx.conf`는 `demo-app-be:8000`(active)을 하드코딩한다. 승격 smoke는 `svc/<release>-preview`에 port-forward로 붙으므로(`smoke.sh:62-70`) `demo-app-fe-preview`의 `/api/*`는 nginx를 거쳐 **그 시점의 active BE**로 간다 → FE smoke의 `/api/*`는 **프록시 경로 검증**이지 BE green 검증이 아니다. 반면 승인자가 브라우저로 여는 `green*.…` 호스트는 oauth2-proxy가 `/api/`를 `demo-app-be-preview`(green BE)로 바로 보낸다(`values-fe.yaml:40-45`, App Chart v2.4.0+). 따라서 **승인자는 미리보기에서 green BE의 `/api/info` 버전 · `/api/load/config` · CPU 패널을 실제 green 기준으로 본다**(직전 문서의 "BE green은 승인자가 볼 수 없다"는 더 이상 사실이 아님). 서비스는 matrix로 **BE → FE 순서**(`deploy.yml` `services` 배열)로 배포된다.
8. **승인자용 green 미리보기 SSO는 smoke · 승격 판단 경로를 가로채지 않는다.** 플랫폼 v2.17.0 `promote-judge/smoke.sh`는 preview Service에 직접 붙고(`SERVICE` 환경변수로 T36 장애 훈련 때만 active에 붙음), oauth2-proxy는 별도 `demo-app-fe-preview-auth` Deployment · Service · Ingress다(차트 `preview-auth.yaml`, `replicas: 1`). `.deploy/smoke.json`의 FE 항목은 302 없이 200을 받는다.
9. **oauth2-proxy는 릴리스 전체 기동 조건이 될 수 있다.** ExternalSecret이 `demo-app-fe-preview-auth` Secret을 만들어야 oauth2-proxy 파드가 뜬다. 시크릿이 비어 있으면 그 파드만 CrashLoop/Pending이고 FE 본체 Rollout과 smoke는 별개다. Helm `--wait` 동작은 미확인(가정 표). 이제 gcp · onprem도 같은 조건이다(T38).
10. **오래 가는 연결 · 진행 중 작업은 2초 이내.** 폴링과 짧은 CPU 작업뿐이고 `SIGTERM`에 `app.close()`로 정상 종료하므로 blue를 내릴 때 요청 유실 걱정이 적다. FE 폴링은 실패를 "No response" 비트로 기록하고 다음 초에 재시도한다.
11. **폴링 부하는 탭 수에 비례하고 두 부하 생성기가 이를 증폭한다.** 탭당 2.7 req/s + 트래픽 생성기 최대 60 req/s(DB · 이벤트 루프) + CPU 부하 최대 20 req/s(워커 CPU). 승격 smoke를 부하 중에 돌리면 p95 임계값(플랫폼 기본 2000ms, `promote-judge/action.yml:38`)에 걸릴 수 있다 — CPU 부하는 워커에서 돌아 smoke 지연에 직접 영향은 작지만, HPA · 노드 확장 중 파드가 섞인다.
12. **`/api/info`의 `region` 기본값 `ap-northeast-2`** 가 AWS와 일치한다(gcp는 `deploy/gcp/values.yaml`이 `REGION: asia-northeast3`로 덮음). FE `index.html`의 `<title>`은 `배포 현황 · Demo-App`으로 바뀌었고 `<html lang="ko">` · `<div id="root">`는 그대로라 FE smoke의 HTML 검사 기준은 바뀌지 않는다.
13. **smoke 본문 조건이 자동 검사된다(변경됨).** 템플릿 v2.17.0 `smoke.sh`는 `expect_body`(JSON 객체)의 키 · 값이 응답 본문에 모두 같아야 ok로 친다(`smoke.sh:5,45-51,99`). 현재 `smoke.json`은 `/health`와 `/api/info`에 이를 쓴다. 본문 조건을 넣을 때는 **값 파일과 함께 바뀌는 값**(`APP_VERSION`, `LOAD_TEST_ENABLED`)을 피해야 승격이 값 변경에 묶이지 않는다.
14. **복제 수**: 가용성 요구로는 1, 현재 값은 BE 2 + HPA(aws · gcp) · onprem 1, FE 1. 데이터 보관 위치 제한 **없음**(위 절 참고).

## smoke 요청 후보

승격 판단(T7)이 green에 보낼 목록. 플랫폼 v2.17.0 `promote-judge/smoke.sh`의 실제 동작을 확인한 전제: `expect`는 상태 코드, **`expect_body`(선택)는 JSON 본문의 키 · 값 부분 일치**를 검사한다; UA `one-tatchi-smoke`; 기본 관찰 30초, 요청 타임아웃 5초; POST는 첫 바퀴만. 표의 "사람 확인"은 smoke.json에 넣지 않고 Slack 보고서 · green 미리보기에서 보는 추가 기준이다. 읽기 위주이고, 쓰기는 데이터를 남기지 않는 검증 경로만 둔다.

| 서비스 | method | path | expect | 비고 |
|---|---|---|---|---|
| demo-app-be | GET | `/healthz/liveness` | 200 | DB 무관 프로세스 생존. **smoke.json에 있음** |
| demo-app-be | GET | `/health` | 200 | DB 미연결이면 503(영향 1). `expect_body {"database":"connected"}`로 메모리 폴백도 걸러진다. `chaosDbError == false`는 사람 확인. **있음(expect_body 포함)** |
| demo-app-be | GET | `/api/info` | 200 | `expect_body {"dbConnected": true}`. `version`은 값 파일 `APP_VERSION`(HEAD v2.1.0, 작업 트리 v2.1.1)이라 본문 조건으로 묶지 않고 사람 확인. **있음(expect_body 포함)** |
| demo-app-be | GET | `/api/votes` | 200 | 사람 확인: `items.length == 3`, `totalVotes >= 25`. **있음** |
| demo-app-be | GET | `/api/guestbook` | 200 | 사람 확인: `entries[0].name != "시스템 안내"`(메모리 fallback 시드). **있음** |
| demo-app-be | GET | `/api/chaos` | 200 | 사람 확인: `latencyMs == 0`, `errorRate == 0`, `dbError == false`; `enabled`는 test true · prod false. green이 깨끗한 상태로 떴는지(영향 3). **있음** |
| demo-app-be | GET | `/api/metrics` | 200 | 계측 라우트 생존. 선택. **있음** |
| demo-app-be | GET | `/api/load/config` | 200 | **추가 제안(읽기 전용, T25).** 항상 등록되는 라우트라 플래그와 무관하게 200. `Cache-Control: no-store`. 사람 확인: `enabled`가 값 파일 `LOAD_TEST_ENABLED`와 일치(현재 test · prod 모두 true), `maxRps 20` · `maxDurationSec 300`. `expect_body {"enabled": true}`는 플래그를 끄는 배포에서 승격을 막으므로 **넣지 않는다** |
| demo-app-be | POST | `/api/guestbook` (body `{}`) | 400 | 쓰기 라우트의 검증 경로. **데이터를 남기지 않음.** 첫 바퀴만 실행. **있음** |
| demo-app-be | POST | `/api/guestbook` (body `{"name":"smoke-test","message":"[smoke] …"}`) | 200 | **기본 제외(유지).** prod smoke는 prod DB(RDS)에 남고 지울 API가 없다. AWS test는 이제 별도 DB라 prod 화면에는 안 보이지만 같은 이유로 제외 |
| demo-app-be | POST | `/api/load/cpu` (body `{"intensity":"light"}`) | 200 | **제외.** 데이터는 안 남지만 green 파드 CPU를 쓰고 HPA를 자극하며, 큐 상태에 따라 429 · 503이 나와 승격 판단을 흔든다. 플래그를 끄면 404. 승격 뒤 시연자가 패널로 확인한다 |
| demo-app-fe | GET | `/` | 200 | 정적 서빙 확인. 사람 확인: HTML, `<div id="root">`. **있음** |
| demo-app-fe | GET | `/no-such-page` | 200 | SPA fallback(`try_files … /index.html`) 확인. **있음** |
| demo-app-fe | GET | `/health` | 200 | **선택 추가 제안(유지).** nginx → `demo-app-be:8000` 프록시 경로가 green FE에서 살아 있는지(영향 7). 장애 주입 제외 경로라 시연 중에도 안정적. 상대는 active BE이므로 "FE 프록시 설정 검증"이다 |
| demo-app-fe | GET | `/api/info` | 200 | 선택. 위와 같은 프록시 검증이지만 test에서는 에러율 주입 대상이라 무작위 실패 가능 → `/health` 쪽을 권함 |

**`.deploy/smoke.json`과 대조**: 현재 BE 8개 · FE 2개가 위 표의 "있음" 항목과 일치하고 `/health` · `/api/info`의 `expect_body`도 그대로 유효하다. 필수 변경은 없다. 선택 제안 2건: BE에 `GET /api/load/config → 200`(T25 라우트 등록 확인, 본문 조건 없이), FE에 `GET /health → 200`(프록시 경로 검증). 넣지 않아도 승격 판단에는 지장이 없다.

제외: `POST /api/votes/:id`(득표수를 영구히 바꾸고 되돌릴 API가 없음), `POST /api/chaos*`(운영 상태를 바꿈. prod는 404), `POST /api/load/cpu`(위 표), `GET /metrics`(FE가 프록시하지 않고 Prometheus 전용), 미리보기 호스트(`green*.…`)로의 요청(Cognito 302 — smoke 경로가 아님).

## 가정

| 가정 | 근거 | 틀렸을 때 |
|---|---|---|
| 브리프의 "민감 데이터 예"는 방명록 자유 텍스트(또는 보수적 답변)를 뜻하며, 사내 보관 요구가 아니다 | 코드 · 스키마 · 폼에 개인정보 필드 없음. 금융 · 공공 · 의료 데이터 없음. 사용자가 선호 대상을 AWS로 답함 | 조직 정책으로 사내 보관이 필요하면 보관 위치 제한을 "데이터만 사내"로 올리고 추천 대상이 onprem으로 바뀐다. `compliance`는 어느 쪽이든 사람이 정한다 |
| 국내 보관이 요구되더라도 AWS 서울 리전(`ap-northeast-2`)으로 충족된다 | `infra/envs/aws/variables.tf` region validation, RDS · Cognito 모두 같은 리전, 저장 암호화 기본. test DB는 온프레미스 | 리전 밖 복제(백업 복사 · 로그 전송)가 추가되면 그 경로를 따로 본다 |
| 가용성은 `demo` 수준이고, BE 2 + HPA는 가용성이 아니라 자동 확장 시연 요구다 | 브리프 `demo`, README "시연용" · "CPU 오토스케일 테스트" · T29 절, 파드별 장애 주입 · 메트릭 설계 | 상시 운영이 필요하면 fallback 불일치 · 파드별 chaos 상태를 먼저 해결한다. 시연 정확도(장애 주입)가 우선이면 test만 `values-be.test.yaml`로 1개 |
| CPU 부하 요청당 연산 시간은 t3.medium에서 light 5~10ms · medium 15~30ms · heavy 30~55ms | 이 맥북(Apple Silicon, Node 24) 실측 3 · 9 · 18ms에 x86 소형 인스턴스 1.5~3배를 곱함. 미측정 | 느리면 heavy 20 RPS가 파드 하나의 처리 상한(≈ 1/시간)을 넘어 429가 늘고 CPU는 1코어에서 포화한다. 빠르면 HPA가 덜 움직인다. 배포 뒤 `elapsedMs`(응답 본문) · `kubectl top pod`로 보정 |
| HPA가 올린 복제 수는 Blue-Green 중 preview ReplicaSet에도 적용된다(파드 2배) | 차트 `hpa.yaml`이 Rollout을 대상으로 하고, 차트 v2.17.0 `rollout.yaml`에 `previewReplicaCount`가 없어 preview가 `spec.replicas`로 뜬다(Argo Rollouts 기본 동작). 실제 HPA · Rollout 상호작용은 미실측 | Argo Rollouts가 HPA 변경을 preview에 즉시 반영하지 않으면 green은 배포 시작 때의 복제 수로 뜬다. 어느 쪽이든 부하 중 배포는 피한다 |
| `/api/info`의 `version`은 값 파일 `APP_VERSION`(HEAD v2.1.0, 작업 트리 v2.1.1)을 따르며 이미지 태그와 다를 수 있다 | `meta.ts:7`이 환경변수만 읽음 | 태그 기준으로 검사하려면 provision 단계에서 `APP_VERSION`을 태그로 주입해야 한다 |
| 시드 데이터가 승격 시점에 존재(`totalVotes >= 25`, 방명록 ≥1건) | `init.sql` 시드 + 차트 `migration.enabled: true`. 투표는 증가만 함. 방명록 시드는 테이블이 빌 때만 | DB를 비우고 재시드하지 않으면 `totalVotes` 임계값을 완화 |
| AWS test는 온프레미스 DB, prod는 RDS를 쓴다 | `infra/envs/aws/variables.tf:140-156` `db_link` 기본값에 `test`, `main.tf:210-222` 분기 | `db_link`를 비우면 test · prod가 같은 RDS · 같은 `demo`를 공유해 test smoke의 쓰기가 prod 화면에 보인다(그래서 INSERT smoke는 어느 쪽이든 제외) |
| FE와 BE가 같은 릴리스 단위로 승격되고 BE active Service 이름 `demo-app-be`가 유지 | `nginx.conf` 하드코딩, `values-be.yaml` 주석, `values-fe.yaml` `previewAuth.routes`가 `demo-app-be-preview`를 전제 | 따로 승격하면 FE가 구버전 BE를 호출. 미리보기 `routes`는 green BE Service가 없을 때 oauth2-proxy upstream 오류 |
| 승격 smoke는 oauth2-proxy를 거치지 않고 `svc/<release>-preview`에 port-forward로 붙는다 | 플랫폼 v2.17.0 `promote-judge/smoke.sh:62-70`, 차트 `preview-auth.yaml`(별도 Service) | 플랫폼이 smoke를 미리보기 호스트 경유로 바꾸면 FE smoke 전부가 302(로그인)로 실패한다 |
| 서비스 matrix가 BE → FE 순서라 자동 승격(test · yolo)에서는 FE smoke 시점에 BE가 이미 새 버전이다 | `deploy.yml`의 `services` 배열 순서(BE 먼저) | 사람 승격으로 BE가 Paused인 동안 FE가 뜨면 FE smoke의 `/api/*`는 구 BE를 본다. 어느 쪽이든 FE smoke는 프록시 검증으로만 읽는다 |
| oauth2-proxy 파드 기동 실패가 FE Rollout의 Ready 판단에 섞이지 않는다 | 차트에서 별도 Deployment · Service이고 Rollout과 셀렉터가 다름 | 플랫폼 deploy.yml이 Helm `--wait`로 모든 워크로드를 기다리면 ExternalSecret 미해결 시 릴리스 전체가 timeout(미확인) |
| 승격 smoke는 시연(트래픽 생성기 · CPU 부하 · 장애 주입) 중에 돌리지 않는다 | `/api/load/cpu` · `/api/chaos` POST가 FE 경로로 공개, HPA가 부하에 반응 | 시연 중 승격이 필요하면 `GET /api/chaos` · `kubectl get hpa`를 먼저 보고 smoke 재시도 횟수를 늘린다 |
| 하루 이용자 100명을 "동시 접속 100탭"으로 상한 해석(약 270 req/s, 생성기 제외) | 폴링 주기 코드(`App.tsx:253,297,396`) | 실제 동시 접속은 훨씬 적을 가능성이 높음. 정확한 산정은 트래픽 분석기가 함 |
