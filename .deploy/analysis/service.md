# 서비스 분석

분석일: 2026-10-10 (yolo 재검증, 기준 커밋 b8bc6d8)

브리프(2026-10-10): 하루 100명 이하 · 월 10만 원 이하 · 민감 데이터 **예**(`regulated`) · 선호 대상 **AWS** · 가용성 **시연용**.
같은 날의 2차 분석(커밋 3b0caf7 기준)을 `git log 3b0caf7..HEAD`의 변경으로 델타 재검증했다. 그 사이 바뀐 것: FE 다국어(en/ja/ko, 영어 기본, `fe/src/i18n.ts`), FE p95를 브라우저 측정으로 계산, `APP_VERSION` v2.0.0, 승인자용 green 미리보기 SSO(T31: `deploy/values-fe.yaml` `previewAuth`, `infra/envs/aws` `preview_auth` 모듈), 템플릿 v2.2.1, Dockerfile BUILDPLATFORM. 그리고 2차 분석 문서가 "아직 남아 있다"고 적었던 세 가지 — `/health` 503, `CHAOS_ENABLED` 게이트, 방명록 시드 멱등화 — 는 PR #52(3b0caf7)로 이미 머지돼 **현재 코드에 반영돼 있다.** 이 문서는 그 세 가지를 반영해 다시 썼다.

## 요약

- **무엇을 하는가**: 원터치 배포 플랫폼 **시연용 웹앱** "Real-Time Deployment Status"(영어 기본, 한국어 · 일본어 전환). 화면 하나에 네 영역이 있다.
  1. 배포 상태 · 버전 모니터링 — `/api/info`를 1초마다 폴링해 버전 · 호스트명(파드) · 가동시간 · DB 연결 상태를 표시하고, 호스트명이 바뀌면 "새 버전으로 전환됨" 배지를 띄운다(Blue-Green 승격을 눈으로 보여주는 장치). 롤아웃 타일은 최근 60회 응답의 버전별 비율을 보여준다.
  2. 파드별 트래픽 · CPU · 메모리 차트 — `/api/metrics`를 1초마다 폴링(파드 1개 기준 인메모리 집계, `be/src/routes/metrics.ts`). 응답 시간 중앙값 · p95는 이제 **브라우저가 `/api/info` 폴링으로 측정한 값**으로 계산한다(`App.tsx:440-441`, 커밋 01e490d). `/api/metrics`의 `p95`는 더 이상 화면에 쓰지 않는다.
  3. 배포 전략 투표(`/api/votes`, 3개 항목)와 방명록(무중단 DB CRUD 검증용).
  4. **시연 관리자 패널**(`App.tsx` "Demo Tools") — 브라우저 쪽 트래픽 부하 생성기(0 · 10 · 30 · 60 RPS로 `/api/votes` 호출)와 BE 장애 주입(`/api/chaos`: 지연 ms · 에러율 · DB 단절 토글, `/api/chaos/reset`으로 원복). BE가 `CHAOS_ENABLED`가 아니면 `GET /api/chaos`의 `enabled:false`를 보고 패널 버튼을 비활성화한다(`App.tsx:924-986`).
- **사용자**: 시연을 보는 해커톤 심사자 · 팀원. 로그인 · 회원 개념이 없고 모두 익명이다. 언어 선택은 `localStorage`(`demo_lang`)에만 남는다.
- **구성**: 서비스 두 개 + DB 하나 (+ AWS에서는 FE 릴리스마다 미리보기 인증 프록시 하나).
  - `demo-app-fe`: Vite + React 19 정적 빌드를 비특권 nginx(포트 3000)가 서빙. `/api/`와 `/health`를 클러스터 내부 `demo-app-be:8000`으로 프록시(`fe/nginx.conf`). 사용자에게 노출되는 유일한 서비스. AWS에서는 `previewAuth.enabled: true`라 차트가 **oauth2-proxy**(`demo-app-fe-preview-auth` Deployment · Service · Ingress · ExternalSecret)를 추가로 만들고, 승인자가 `green-yolo.onetatchi.soulee.dev`(test) · `green.onetatchi.soulee.dev`(prod)로 green FE를 본다. gcp · onprem은 끈다(`deploy/gcp/values.yaml`, `deploy/onprem/values.yaml`).
  - `demo-app-be`: Fastify 5 + Drizzle ORM + postgres.js(포트 8000). 라우트 — `/health`, `/healthz/liveness`, `/metrics`(Prometheus, FE가 프록시하지 않음), `/api/info`, `/api/metrics`, `/api/votes` GET, `/api/votes/:id` POST, `/api/guestbook` GET/POST, `/api/chaos` GET(항상), `/api/chaos` POST · `/api/chaos/reset` POST(**`CHAOS_ENABLED=true`일 때만 등록**, `chaos.ts:16-35`). 현재 `deploy/values-be.yaml`은 `CHAOS_ENABLED: "true"`, `APP_VERSION: v2.0.0`(테마 "Emerald Green (v2)").
  - PostgreSQL 17. 테이블 두 개(`votes`, `guestbook`), 스키마는 `db/init.sql`. BE는 DB에 못 붙으면 **인메모리 fallback**으로 동작하되, `/health`가 503을 돌려 그 상태를 숨기지 않는다.
