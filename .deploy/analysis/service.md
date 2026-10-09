# 서비스 분석

## 요약

- **무엇을 하는가**: 원터치 배포 플랫폼 **시연용(demo) 웹앱** "Release Pulse". 화면 하나에 세 기능이 있다 — (1) 배포 상태 · 버전 모니터링(`/api/info`를 1초마다 폴링해 버전 · 호스트명 · 가동시간 · DB 연결 상태 표시, v2이면 초록 테마), (2) 배포 전략 투표(`/api/votes`, 3개 항목), (3) 방명록(무중단 DB CRUD 검증용). 사용자는 시연을 보는 해커톤 심사자 · 팀원이고, 로그인은 없다.
- **구성**: 서비스 두 개 + DB 하나.
  - `demo-app-fe`: Vite + React 19 정적 빌드를 비특권 nginx(포트 3000)가 서빙. `/api/`와 `/health`를 클러스터 내부 `demo-app-be:8000`으로 프록시(`fe/nginx.conf`). 외부에 노출되는 유일한 서비스.
  - `demo-app-be`: Fastify 5 + Drizzle ORM + postgres.js(포트 8000). 라우트 7개(`/health`, `/healthz/liveness`, `/api/info`, `/api/votes` GET, `/api/votes/:id` POST, `/api/guestbook` GET/POST).
  - PostgreSQL 17. 테이블 두 개(`votes`, `guestbook`), 스키마는 `db/init.sql`. BE 시작 시 DB에 못 붙으면 **인메모리 fallback**으로 기동한다.
- **성격 판단**: 금융 · 공공 · 고객용 서비스가 아니라 **내부 시연 도구**다. 브리프의 하루 이용자 100명 이하, 예산 10만 원 이하와 맞는다.

## 다루는 데이터

| 테이블 | 필드 | 성격 |
|---|---|---|
| `votes` | `option_key`, `title`, `count`, `updated_at` | 집계 숫자. 누가 투표했는지 저장하지 않음(1인 1투표는 브라우저 localStorage에서만 처리) |
| `guestbook` | `name`(≤50자), `message`(≤500자, 화면은 ≤200자), `created_at` | 사용자가 자유 입력하는 **닉네임과 응원 메시지** |

- **민감 데이터 판단**: 코드에서 로그인 · 인증 · 세션 · 결제 · 이메일 · 전화번호 · 주소 필드를 **찾지 못했다**. 입력 폼은 방명록의 "작성자 닉네임"과 "배포 응원 메시지" 두 칸만 있고 익명 입력이다. 데이터 모델상 개인정보를 수집하도록 설계되지 않았다.
- **단서**: 자유 입력란이므로 사용자가 실명 · 연락처를 적으면 저장된다. 다만 이는 설계 의도가 아니고, 공개 방명록 특성상 이용자도 공개를 전제로 적는다.
- **브리프와 비교**: 브리프의 `handles_sensitive_data`는 `unknown`(모름)이다. 코드 조사 결과는 "민감 데이터 없음"에 가깝다. **이 분석은 답변을 고치지 않는다.** `compliance: regulated`는 사람이 확인해 바꾸거나 유지한다. 확인 질문: "방명록에 실명 · 연락처를 적게 할 계획이 있는가?" — 없다면 `no`로 바꿀 근거가 된다.
- **비밀값**: 코드에 비밀값은 없다. `DATABASE_URL` 기본값 `postgresql://demo:demo@localhost:5432/demo`가 소스에 들어 있으나 로컬 전용이고, 배포에서는 `demo-app-db` Secret으로 주입된다(`deploy/values-be.yaml`의 `envFromSecrets`).

## 가용성 요구

