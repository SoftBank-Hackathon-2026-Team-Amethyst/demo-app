# 서비스 분석

브리프(2026-10-10 갱신): 하루 100명 이하 · 월 10만 원 이하 · 민감 데이터 **예**(`regulated`) · 선호 대상 **AWS** · 가용성 **시연용**.
이전 브리프(민감 데이터 모름 · 온프레미스 선호 · 일반 운영) 기준의 분석을 현재 코드(PR #44 관리자 패널, #40 HTTP 계측 포함)로 다시 확인해 새로 썼다.

## 요약

- **무엇을 하는가**: 원터치 배포 플랫폼 **시연용 웹앱** "실시간 배포 현황". 화면 하나에 네 영역이 있다.
  1. 배포 상태 · 버전 모니터링 — `/api/info`를 1초마다 폴링해 버전 · 호스트명(파드) · 가동시간 · DB 연결 상태를 표시하고, 호스트명이 바뀌면 "새 버전으로 전환됨" 배지를 띄운다(Blue-Green 승격을 눈으로 보여주는 장치).
  2. 파드별 트래픽 · CPU · 메모리 차트 — `/api/metrics`를 1초마다 폴링(파드 1개 기준 인메모리 집계, `be/src/routes/metrics.ts`).
  3. 배포 전략 투표(`/api/votes`, 3개 항목)와 방명록(무중단 DB CRUD 검증용).
  4. **시연 관리자 패널**(PR #44, `App.tsx:822-957`) — 브라우저 쪽 트래픽 부하 생성기(0 · 10 · 30 · 60 RPS로 `/api/votes` 호출)와 BE 장애 주입(`/api/chaos`: 지연 ms · 에러율 · DB 단절 토글, `/api/chaos/reset`으로 원복).
- **사용자**: 시연을 보는 해커톤 심사자 · 팀원. 로그인 · 회원 개념이 없고 모두 익명이다.
- **구성**: 서비스 두 개 + DB 하나.
  - `demo-app-fe`: Vite + React 19 정적 빌드를 비특권 nginx(포트 3000)가 서빙. `/api/`와 `/health`를 클러스터 내부 `demo-app-be:8000`으로 프록시(`fe/nginx.conf`). 외부에 노출되는 유일한 서비스.
  - `demo-app-be`: Fastify 5 + Drizzle ORM + postgres.js(포트 8000). 라우트 12개 — `/health`, `/healthz/liveness`, `/metrics`(Prometheus, FE가 프록시하지 않음), `/api/info`, `/api/metrics`, `/api/votes` GET, `/api/votes/:id` POST, `/api/guestbook` GET/POST, `/api/chaos` GET/POST, `/api/chaos/reset` POST.
  - PostgreSQL 17. 테이블 두 개(`votes`, `guestbook`), 스키마는 `db/init.sql`. BE는 DB에 못 붙으면 **인메모리 fallback**으로 동작한다.
- **성격 판단**: 금융 · 결제 · 공공 · 고객용 서비스가 아니라 **내부 시연 도구**다. 브리프의 이용자 ≤100명, 예산 ≤10만 원, 가용성 `demo`와 일치한다. `regulated` 분류는 아래 "다루는 데이터"에서 따로 다룬다.

## 다루는 데이터

| 테이블 | 필드 | 성격 |
|---|---|---|
| `votes` | `option_key`, `title`, `count`, `updated_at` | 집계 숫자 3행. 누가 투표했는지 저장하지 않음(1인 1투표는 브라우저 `localStorage`에서만, `App.tsx:62-68`) |
| `guestbook` | `name`(≤50자), `message`(≤500자), `created_at` | 사용자가 자유 입력하는 **닉네임과 응원 메시지**. 삭제 · 수정 API 없음, 보존 기간 없음 |

프로세스 메모리에만 있는 상태: 장애 주입 설정(`chaosState`), 최근 60초 요청 집계(`/api/metrics`), fallback 모드일 때의 투표 · 방명록 사본.

- **코드에서 찾은 것**: 로그인 · 세션 · 인증 토큰 · 결제 · 이메일 · 전화번호 · 주소 · 주민번호 필드가 **없다**. 입력 폼은 방명록의 닉네임 · 메시지 두 칸뿐이고, 투표는 버튼 클릭만 보낸다. 데이터 모델은 개인정보를 수집하도록 설계되지 않았다.
- **브리프와 비교 — `handles_sensitive_data: yes`**: 코드 조사 결과와 어긋난다. 분석은 답변을 고치지 않고, "예"가 무엇을 가리킬 수 있는지와 그것이 배포에 무엇을 요구하는지를 적는다.
  1. **방명록 자유 텍스트**(가장 그럴듯함). 사용자가 실명 · 소속 · 연락처를 적으면 그대로 저장되고 지울 API가 없다. 이 경우 "개인정보가 들어올 수 있는 저장소"로 보는 것이 보수적이고 타당하다. → 요구: 저장 데이터 암호화, 접근 통제, (개인정보라면) 국외 이전 금지 정도. **사내 보관을 요구하지 않는다.**
  2. **인프라 비밀값**(DB 자격증명, Slack 봇 토큰). 앱 데이터가 아니라 배포 체계의 비밀값이고, Secrets Manager → External Secrets로 다룬다. 서비스 데이터 보관 위치와 무관.
  3. **운영 정보 노출**(`/api/info`의 파드 호스트명 · 리전, `/api/metrics`의 CPU · 메모리). 시연 기능이지 규제 대상 데이터가 아니다.
  4. **보수적 답변**(해커톤 평가 · 조직 기본 정책). 이 경우 요구 사항은 `compliance: regulated`의 운영 승인 관문 유지가 전부다.
  어느 해석이든 금융(전자금융) · 공공(CSAP) · 의료처럼 **법령이 사내 또는 특정 설비 보관을 강제하는 데이터는 없다.**
- **결정 — 데이터 보관 위치 제한: 없음** (배포 대상 추천 규칙 1번 입력). 근거:
  - 서비스 성격(시연 · 익명 · 비금융 · 비공공)상 사내 보관 의무가 없다.
  - "예"를 가장 엄격하게 "방명록에 개인정보가 들어온다"로 읽어도 요구되는 것은 **국내 보관**이지 사내 보관이 아니다. AWS 서울 리전(`ap-northeast-2`)의 RDS는 데이터가 물리적으로 국내에 있고, `infra/envs/aws/variables.tf`가 `region == "ap-northeast-2"`를 validation으로 강제하므로 다른 리전으로 샐 수 없다. RDS 저장 암호화는 모듈 기본값이다. → **AWS 서울 리전이 국내 보관 요구를 충족한다.**
  - 사용자 스스로 선호 대상을 AWS로 바꿨다. 이전 브리프의 "온프레미스 선호"가 사라졌으므로 "예"가 사내 보관 요구를 뜻한다고 볼 근거가 없다.
  - 따라서 규칙 1번에는 "제한 없음(국내 보관 요구가 있더라도 서울 리전으로 충족)"으로 넘긴다. `compliance: regulated`는 유지한다 — 사람이 바꾸는 값이고, 바꿀 근거 질문은 "방명록 자유 텍스트를 개인정보로 볼 것인가"다.
- **비밀값**: 코드에 비밀값은 없다. `DATABASE_URL` 기본값 `postgresql://demo:demo@localhost:5432/demo`는 로컬 전용이고, 배포에서는 `demo-app-db` Secret이 덮는다(`deploy/values-be.yaml` `envFromSecrets`).
- **데이터 공유 범위(AWS)**: `infra/envs/aws/main.tf`의 `service_base`가 test · prod 네임스페이스에 **같은 RDS, 같은 데이터베이스 `demo`**를 연결한다. test에 쓴 방명록이 prod 화면에 그대로 보인다. 민감 데이터 "예"라면 test 환경에서의 쓰기(smoke · 수동 테스트)도 prod 데이터에 섞인다는 뜻이다(아래 "배포에 미치는 영향" 5).

## 가용성 요구

- **중단의 영향**: 멈추면 시연 화면이 깨진다(상단 상태 카드가 "오프라인", 투표 · 방명록 미동작). 곤란한 사람은 시연 진행자와 관람자뿐이다. 외부 고객 · 매출 · 법적 의무는 걸려 있지 않고, 시연 밖 시간에는 아무도 쓰지 않는다.
- **브리프와 비교**: 가용성 답변 `demo`(시연용)가 서비스 성격과 정확히 맞는다. 다만 이 앱의 시연 주제가 "무중단 배포"이므로 **배포 중 끊김 없음**은 실제 요구다. 이것은 복제 수가 아니라 Blue-Green 승격 흐름(green 기동 → smoke → 트래픽 전환)이 보장한다.
- **결정 — 가용성 수준**: **FE · BE 각 `replicas: 1`**(`deploy/aws/values.yaml`에 이미 그렇게 있음). 이유:
  - 시연용이라 이중화의 비용 대비 효과가 없다. t3.medium 노드의 파드 한도(17개) 안에서 test · prod × Blue-Green을 올리려면 1이 맞다.
  - BE를 2개 이상으로 늘리면 (a) fallback 상태에서 파드마다 다른 투표 · 방명록이 보이고, (b) **장애 주입 상태가 파드별**이라 관리자 패널에서 "DB 단절"을 켜도 절반만 끊기며, (c) `/api/metrics`가 응답한 파드의 값만 내려 차트가 파드 사이를 오간다(코드 주석도 이를 인정, `metrics.ts:4`). 시연 의도상 **1개가 오히려 맞다.**
- **장애 주입이 가용성에 미치는 것**: `/api/chaos`의 에러율 · 지연은 `/health`에도 적용된다(`index.ts:46` preHandler가 `/metrics`, `/api/chaos*`, `/api/metrics`만 제외). 에러율 100%를 켜면 readiness가 실패해 파드가 NotReady가 되고, `replicas: 1`이므로 곧 전면 중단이다. 이것은 시연 기능(자가 치유 시연)이고 파드 재시작이나 `/api/chaos/reset`으로 돌아온다. 인증이 없어 **외부 누구나 이 스위치를 켤 수 있다**는 점은 보안 분석기 몫이지만, 시연용 가용성 수준에서는 받아들일 수 있는 범위다.
- **DB**: 단일 인스턴스(RDS `db.t4g.micro`, single AZ)로 충분. 데이터는 시드 + 방명록이라 유실돼도 재시드 가능(`init.sql`의 테이블 · `votes` 시드는 멱등).

## 사용 패턴

- **읽기 위주의 폴링**. 탭 하나가 `/api/info` 1초 1회(`App.tsx:240`), `/api/metrics` 1초 1회(`App.tsx:284`), `/api/votes` · `/api/guestbook` 3초 1회씩(`App.tsx:385`) → **탭당 약 2.7 req/s**(이전 분석 1.7 req/s에서 `/api/metrics`가 추가됨). 동시 100탭이면 약 270 req/s. 모두 FE nginx를 거쳐 BE로 간다.
- **DB 부하는 폴링보다 작다**. `checkDbHealth()`가 3초 TTL 캐시와 1초 타임아웃을 갖게 돼(`db/index.ts:50-85`), `/api/info` · `/health`의 `SELECT 1`은 탭 수와 무관하게 **파드당 3초에 1회**다. `/api/metrics`는 DB를 쓰지 않는다. 남는 DB 질의는 `/api/votes` · `/api/guestbook`(탭당 0.67 q/s)뿐이다. 연결 풀은 `max: 5`, `idle_timeout: 10`.
- **부하 생성기**: 관리자 패널에서 탭당 최대 60 req/s를 `/api/votes`에 추가로 보낸다(DB SELECT 1회씩). 시연자가 켜는 의도된 피크이며, 탭 몇 개에서 동시에 켜면 BE 파드 1개(요청 100m)와 풀 5개가 먼저 포화한다. 수치 산정은 트래픽 분석기 몫.
- **쓰기**: 투표 POST(카운터 +1, 비멱등)와 방명록 POST(INSERT). 사람이 버튼을 누를 때만 발생하고 양이 적다. 속도 제한은 없다.
- **실시간 연결 없음**: WebSocket · SSE 없음. 모두 짧은 HTTP 요청(FE 폴링은 3.5초 abort).
- **백그라운드 · 예약 작업 없음**: 큐 · 크론 · 워커 없음. BE 안의 유일한 타이머는 CPU 샘플링 1초(`unref`). 배포 부수 작업은 차트의 `migration`(`init.sql` 적용)뿐.
- **상태**: DB 연결 시 데이터는 무상태. 프로세스 메모리 상태는 장애 주입 설정 · 메트릭 창 · fallback 데이터이며 파드가 바뀌면 사라진다.
- **관측 식별자**: BE `onResponse` 훅과 FE nginx `map`이 User-Agent `one-tatchi-smoke`, `kube-probe/*`, `ELB-HealthChecker/*`를 메트릭에서 제외한다(`metrics.ts:17-19`, `nginx.conf:2-8`). 승격 판단의 smoke 요청은 이 UA로 보내야 시연 차트를 오염시키지 않는다.

## 외부 의존

- **런타임**: **외부 API 호출 없음**. BE가 닿아야 하는 곳은 PostgreSQL(AWS: RDS, 노드 보안 그룹에서만 허용) 하나. FE(nginx)는 클러스터 내부 DNS `demo-app-be`만 바라본다. Prometheus 스크레이프(`/metrics`, FE는 `nginx-log-exporter` 4040)는 플랫폼이 들어오는 방향이다.
- **빌드 시**: `node:22-alpine`, `nginxinc/nginx-unprivileged:alpine`, npm 레지스트리(pnpm 10.28.1). 이미지는 `ghcr.io/softbank-hackathon-2026-team-amethyst/demo-app-{be,fe}`; AWS 루트는 ECR 저장소도 만든다(`module.registry`). 어느 쪽이든 EKS 노드가 외부 레지스트리에 닿는다(NAT 1개).
- **CORS**: `origin: true`(모든 출처 반사). 외부 노출이 FE뿐이고 같은 오리진에서 프록시하므로 기능상 필요 없다(보안 분석기 몫).

## 배포에 미치는 영향

1. **헬스체크가 DB 장애를 숨긴다.** `/health`는 DB가 끊겨도 `200 {status:"ok", database:"fallback-memory"}`다. readiness를 상태 코드만 보면 DB 없이도 Ready가 되고 승격 판단도 통과한다. **smoke는 `/health`의 `database == "connected"` 또는 `/api/info`의 `dbConnected == true`를 본문에서 확인해야 한다.** 그리고 `/api/guestbook` 첫 항목 `name`이 `"시스템 안내"`면 메모리 fallback 시드이므로 DB 미연결 신호다.
2. **DB는 BE보다 먼저 준비돼야 하고, 런타임 단절은 조용히 메모리로 넘어간다.** `initDb()`가 기동 때 실패하면 `db`가 `null`로 남아 이후 DB가 살아나도 데이터 라우트는 계속 메모리를 쓴다(파드 재시작 필요). 기동 뒤 DB가 잠시 끊기면 `checkDbHealth()`가 `isDbConnected=false`로 바꿔 **데이터 라우트가 메모리로 전환되고, 그 사이 들어온 투표 · 방명록 쓰기는 DB가 돌아올 때 사라진다**(`votes.ts:9`, `guestbook.ts:14` 조건). 차트의 `migration` Job이 BE보다 앞서 DB 접속을 확인하므로 기동 순서 문제는 평상시 없고, 1번 smoke 검사가 나머지를 잡는다.
3. **장애 주입 상태는 파드 메모리에만 있다.** green 파드는 항상 깨끗한 상태(지연 0 · 에러율 0 · DB 정상)로 뜬다. 다만 (a) smoke 실행 중 누군가 관리자 패널에서 장애를 켜면 — 패널이 FE 경로로 공개돼 있고 FE가 어느 BE를 보느냐에 따라 green에 적용될 수 있다 — smoke가 무작위로 실패한다. (b) 반대로 시연자가 blue에 장애를 켜 둔 채 승격하면 전환 순간 장애가 "사라진다". **승격 전 `GET /api/chaos`가 모두 0 · false인지 smoke에 넣고, 시연 중에는 승격하지 않는다.** `chaos.dbError=true`는 `/health`를 `fallback-memory`로 바꾸므로 1번 검사와도 겹친다.
4. **스키마는 Blue-Green에 안전하지만 시드 재실행은 안전하지 않다.** `init.sql`의 `CREATE TABLE IF NOT EXISTS`와 `votes` 시드(`ON CONFLICT (option_key) DO NOTHING`)는 멱등이다. 두 버전이 같은 DB를 쓰는 동안 호환되지 않는 변경이 없다(버전 차이는 `APP_VERSION`에 따른 테마 색뿐). 그러나 **`guestbook` 시드 2건은 `ON CONFLICT DO NOTHING`의 충돌 대상이 없어 배포마다 다시 들어간다.** 매 배포 `migration` Job이 돌므로 main push 한 번에 test · prod 각각 2건(같은 DB라 합계 4건)이 쌓인다. 이전 분석에서도 지적했고 현재 코드에 아직 남아 있다(`WHERE NOT EXISTS`로 바꾸는 것은 앱 수정 사항).
5. **test와 prod가 같은 데이터베이스를 쓴다(AWS).** `service_base`가 두 네임스페이스에 같은 RDS · DB 이름 `demo`를 넘긴다. test 승격 smoke가 방명록에 INSERT하면 prod 시연 화면에 보인다. **쓰기 smoke는 검증 경로(빈 본문 → 400)만 쓰고, INSERT smoke는 넣지 않는다.** 민감 데이터 "예" 답변과도 맞는 보수적 선택이다.
6. **FE→BE 서비스 이름이 고정돼 있다.** `nginx.conf`가 `demo-app-be:8000`을 하드코딩한다. BE의 green이 다른 Service 이름으로 뜨면 FE는 blue BE를 호출한다. FE와 BE가 **같은 릴리스 단위로 함께 승격**되거나 `demo-app-be`가 active Service 이름으로 유지돼야 한다. 반대로 이 구조 덕에 외부 smoke는 FE 경로 하나로 BE까지 검사할 수 있다.
7. **오래 가는 연결 · 진행 중 작업 없음.** 폴링만 있고 `SIGTERM`에 `app.close()`로 정상 종료하므로 blue를 내릴 때 요청 유실 걱정이 적다. FE 폴링은 실패를 "오프라인" 비트로 기록하고 다음 초에 재시도하므로 전환 중 1~2초 실패는 화면에 남지만 복구된다(시연에서 보여주려는 바로 그 장면).
8. **폴링 부하는 탭 수에 비례하고 부하 생성기가 이를 증폭한다.** 탭당 2.7 req/s + 생성기 최대 60 req/s. BE 1개로 시연 규모는 충분하지만, 승격 smoke를 부하 생성기가 켜진 상태에서 돌리면 지연 임계값에 걸릴 수 있다(3번과 같은 "시연 중 승격 금지" 원칙).
9. **`/api/info`의 `region` 기본값 `ap-northeast-2`**가 이번엔 사실과 일치한다(AWS 서울). `REGION` 환경변수는 넣지 않아도 된다.
10. **복제 수 `replicas: 1`**, 데이터 보관 위치 제한 **없음**(위 절 참고).

## smoke 요청 후보

승격 판단(T7)이 green에 보낼 목록. User-Agent는 `one-tatchi-smoke`로 보낸다(메트릭 제외 대상). 읽기 위주이고, 쓰기는 데이터를 남기지 않는 검증 경로만 둔다.

| 서비스 | method | path | expect | 비고 |
|---|---|---|---|---|
| demo-app-be | GET | `/healthz/liveness` | 200, `status == "alive"` | DB 무관 프로세스 생존 |
| demo-app-be | GET | `/health` | 200, `status == "ok"` **and** `database == "connected"` | `fallback-memory`면 실패로 본다(영향 1 · 2 · 3) |
| demo-app-be | GET | `/api/info` | 200, `dbConnected == true`, `version == <APP_VERSION 값>` | green이 새 버전인지 확정하는 핵심 검사. `version`은 이미지 태그가 아니라 `env.APP_VERSION`(가정 참고) |
| demo-app-be | GET | `/api/votes` | 200, `items.length == 3`, 각 항목에 `percentage`, `totalVotes >= 25` | 시드 3건(5+8+12) 이상이어야 DB를 읽은 것. 메모리 fallback도 같은 값을 돌려주므로 `/health` 검사와 함께 본다 |
| demo-app-be | GET | `/api/guestbook` | 200, `entries` 배열, `entries.length >= 1`, `entries[0].name != "시스템 안내"` | `"시스템 안내"`는 메모리 fallback 시드 → DB 미연결 신호 |
| demo-app-be | GET | `/api/chaos` | 200, `latencyMs == 0`, `errorRate == 0`, `dbError == false` | green이 깨끗한 상태로 떴는지(영향 3). 실패하면 `POST /api/chaos/reset` 뒤 재시도하지 말고 사람이 본다 |
| demo-app-be | GET | `/api/metrics` | 200, `hostname` 문자열, `rpsSeries.length == 30` | 계측 라우트 생존. 선택 |
| demo-app-be | POST | `/api/guestbook` (body `{}`) | 400, `error == "Name is required"` | 쓰기 라우트의 검증 경로. **데이터를 남기지 않음** |
| demo-app-be | POST | `/api/guestbook` (body `{"name":"smoke-test","message":"[smoke] 승격 검사 <릴리스 태그> <실행 ID>"}`) | 200, `success == true`, `entry.name == "smoke-test"` | **기본 제외.** test · prod가 같은 DB라 prod 시연 화면에 남는다(영향 5). INSERT 경로 확인이 꼭 필요할 때만 켜고, 값에 `smoke`가 들어가 테스트임이 드러나게 한다. 시연 전 수동 삭제 필요 |
| demo-app-fe | GET | `/` | 200, `Content-Type: text/html`, 본문에 `<div id="root">` | 정적 서빙 확인 |
| demo-app-fe | GET | `/api/info` | 200, `dbConnected == true` | nginx → `demo-app-be:8000` 프록시 확인(영향 6). 외부에서 BE까지 한 번에 검사 |
| demo-app-fe | GET | `/health` | 200, `database == "connected"` | 프록시 경로 두 번째 확인 |
| demo-app-fe | GET | `/no-such-page` | 200, HTML(`index.html`) | SPA fallback(`try_files … /index.html`) 확인. 선택 |

제외: `POST /api/votes/:id`(득표수를 영구히 바꾸고 되돌릴 API가 없음), `POST /api/chaos*`(운영 상태를 바꿈), `GET /metrics`(FE가 프록시하지 않고 Prometheus 전용).

## 가정

| 가정 | 근거 | 틀렸을 때 |
|---|---|---|
| 브리프의 "민감 데이터 예"는 방명록 자유 텍스트(또는 보수적 답변)를 뜻하며, 사내 보관 요구가 아니다 | 코드 · 스키마 · 폼에 개인정보 필드 없음. 금융 · 공공 · 의료 데이터 없음. 사용자가 선호 대상을 AWS로 답함 | 조직 정책으로 사내 보관이 필요하면 보관 위치 제한을 "데이터만 사내"로 올리고 추천 대상이 onprem으로 바뀐다. `compliance`는 어느 쪽이든 사람이 정한다 |
| 국내 보관이 요구되더라도 AWS 서울 리전(`ap-northeast-2`)으로 충족된다 | `infra/envs/aws/variables.tf` region validation, RDS는 같은 리전 private subnet, 저장 암호화 기본 | 리전 밖 복제(백업 복사 · 로그 전송)가 추가되면 그 경로를 따로 본다 |
| 가용성은 `demo` 수준, `replicas: 1` | 브리프 `demo`, README "시연용", 파드별 장애 주입 · 메트릭 설계 | 상시 운영이 필요하면 fallback 불일치 · 파드별 chaos 상태를 먼저 해결한 뒤 복제를 늘린다 |
| `/api/info`의 `version`은 `deploy/values-be.yaml` `env.APP_VERSION`(현재 `v1.0.0`)을 따르며 이미지 태그와 다를 수 있다 | `meta.ts:7`이 환경변수만 읽음 | 태그 기준으로 검사하려면 provision 단계에서 `APP_VERSION`을 태그로 주입해야 한다 |
| 시드 데이터가 승격 시점에 존재(`totalVotes >= 25`, 방명록 ≥1건) | `init.sql` 시드 + 차트 `migration.enabled: true`. 투표는 증가만 함 | DB를 비우고 재시드하지 않으면 `totalVotes` 임계값을 `>= 0`으로 완화 |
| test · prod가 같은 RDS · DB를 공유한다 | `infra/envs/aws/main.tf` `service_base` for_each가 같은 `module.database.*`를 넘김, README 명시 | 환경별 DB로 분리되면 INSERT smoke를 test에서 켜도 prod 화면에 영향 없음 |
| FE와 BE가 같은 릴리스 단위로 승격되고 BE active Service 이름 `demo-app-be`가 유지 | `nginx.conf` 하드코딩, `values-be.yaml` 주석 | 따로 승격하면 FE가 구버전 BE를 호출. App Chart의 Blue-Green Service 명명 확인(코드베이스 분석기 · provision) |
| 승격 smoke는 시연(부하 생성기 · 장애 주입) 중에 돌리지 않는다 | `/api/chaos`가 인증 없이 FE 경로로 공개, 에러율 · 지연이 `/health`에도 적용 | 시연 중 승격이 필요하면 smoke 재시도 횟수를 늘리고 `GET /api/chaos` 검사 결과를 먼저 본다 |
| 하루 이용자 100명을 "동시 접속 100탭"으로 상한 해석(약 270 req/s, 생성기 제외) | 폴링 주기 코드(`App.tsx:240,284,385`) | 실제 동시 접속은 훨씬 적을 가능성이 높음. 정확한 산정은 트래픽 분석기가 함 |