- **성격 판단**: 금융 · 결제 · 공공 · 고객용 서비스가 아니라 **내부 시연 도구**다. 브리프의 이용자 ≤100명, 예산 ≤10만 원, 가용성 `demo`와 일치한다. `regulated` 분류는 아래 "다루는 데이터"에서 따로 다룬다. 이번 델타에서 서비스 성격을 바꾸는 변경은 없다(다국어 · 측정 방식 · 미리보기 인증은 모두 표시 · 운영 쪽 변경).

## 다루는 데이터

| 테이블 | 필드 | 성격 |
|---|---|---|
| `votes` | `option_key`, `title`, `count`, `updated_at` | 집계 숫자 3행. 누가 투표했는지 저장하지 않음(1인 1투표는 브라우저 `localStorage`에서만, `App.tsx:65-72`) |
| `guestbook` | `name`(≤50자), `message`(≤500자), `created_at` | 사용자가 자유 입력하는 **닉네임과 응원 메시지**. 삭제 · 수정 API 없음, 보존 기간 없음 |

프로세스 메모리에만 있는 상태: 장애 주입 설정(`chaosState`), 최근 60초 요청 집계(`/api/metrics`), fallback 모드일 때의 투표 · 방명록 사본. 브라우저에만 있는 상태: 투표 여부(`demo_voted_option`), 언어(`demo_lang`).

- **코드에서 찾은 것**: 로그인 · 세션 · 인증 토큰 · 결제 · 이메일 · 전화번호 · 주소 · 주민번호 필드가 **없다**. 입력 폼은 방명록의 닉네임 · 메시지 두 칸뿐이고, 투표는 버튼 클릭만 보낸다. 데이터 모델은 개인정보를 수집하도록 설계되지 않았다. 다국어 변경은 문자열 테이블만 추가했고 새 입력 · 저장은 없다.
- **브리프와 비교 — `handles_sensitive_data: yes`**: 코드 조사 결과와 어긋난다. 분석은 답변을 고치지 않고, "예"가 무엇을 가리킬 수 있는지와 그것이 배포에 무엇을 요구하는지를 적는다.
  1. **방명록 자유 텍스트**(가장 그럴듯함). 사용자가 실명 · 소속 · 연락처를 적으면 그대로 저장되고 지울 API가 없다. 이 경우 "개인정보가 들어올 수 있는 저장소"로 보는 것이 보수적이고 타당하다. → 요구: 저장 데이터 암호화, 접근 통제, (개인정보라면) 국외 이전 금지 정도. **사내 보관을 요구하지 않는다.**
  2. **인프라 비밀값 · 운영자 식별 정보**(DB 자격증명, Slack 봇 토큰, 그리고 이번에 추가된 oauth2-proxy 클라이언트 시크릿 · 쿠키 시크릿 `demo-app-preview-oauth2-proxy-*`). 앱 데이터가 아니라 배포 체계의 비밀값이고, Secrets Manager → ClusterSecretStore(External Secrets)로 다룬다. 또 Cognito User Pool에는 Identity Center에서 SAML로 로그인한 **승인자의 페더레이션 사용자 레코드(이메일)** 가 생긴다. 이는 시연 서비스 데이터가 아니라 팀 운영자 계정 정보이며, 원장은 Identity Center(ADR 0015)다. 서비스 데이터 보관 위치 판단과 무관.
  3. **운영 정보 노출**(`/api/info`의 파드 호스트명 · 리전, `/api/metrics`의 CPU · 메모리). 시연 기능이지 규제 대상 데이터가 아니다.
  4. **보수적 답변**(해커톤 평가 · 조직 기본 정책). 이 경우 요구 사항은 `compliance: regulated`의 운영 승인 관문 유지가 전부다. 이번 T31은 바로 그 관문(사람 승격)을 위해 승인자가 green을 보게 하는 장치다.
  어느 해석이든 금융(전자금융) · 공공(CSAP) · 의료처럼 **법령이 사내 또는 특정 설비 보관을 강제하는 데이터는 없다.**