- **중단의 영향**: 멈추면 시연 화면이 깨진다(투표 · 방명록 미동작, 상단 상태 카드가 갱신되지 않음). 곤란한 사람은 시연 진행자와 관람자이고, 외부 고객 · 매출 · 법적 의무는 걸려 있지 않다. 시연 밖 시간에는 아무도 쓰지 않는다.
- **브리프와 비교**: 가용성 답변은 `standard`(일반 운영). 서비스 성격은 그보다 낮은 `demo`에 해당하지만, 시연 중 끊김은 데모 목적 자체(무중단 배포 시연)를 해치므로 **"배포 중 무중단"이 실제 요구**다. 이것은 복제 수가 아니라 Blue-Green 승격 흐름이 보장한다.
- **결정 — 가용성 수준**: 시연용이므로 **FE · BE 각 `replicas: 1`**. 이중화는 비용 대비 효과가 없고, 아래 fallback 문제 때문에 BE 다중 복제는 오히려 해롭다.
  - BE가 메모리 fallback 상태에서 복제가 2개 이상이면 각 파드가 **서로 다른 투표 · 방명록 데이터**를 들고 있어 폴링마다 값이 왔다 갔다 한다.
- **DB**: 단일 인스턴스로 충분. 데이터는 시연용 시드 + 방명록이라 유실돼도 재시드 가능(`init.sql`이 멱등).
- **결정 — 데이터 보관 위치 제한**: **없음**. 금융 · 결제 · 공공 데이터가 아니므로 국내 · 사내 보관을 서비스 성격이 요구하지 않는다. 브리프의 `preferred_target: onprem`은 **사용자 선호**이며 데이터 상주 요구가 아니다. 배포 대상 추천 규칙 1번(보관 위치) 입력은 "제한 없음"으로 넘긴다.

## 사용 패턴

- **읽기 위주의 폴링**. 브라우저 한 탭이 `/api/info` 1초 1회(`App.tsx:86`), `/api/votes`와 `/api/guestbook` 3초 1회씩(`App.tsx:120`)을 호출한다. 탭 하나당 약 1.7 req/s, 동시 접속 100탭 가정 시 약 170 req/s(상세 산정은 트래픽 분석기 몫).
- **DB 부하**: `/api/info`와 `/health`는 호출마다 `SELECT 1`을 날린다(`be/src/db/index.ts checkDbHealth`). 폴링 때문에 DB 질의 대부분이 이 헬스 질의다. 연결 풀은 `max: 5`.
- **쓰기**: 투표 POST(카운터 +1, 비멱등)와 방명록 POST(INSERT). 사람이 버튼을 누를 때만 발생하고 양이 적다.
- **실시간 연결 없음**: WebSocket · SSE 없음. 모두 짧은 HTTP 요청.
- **백그라운드 · 예약 작업 없음**: 큐 · 크론 · 워커 없음. 유일한 부수 작업은 차트의 `migration`(`init.sql` 적용)이다.
- **상태**: BE는 DB 연결 시 무상태. fallback 모드에서만 프로세스 메모리에 상태가 생긴다.

## 외부 의존

- **런타임**: **외부 API 호출 없음**. BE가 닿아야 하는 곳은 PostgreSQL 하나. FE(nginx)는 클러스터 내부 DNS `demo-app-be`만 바라본다.
- **빌드 시**: `node:22-alpine`, `nginxinc/nginx-unprivileged:alpine`, npm 레지스트리(pnpm 설치), 이미지 저장소 `ghcr.io/softbank-hackathon-2026-team-amethyst/*`. 배포 대상(특히 온프레미스)에서 ghcr.io pull이 가능해야 한다.
- **CORS**: `origin: true`(모든 출처 허용). 외부 노출이 FE만이고 BE는 프록시 뒤라 당장 문제는 아니지만, BE를 직접 노출하는 구성이면 조여야 한다(보안 분석기 몫).

## 배포에 미치는 영향

1. **헬스체크가 DB 장애를 숨긴다.** `/health`는 DB가 끊겨도 `200 {status:"ok", database:"fallback-memory"}`를 돌려준다. readiness를 상태 코드만 보면 DB 없이도 Ready가 되고, 승격 판단도 통과한다. **smoke는 `/health`의 `database == "connected"` 또는 `/api/info`의 `dbConnected == true`를 본문에서 확인해야 한다.**
2. **DB는 BE보다 먼저 준비돼야 한다.** `initDb()`는 시작 때 한 번만 Drizzle 인스턴스를 만든다. 시작 시 실패하면 이후 `checkDbHealth()`가 성공해 `/health`가 `connected`로 바뀌어도 데이터 라우트는 `db`가 `null`이라 계속 메모리를 쓴다(`isDbConnected && db` 조건). 이 상태를 벗어나려면 **파드 재시작**이 필요하다. 차트의 `migration` 잡이 BE보다 앞서 DB 접속을 확인하면 자연히 해결된다. 1번 항목의 smoke 검사가 이 경우도 잡아낸다.
3. **스키마는 Blue-Green에 안전하다.** `init.sql`은 `CREATE TABLE IF NOT EXISTS` + `ON CONFLICT DO NOTHING`으로 멱등이고, 두 버전(v1/v2)이 같은 DB를 쓰는 동안 호환되지 않는 변경이 없다. 버전 차이는 `APP_VERSION` 환경변수에 따른 테마 색만이다.
4. **FE→BE 서비스 이름이 고정돼 있다.** `nginx.conf`가 `demo-app-be:8000`을 하드코딩한다. Blue-Green이 BE의 green을 별도 Service 이름으로 띄우면 FE는 여전히 blue BE를 호출한다. FE와 BE가 **같은 릴리스 단위로 함께 승격**되거나, BE Service 이름 `demo-app-be`가 안정 이름(active)으로 유지돼야 한다. 또 FE 프록시가 BE 앞에 있으므로 외부 smoke는 FE 경로(`/api/info` via FE)로 BE까지 한 번에 확인할 수 있다.
5. **오래 가는 연결 · 진행 중 작업 없음.** 폴링만 있고 `SIGTERM`에 `app.close()`로 정상 종료하므로 blue를 내릴 때 요청 유실 걱정이 적다. postgres.js `idle_timeout: 10`으로 유휴 연결도 빨리 닫힌다.
6. **쓰기 smoke는 흔적이 남는다.** 투표 POST는 득표수를 바꾸므로 **smoke에서 제외**한다. 방명록 POST는 꼭 필요할 때만, 테스트용임이 드러나는 값으로 넣는다. 데이터를 남기지 않고 쓰기 경로를 확인하려면 빈 본문으로 400을 받는 검증 경로를 쓴다.
7. **`/api/info`의 `region` 기본값 `ap-northeast-2`**는 하드코딩 표시값이다. 온프레미스에 배포하면 화면에 AWS 리전명이 뜬다. 기능 영향은 없고 `REGION` 환경변수로 덮을 수 있다.
8. **복제 수**: `replicas: 1` (가용성 요구 절 참고).

## smoke 요청 후보

| 서비스 | method | path | expect | 비고 |
|---|---|---|---|---|
| demo-app-be | GET | `/healthz/liveness` | 200, body `status == "alive"` | DB 무관 프로세스 생존 |
| demo-app-be | GET | `/health` | 200, body `status == "ok"` **and** `database == "connected"` | `fallback-memory`면 실패로 본다(영향 1 · 2) |
| demo-app-be | GET | `/api/info` | 200, `version == <승격할 버전 태그>`, `dbConnected == true` | green이 새 버전인지 확정하는 핵심 검사 |
| demo-app-be | GET | `/api/votes` | 200, `items.length == 3`, `totalVotes >= 25`, 각 항목에 `percentage` 존재 | 시드 3건(5+8+12=25) 이상이어야 DB를 읽은 것 |
| demo-app-be | GET | `/api/guestbook` | 200, `entries`가 배열, `entries.length >= 1`, 첫 항목 `name != "시스템 안내"` | `"시스템 안내"`는 메모리 fallback 시드 → DB 미연결 신호 |
| demo-app-be | POST | `/api/guestbook` (body `{}`) | 400, `error == "Name is required"` | 쓰기 라우트의 검증 경로. **데이터를 남기지 않음** |
| demo-app-be | POST | `/api/guestbook` (body `{"name":"smoke-test","message":"[smoke] 승격 검사 <릴리스 태그> <실행 ID>"}`) | 200, `success == true`, `entry.name == "smoke-test"` | **선택.** INSERT 경로가 꼭 필요할 때만. 값에 `smoke`가 들어가 테스트임이 드러나고, 시연 전 삭제 가능 |
| demo-app-fe | GET | `/` | 200, `Content-Type: text/html`, 본문에 `<div id="root">`와 `Release Pulse` 포함 | 정적 서빙 확인 |
| demo-app-fe | GET | `/api/info` | 200, `dbConnected == true` | nginx → `demo-app-be:8000` 프록시 확인(영향 4). 외부에서 BE까지 한 번에 검사 |
| demo-app-fe | GET | `/health` | 200, `database == "connected"` | 프록시 경로 두 번째 확인 |
| demo-app-fe | GET | `/no-such-page` | 200, HTML(`index.html`) | SPA fallback(`try_files … /index.html`) 확인. 선택 |