- **결정 — 데이터 보관 위치 제한: 없음** (배포 대상 추천 규칙 1번 입력). 근거:
  - 서비스 성격(시연 · 익명 · 비금융 · 비공공)상 사내 보관 의무가 없다.
  - "예"를 가장 엄격하게 "방명록에 개인정보가 들어온다"로 읽어도 요구되는 것은 **국내 보관**이지 사내 보관이 아니다. AWS 서울 리전(`ap-northeast-2`)의 RDS는 데이터가 물리적으로 국내에 있고, `infra/envs/aws/variables.tf`가 `region == "ap-northeast-2"`를 validation으로 강제하므로 다른 리전으로 샐 수 없다. 새로 추가된 Cognito User Pool도 같은 리전(`cognito-idp.ap-northeast-2.amazonaws.com/ap-northeast-2_tX5SjFeTO`)이다. RDS 저장 암호화는 모듈 기본값이다. → **AWS 서울 리전이 국내 보관 요구를 충족한다.**
  - 사용자 스스로 선호 대상을 AWS로 바꿨다. "예"가 사내 보관 요구를 뜻한다고 볼 근거가 없다.
  - 따라서 규칙 1번에는 "제한 없음(국내 보관 요구가 있더라도 서울 리전으로 충족)"으로 넘긴다. `compliance: regulated`는 유지한다 — 사람이 바꾸는 값이고, 바꿀 근거 질문은 "방명록 자유 텍스트를 개인정보로 볼 것인가"다.
- **비밀값**: 코드에 비밀값은 없다. `DATABASE_URL` 기본값 `postgresql://demo:demo@localhost:5432/demo`는 로컬 전용이고, 배포에서는 `demo-app-db` Secret이 덮는다(`deploy/values-be.yaml` `envFromSecrets`). `values-fe.yaml`의 `issuerUrl` · `remoteKey`(Secrets Manager ARN)는 식별자이지 비밀값이 아니다.
- **데이터 공유 범위(AWS)**: `infra/envs/aws/main.tf`의 `service_base`가 test · prod 네임스페이스에 **같은 RDS, 같은 데이터베이스 `demo`**를 연결한다. test에 쓴 방명록이 prod 화면에 그대로 보인다. 민감 데이터 "예"라면 test 환경에서의 쓰기(smoke · 수동 테스트)도 prod 데이터에 섞인다는 뜻이다(아래 "배포에 미치는 영향" 5).

## 가용성 요구

- **중단의 영향**: 멈추면 시연 화면이 깨진다(상단 상태 카드가 "Outage", 투표 · 방명록 미동작). 곤란한 사람은 시연 진행자와 관람자뿐이다. 외부 고객 · 매출 · 법적 의무는 걸려 있지 않고, 시연 밖 시간에는 아무도 쓰지 않는다.
- **브리프와 비교**: 가용성 답변 `demo`(시연용)가 서비스 성격과 정확히 맞는다. 다만 이 앱의 시연 주제가 "무중단 배포"이므로 **배포 중 끊김 없음**은 실제 요구다. 이것은 복제 수가 아니라 Blue-Green 승격 흐름(green 기동 → smoke → 트래픽 전환)이 보장한다.
- **결정 — 가용성 수준**: **FE · BE 각 `replicas: 1`**(`deploy/aws/values.yaml`). 이유:
  - 시연용이라 이중화의 비용 대비 효과가 없다. t3.medium 노드의 파드 한도(17개) 안에서 test · prod × Blue-Green을 올리려면 1이 맞다. **이번 델타로 파드가 늘었다**: FE `previewAuth`가 켜진 릴리스마다 oauth2-proxy 파드 1개(`replicas: 1` 고정, 차트 `preview-auth.yaml:38`)가 상시로 뜬다 → test · prod 합쳐 +2. 파드 예산 계산은 코드베이스 · 예산 분석기가 다시 맞춘다.
  - BE를 2개 이상으로 늘리면 (a) fallback 상태에서 파드마다 다른 투표 · 방명록이 보이고, (b) **장애 주입 상태가 파드별**이라 관리자 패널에서 "DB 단절"을 켜도 절반만 끊기며, (c) `/api/metrics`가 응답한 파드의 값만 내려 차트가 파드 사이를 오간다(`metrics.ts:4` 주석). 시연 의도상 **1개가 오히려 맞다.**
- **장애 주입이 가용성에 미치는 것(변경됨)**: `index.ts:41-46`의 preHandler가 이제 `/health` · `/healthz/*`도 제외하므로 **에러율 · 지연 주입은 readiness를 떨어뜨리지 않는다.** `chaos.dbError`도 `/health`는 `ignoreChaos: true`로 실제 DB만 보고 본문 `chaosDbError`에만 표시한다(`health.ts:6-19`). 2차 분석의 "에러율 100%를 켜면 파드가 NotReady → 전면 중단" 경로는 **사라졌다.** 남는 것은 데이터 라우트가 500 · 지연 · 메모리 모드로 보이는 시연 효과뿐이며, `/api/chaos/reset` 또는 파드 재시작으로 돌아온다. POST가 `CHAOS_ENABLED`로 게이트되므로 "누구나 켤 수 있다"는 문제는 **값 파일에서 끄면 닫힌다**(현재는 시연을 위해 켜 둠. 끄는 시점은 보안 분석기 몫).
- **미리보기 인증이 가용성에 미치는 것**: oauth2-proxy · Cognito · Identity Center는 **승인자가 green을 눈으로 볼 때만** 쓰인다. 사용자 트래픽(active Ingress) · 승격 버튼 · promote-judge는 이 경로를 거치지 않으므로(ADR 0015 §5) Cognito 장애가 서비스 가용성에는 영향이 없다.
- **DB**: 단일 인스턴스(RDS `db.t4g.micro`, single AZ)로 충분. 데이터는 시드 + 방명록이라 유실돼도 재시드 가능(`init.sql`의 테이블 · 시드는 이제 모두 멱등).

## 사용 패턴

- **읽기 위주의 폴링**(변경 없음). 탭 하나가 `/api/info` 1초 1회(`App.tsx:250`), `/api/metrics` 1초 1회(`App.tsx:294`), `/api/votes` · `/api/guestbook` 3초 1회씩(`App.tsx:393`) → **탭당 약 2.7 req/s**. `/api/chaos` GET은 로드 때 1회. 동시 100탭이면 약 270 req/s. 모두 FE nginx를 거쳐 BE로 간다. 다국어는 네트워크 요청을 늘리지 않는다(문자열 테이블이 번들에 포함).
- **DB 부하는 폴링보다 작다**. `checkDbHealth()`가 3초 TTL 캐시와 1초 타임아웃을 갖고(`db/index.ts:67-91`), `/api/info` · `/health`의 `SELECT 1`은 탭 수와 무관하게 **파드당 3초에 1회**다. `/api/metrics`는 DB를 쓰지 않는다. 남는 DB 질의는 `/api/votes` · `/api/guestbook`(탭당 0.67 q/s)뿐이다. 연결 풀은 `max: 5`, `idle_timeout: 10`, `connect_timeout: 2`, TLS는 `PGSSL=require`.
- **부하 생성기**: 관리자 패널에서 탭당 최대 60 req/s를 `/api/votes`에 추가로 보낸다(DB SELECT 1회씩). 시연자가 켜는 의도된 피크이며, 탭 몇 개에서 동시에 켜면 BE 파드 1개와 풀 5개가 먼저 포화한다. 수치 산정은 트래픽 분석기 몫.
- **쓰기**: 투표 POST(카운터 +1, 비멱등)와 방명록 POST(INSERT). 사람이 버튼을 누를 때만 발생하고 양이 적다. 속도 제한은 없다.
- **실시간 연결 없음**: WebSocket · SSE 없음. 모두 짧은 HTTP 요청(`/api/info` 폴링은 3.5초 abort).
- **백그라운드 · 예약 작업 없음**: 큐 · 크론 · 워커 없음. BE 안의 유일한 타이머는 CPU 샘플링 1초(`unref`). 배포 부수 작업은 차트의 `migration`(`init.sql` 적용)뿐.
- **상태**: DB 연결 시 데이터는 무상태. 프로세스 메모리 상태는 장애 주입 설정 · 메트릭 창 · fallback 데이터이며 파드가 바뀌면 사라진다. oauth2-proxy 세션은 쿠키에 담겨 파드 재시작과 무관(쿠키 시크릿이 같으면).
- **관측 식별자**: BE `onResponse` 훅과 FE nginx `map`이 User-Agent `one-tatchi-smoke`, `kube-probe/*`, `ELB-HealthChecker/*`, `GoogleHC/*`를 메트릭에서 제외한다(`metrics.ts`, `nginx.conf:2-8`). 플랫폼 `smoke.sh`가 실제로 `-A one-tatchi-smoke`로 보내는 것을 확인했다(v2.2.1) → 승격 smoke는 시연 차트를 오염시키지 않는다.

## 외부 의존