제외: `POST /api/votes/:id` — 득표수를 영구히 바꾸고 되돌릴 API가 없다.

## 가정

| 가정 | 근거 | 틀렸을 때 |
|---|---|---|
| 민감 데이터 없음(`handles_sensitive_data`는 `no`가 타당) | 로그인 · 결제 · 개인정보 필드가 코드 · 스키마 · 폼에 없음. 방명록은 익명 닉네임 + 공개 메시지 | 브리프 답변은 그대로 `unknown`. `compliance`는 사람이 결정. 실명 · 연락처 수집 계획이 있으면 `regulated` 유지 |
| 데이터 보관 위치 제한 없음 | 금융 · 결제 · 공공 성격 아님. README가 "시연용"이라 명시 | 조직 정책으로 사내 보관이 필요하면 `preferred_target: onprem`이 선호에서 요구로 바뀜 |
| 가용성은 `demo` 수준, `replicas: 1` | README "시연용", 이용자 ≤100명, 예산 ≤10만 원. 브리프 `standard`는 "배포 중 무중단"을 뜻한다고 해석 | 상시 운영이 필요하면 BE 복제를 늘리되, 메모리 fallback 상태에서의 데이터 불일치(가용성 절)를 먼저 해결해야 함 |
| 승격 버전은 `APP_VERSION` 환경변수와 이미지 태그가 일치 | `deploy/values-be.yaml`이 `env.APP_VERSION: v1.0.0`을 명시, `/api/info`가 이 값을 돌려줌 | 태그와 환경변수가 다르면 `/api/info` `version` 검사는 환경변수 값 기준으로 바꿔야 함 |
| 시드 데이터가 승격 시점에 존재(`totalVotes >= 25`, 방명록 ≥1건) | `init.sql` 시드 + 차트 `migration.enabled: true`. 투표는 증가만 하고 감소 · 삭제 API가 없음 | DB를 비우고 재시드하지 않으면 `totalVotes >= 25`가 깨짐 → 임계값을 `>= 0`과 `items.length == 3`으로 완화 |
| FE와 BE가 같은 릴리스 단위로 승격되고 BE Service 이름 `demo-app-be`가 유지 | `nginx.conf` 하드코딩, `values-be.yaml` 주석 "FE nginx가 demo-app-be:8000으로 프록시" | 따로 승격하면 FE가 구버전 BE를 호출. App Chart의 Blue-Green Service 명명 규칙 확인 필요(코드베이스 분석기 · provision 단계) |
| 하루 이용자 100명을 "동시 접속 100탭"으로 상한 해석(약 170 req/s) | 폴링 주기 코드(`App.tsx:86,120`) | 실제 동시 접속은 이보다 훨씬 적을 가능성이 높음. 정확한 산정은 트래픽 분석기가 함 |
| 배포 대상에서 ghcr.io 이미지 pull 가능 | `deploy/values-*.yaml`의 `image.repository` | 온프레미스가 외부망 차단이면 미러 레지스트리 필요(T27 온프레미스 보완 범위) |