- **런타임(앱)**: **외부 API 호출 없음**. BE가 닿아야 하는 곳은 PostgreSQL(AWS: RDS, 노드 보안 그룹에서만 허용) 하나. FE(nginx)는 클러스터 내부 DNS `demo-app-be`만 바라본다. Prometheus 스크레이프(`/metrics`, FE는 `nginx-log-exporter` 4040)는 플랫폼이 들어오는 방향이다.
- **런타임(브라우저 측, 2차 분석에서 빠졌던 것)**: `fe/index.html`이 Pretendard 웹폰트를 `cdn.jsdelivr.net`에서 받는다. 관람자 브라우저가 외부에 닿아야 하지만 실패해도 기본 폰트로 그려지고 기능에는 영향이 없다. 클러스터 egress와는 무관.
- **런타임(미리보기 인증, AWS만)**: oauth2-proxy 파드 → Cognito(`cognito-idp.ap-northeast-2.amazonaws.com`, OIDC discovery · 토큰), 승인자 브라우저 → Cognito Hosted UI → Identity Center 포털(SAML). 클러스터에서 Cognito로 나가는 경로(NAT)가 필요하고, External Secrets가 Secrets Manager의 `demo-app-preview-oauth2-proxy-*`를 읽어야 한다(`cluster_addons.readable_secret_arns`에 추가됨). 이 경로가 막히면 **green 미리보기만** 안 열리고 배포 · 승격은 진행된다.
- **빌드 시**: `node:22-alpine`, `nginxinc/nginx-unprivileged:alpine`, npm 레지스트리(pnpm). Dockerfile이 `BUILDPLATFORM`을 써서 builder · deps 스테이지를 러너 아키텍처로 돌린다(PR #57, 결과 이미지 아키텍처는 바뀌지 않음). 이미지는 `ghcr.io/softbank-hackathon-2026-team-amethyst/demo-app-{be,fe}`; AWS 루트는 ECR 저장소도 만든다. 어느 쪽이든 EKS 노드가 외부 레지스트리에 닿는다(NAT 1개).
- **CORS**: `origin: true`(모든 출처 반사). 외부 노출이 FE뿐이고 같은 오리진에서 프록시하므로 기능상 필요 없다(보안 분석기 몫).

## 배포에 미치는 영향

1. **헬스체크가 DB 장애를 드러낸다(해결됨).** `/health`는 실제 DB에 닿지 못하면 `503 {status:"degraded", database:"fallback-memory"}`다(`health.ts`). readiness와 승격 smoke가 상태 코드만 봐도 DB 미연결 green은 걸러진다. `chaos.dbError`(시연용 DB 단절)는 503을 내지 않고 `chaosDbError:true`로만 표시되며, 이때 `/api/info.dbConnected`는 `false`가 되고 데이터 라우트는 메모리를 쓴다 — 이 상태는 `GET /api/chaos`로 본다(3번).
2. **DB는 BE보다 먼저 준비돼야 하고, 런타임 단절은 메모리로 넘어간다.** `initDb()`가 기동 때 실패하면 fallback으로 뜨지만 `/health`가 503이라 Ready가 안 되고 승격되지 않는다. 기동 뒤 DB가 살아나면 `checkDbHealth()`가 `db`를 만들어 **DB 경로로 복귀한다**(`db/index.ts:86`, 2차 분석의 "파드 재시작 필요"는 더 이상 사실이 아님). 기동 뒤 DB가 잠시 끊기면 `isDbConnected=false`로 바뀌어 데이터 라우트가 메모리로 전환되고, 그 사이 들어온 투표 · 방명록 쓰기는 DB가 돌아올 때 사라진다(`votes.ts`, `guestbook.ts` 조건). 차트의 `migration` Job이 BE보다 앞서 DB 접속을 확인하므로 기동 순서 문제는 평상시 없다.
3. **장애 주입 상태는 파드 메모리에만 있고, 변경 API는 값 파일로 닫을 수 있다.** green 파드는 항상 깨끗한 상태(지연 0 · 에러율 0 · DB 정상)로 뜬다. 다만 (a) smoke 실행 중 누군가 관리자 패널에서 장애를 켜면 — FE 경로로 공개돼 있고 FE가 어느 BE를 보느냐에 따라 green에 적용될 수 있다 — `/api/*` smoke가 무작위로 실패한다(`/health` · `/healthz` · `/api/chaos` · `/api/metrics`는 제외). (b) 시연자가 blue에 장애를 켜 둔 채 승격하면 전환 순간 장애가 "사라진다". **승격 전 `GET /api/chaos`를 smoke에 두고(현재 들어 있음), 시연 중에는 승격하지 않는다.** 시연이 끝나면 `CHAOS_ENABLED`를 `"false"`로 바꿔 POST 자체를 없앤다 — 이것은 BE 값 파일 변경이라 **BE 재배포(Blue-Green 한 번)** 가 필요하다.
4. **스키마와 시드가 모두 Blue-Green에 안전하다(해결됨).** `init.sql`의 `CREATE TABLE IF NOT EXISTS`, `votes` 시드(`ON CONFLICT DO NOTHING`), **`guestbook` 시드(`WHERE NOT EXISTS (SELECT 1 FROM guestbook)`)** 가 모두 멱등이다. 매 배포 `migration` Job이 돌아도 방명록이 쌓이지 않는다. 두 버전이 같은 DB를 쓰는 동안 호환되지 않는 변경이 없다(v1 → v2 차이는 `APP_VERSION`에 따른 테마 색뿐).
5. **test와 prod가 같은 데이터베이스를 쓴다(AWS).** `service_base`가 두 네임스페이스에 같은 RDS · DB 이름 `demo`를 넘긴다. test 승격 smoke가 방명록에 INSERT하면 prod 시연 화면에 보인다. **쓰기 smoke는 검증 경로(빈 본문 → 400)만 쓰고, INSERT smoke는 넣지 않는다.** 민감 데이터 "예" 답변과도 맞는 보수적 선택이다. 참고로 플랫폼 `smoke.sh`는 첫 바퀴에만 POST를 보내고 이후 바퀴는 GET만 반복하므로, 400 검증 POST는 승격당 1회다.
6. **FE→BE 서비스 이름이 고정돼 있다 — green FE는 active BE를 호출한다.** `nginx.conf`가 `demo-app-be:8000`(active Service)을 하드코딩한다. 플랫폼 ADR 0015 §5도 같은 사실을 적는다: 승인자가 green FE 미리보기를 봐도 **BE는 blue(active)** 다. 승격 smoke도 마찬가지 — `demo-app-fe-preview`로 들어간 `/api/*` 요청은 그 시점의 active BE로 간다. 서비스는 matrix로 **BE → FE 순서(`max-parallel: 1`)** 로 배포되므로 BE가 먼저 승격된 뒤 FE green이 뜨는 흐름에서는 FE smoke가 새 BE를 보지만, 사람 승격(prod)에서 BE가 Paused인 동안은 그렇지 않다(가정 참고). FE smoke의 `/api/*` 항목은 **nginx 프록시 경로 검증**으로 읽어야지 BE green 검증으로 읽으면 안 된다.
7. **승인자용 green 미리보기 SSO는 smoke · 승격 판단 경로를 가로채지 않는다(확인됨).** 근거 세 가지: (a) 차트 `preview-auth.yaml`은 oauth2-proxy를 **별도** `demo-app-fe-preview-auth` Deployment · Service · Ingress로 만들고 `--upstream=http://demo-app-fe-preview.<ns>.svc:3000/`로 넘긴다. 기존 `demo-app-fe-preview` ClusterIP Service는 그대로다(`service.yaml`). (b) 플랫폼 `promote-judge/smoke.sh`(v2.2.1)는 `kubectl port-forward svc/<release>-preview`로 **preview Service에 직접** 붙어 `http://127.0.0.1:<port>`에 요청한다. 인증 프록시를 거치지 않는다. (c) ADR 0015 §4 표에 "promote-judge: 변경 없음. 지금처럼 port-forward로 smoke를 보낸다"고 명시. 따라서 `.deploy/smoke.json`의 FE 항목은 로그인 리다이렉트(302) 없이 그대로 200을 받는다. 반대로 승인자가 브라우저로 여는 `green*.onetatchi.soulee.dev`는 Cognito 로그인을 요구하며, 인증되지 않은 요청은 green에 닿지 않는다(T30 ADR 0011의 "공개 preview 없음" 유지).
8. **미리보기 인증은 FE에만 켜져 있다.** `values-be.yaml`에는 `previewAuth`가 없어 차트 기본값 `enabled: false`다. BE green은 승인자가 볼 수 없고(FE 미리보기 경유로도 6번 때문에 못 봄), promote-judge만 본다. 규제 관문에서 사람이 BE 변경을 확인하려면 Slack 알림의 AI 판단 보고서가 근거다.
9. **oauth2-proxy는 릴리스 전체 기동 조건이 될 수 있다.** `previewAuth`를 켜면 ExternalSecret이 `demo-app-fe-preview-auth` Secret을 만들어야 oauth2-proxy 파드가 뜬다. Secrets Manager 읽기 권한(`cluster_addons.readable_secret_arns`)이 없거나 시크릿 키(`OAUTH2_PROXY_CLIENT_ID` · `_SECRET` · `COOKIE_SECRET`)가 비어 있으면 그 파드만 CrashLoop/Pending이고 FE 본체 Rollout과 smoke는 별개다. 다만 Helm `--wait`를 쓰는 배포라면 릴리스가 timeout으로 실패할 수 있다(플랫폼 deploy.yml 동작은 미확인 — 가정 참고).
10. **오래 가는 연결 · 진행 중 작업 없음.** 폴링만 있고 `SIGTERM`에 `app.close()`로 정상 종료하므로 blue를 내릴 때 요청 유실 걱정이 적다. FE 폴링은 실패를 "No response" 비트로 기록하고 다음 초에 재시도하므로 전환 중 1~2초 실패는 화면에 남지만 복구된다(시연에서 보여주려는 바로 그 장면).
11. **폴링 부하는 탭 수에 비례하고 부하 생성기가 이를 증폭한다.** 탭당 2.7 req/s + 생성기 최대 60 req/s. BE 1개로 시연 규모는 충분하지만, 승격 smoke를 부하 생성기가 켜진 상태에서 돌리면 p95 임계값(플랫폼 기본 2000ms, port-forward 경유)에 걸릴 수 있다(3번과 같은 "시연 중 승격 금지" 원칙).
12. **`/api/info`의 `region` 기본값 `ap-northeast-2`** 가 사실과 일치한다(AWS 서울). `REGION` 환경변수는 넣지 않아도 된다. 다국어는 `index.html`의 `<html lang="ko">` · `<title>배포 현황</title>`을 그대로 두므로 FE smoke의 HTML 검사 기준도 그대로다.
13. **복제 수 `replicas: 1`**, 데이터 보관 위치 제한 **없음**(위 절 참고).

## smoke 요청 후보

승격 판단(T7)이 green에 보낼 목록. 플랫폼 `smoke.sh`(v2.2.1)의 실제 동작을 확인한 전제: `expect`는 **상태 코드만** 비교하고 본문은 보지 않는다(`ok: status == expect`); UA `one-tatchi-smoke`; 기본 관찰 30초, 요청 타임아웃 5초; POST는 첫 바퀴만. 아래 표의 "본문 조건"은 smoke.json에 넣을 수 없고 **사람이 Slack 보고서 · green 미리보기에서 보는 추가 기준**이다. 읽기 위주이고, 쓰기는 데이터를 남기지 않는 검증 경로만 둔다.

| 서비스 | method | path | expect | 비고 |
|---|---|---|---|---|
| demo-app-be | GET | `/healthz/liveness` | 200 | DB 무관 프로세스 생존. **smoke.json에 있음** |
| demo-app-be | GET | `/health` | 200 | **DB 미연결이면 503이라 상태 코드만으로 걸러진다**(영향 1). 본문 `database == "connected"`, `chaosDbError == false`는 사람 확인. **있음** |
| demo-app-be | GET | `/api/info` | 200 | 본문 조건(사람): `dbConnected == true`, `version == "v2.0.0"`(`env.APP_VERSION`). **있음** |
| demo-app-be | GET | `/api/votes` | 200 | 본문 조건(사람): `items.length == 3`, `totalVotes >= 25`. 메모리 fallback도 같은 값이므로 `/health`와 함께 본다. **있음** |
| demo-app-be | GET | `/api/guestbook` | 200 | 본문 조건(사람): `entries[0].name != "시스템 안내"`(메모리 fallback 시드). **있음** |
| demo-app-be | GET | `/api/chaos` | 200 | 본문 조건(사람): `latencyMs == 0`, `errorRate == 0`, `dbError == false`; `enabled`가 값 파일과 일치. green이 깨끗한 상태로 떴는지(영향 3). **있음** |
| demo-app-be | GET | `/api/metrics` | 200 | 계측 라우트 생존. 선택. **있음** |
| demo-app-be | POST | `/api/guestbook` (body `{}`) | 400 | 쓰기 라우트의 검증 경로. **데이터를 남기지 않음.** 첫 바퀴만 실행. **있음** |
| demo-app-be | POST | `/api/guestbook` (body `{"name":"smoke-test","message":"[smoke] …"}`) | 200 | **기본 제외(유지).** test · prod가 같은 DB라 prod 시연 화면에 남는다(영향 5) |
| demo-app-fe | GET | `/` | 200 | 정적 서빙 확인. 본문 조건(사람): HTML, `<div id="root">`. **있음** |
| demo-app-fe | GET | `/no-such-page` | 200 | SPA fallback(`try_files … /index.html`) 확인. **있음** |
| demo-app-fe | GET | `/health` | 200 | **선택 추가 제안.** nginx → `demo-app-be:8000` 프록시 경로가 green FE에서 살아 있는지(영향 6). 장애 주입 제외 경로라 시연 중에도 안정적. 단 상대는 active BE이므로 "BE green 검증"이 아니라 "FE 프록시 설정 검증"이다 |
| demo-app-fe | GET | `/api/info` | 200 | 선택. 위와 같은 프록시 검증이지만 에러율 주입 대상이라 시연 중 무작위 실패 가능 → `/health` 쪽을 권함 |

**`.deploy/smoke.json`과 대조**: 현재 BE 8개 · FE 2개가 위 표의 "있음" 항목과 정확히 일치한다. 필수 변경은 없다. 선택 제안 1건: FE에 `GET /health → 200` 추가(프록시 경로 검증). 넣지 않아도 승격 판단에는 지장이 없다.

제외: `POST /api/votes/:id`(득표수를 영구히 바꾸고 되돌릴 API가 없음), `POST /api/chaos*`(운영 상태를 바꿈. `CHAOS_ENABLED=false`면 404), `GET /metrics`(FE가 프록시하지 않고 Prometheus 전용), 미리보기 호스트(`green*.onetatchi.soulee.dev`)로의 요청(Cognito 302 — smoke 경로가 아님).

## 가정

| 가정 | 근거 | 틀렸을 때 |
|---|---|---|
| 브리프의 "민감 데이터 예"는 방명록 자유 텍스트(또는 보수적 답변)를 뜻하며, 사내 보관 요구가 아니다 | 코드 · 스키마 · 폼에 개인정보 필드 없음. 금융 · 공공 · 의료 데이터 없음. 사용자가 선호 대상을 AWS로 답함 | 조직 정책으로 사내 보관이 필요하면 보관 위치 제한을 "데이터만 사내"로 올리고 추천 대상이 onprem으로 바뀐다. `compliance`는 어느 쪽이든 사람이 정한다 |
| 국내 보관이 요구되더라도 AWS 서울 리전(`ap-northeast-2`)으로 충족된다 | `infra/envs/aws/variables.tf` region validation, RDS · Cognito 모두 같은 리전, 저장 암호화 기본 | 리전 밖 복제(백업 복사 · 로그 전송)가 추가되면 그 경로를 따로 본다 |
| 가용성은 `demo` 수준, `replicas: 1` | 브리프 `demo`, README "시연용", 파드별 장애 주입 · 메트릭 설계 | 상시 운영이 필요하면 fallback 불일치 · 파드별 chaos 상태를 먼저 해결한 뒤 복제를 늘린다 |
| `/api/info`의 `version`은 `deploy/values-be.yaml` `env.APP_VERSION`(현재 `v2.0.0`)을 따르며 이미지 태그와 다를 수 있다 | `meta.ts:7`이 환경변수만 읽음 | 태그 기준으로 검사하려면 provision 단계에서 `APP_VERSION`을 태그로 주입해야 한다 |
| 시드 데이터가 승격 시점에 존재(`totalVotes >= 25`, 방명록 ≥1건) | `init.sql` 시드 + 차트 `migration.enabled: true`. 투표는 증가만 함. 방명록 시드는 테이블이 빌 때만 | DB를 비우고 재시드하지 않으면 `totalVotes` 임계값을 완화 |
| test · prod가 같은 RDS · DB를 공유한다 | `infra/envs/aws/main.tf` `service_base` for_each가 같은 `module.database.*`를 넘김, README 명시 | 환경별 DB로 분리되면 INSERT smoke를 test에서 켜도 prod 화면에 영향 없음 |
| FE와 BE가 같은 릴리스 단위로 승격되고 BE active Service 이름 `demo-app-be`가 유지 | `nginx.conf` 하드코딩, `values-be.yaml` 주석, ADR 0015 §5가 같은 구조를 전제 | 따로 승격하면 FE가 구버전 BE를 호출. green FE → green BE 연결은 플랫폼이 "별도로 정한다"(ADR 0015)고만 돼 있음 |
| 승격 smoke는 oauth2-proxy를 거치지 않고 `svc/<release>-preview`에 port-forward로 붙는다 | 플랫폼 v2.2.1 `promote-judge/smoke.sh`, `charts/app/templates/preview-auth.yaml`(`--upstream` → `<release>-preview`), ADR 0015 §4 "promote-judge 변경 없음" | 플랫폼이 smoke를 미리보기 호스트 경유로 바꾸면 FE smoke 전부가 302(로그인)로 실패한다. 그때는 smoke용 우회(헤더 · 토큰)를 플랫폼과 맞춰야 한다 |
| 서비스 matrix가 BE → FE 순서(`max-parallel: 1`)라 자동 승격(test · yolo)에서는 FE smoke 시점에 BE가 이미 새 버전이다 | `deploy.yml`의 `services` 배열 순서(BE 먼저), ADR 0002 "matrix job으로 하나씩 배포" | 순서가 다르거나 사람 승격으로 BE가 Paused인 동안 FE가 뜨면 FE smoke의 `/api/*`는 구 BE를 본다. 어느 쪽이든 FE smoke는 프록시 검증으로만 읽는다 |
| oauth2-proxy 파드 기동 실패가 FE Rollout의 Ready 판단에 섞이지 않는다 | 차트에서 별도 Deployment · Service이고 Rollout과 셀렉터가 다름 | 플랫폼 deploy.yml이 Helm `--wait`로 모든 워크로드를 기다리면 ExternalSecret 미해결 시 릴리스 전체가 timeout. 플랫폼 deploy.yml 본문은 이번에 읽지 않았음(미확인) |
| 승격 smoke는 시연(부하 생성기 · 장애 주입) 중에 돌리지 않는다 | `/api/chaos` POST가 FE 경로로 공개(`CHAOS_ENABLED=true`인 동안), 에러율 · 지연이 `/api/*`에 적용 | 시연 중 승격이 필요하면 `GET /api/chaos` 결과를 먼저 보고 smoke 재시도 횟수를 늘린다 |
| 하루 이용자 100명을 "동시 접속 100탭"으로 상한 해석(약 270 req/s, 생성기 제외) | 폴링 주기 코드(`App.tsx:250,294,393`) | 실제 동시 접속은 훨씬 적을 가능성이 높음. 정확한 산정은 트래픽 분석기가 함 |
