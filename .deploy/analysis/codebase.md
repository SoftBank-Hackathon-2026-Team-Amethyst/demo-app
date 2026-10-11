# 코드베이스 분석

분석일: 2026-10-11 (yolo 재검증, 기준 커밋 55b1586 = origin/main. 작업 트리는 `deploy/values-be.yaml`의 `APP_VERSION`만 v2.1.0 → v2.1.1로 바뀐 상태)
직전 분석: 2026-10-10 yolo 재검증(기준 커밋 b8bc6d8, 문서 커밋 adf4635). 그 뒤 직전 실행(b0d3df7)과 이번 실행 사이의 변경을 포함해 `git log b8bc6d8..55b1586`을 현재 코드로 다시 검증한 **델타 재검증**이다. 이전 문서에서 여전히 맞는 내용은 그대로 두고, 틀려진 부분(replica 수 · `CHAOS_ENABLED` 위치 · test DB · 버전 표기)과 새 기능(T25 CPU 부하 API)을 고쳤다.
브리프: 하루 100명 이하 · 월 10만 원 이하 · 민감 데이터 **예**(`regulated`) · 선호 대상 **AWS** · 가용성 **시연용** (변화 없음).
레포는 배포 산출물(Dockerfile · `deploy/` 값 파일 · `infra/envs/{aws,gcp,onprem}` · 워크플로 · `.deploy/smoke.json`)을 이미 갖고 있고, 이 분석은 산출물이 현재 코드와 App Chart 조건, `deploy-provision/references/artifacts.md` 규칙에 맞는지까지 본다.

## 이전 분석(b8bc6d8) 이후 바뀐 것

| 커밋 · PR | 코드 · 산출물 변화 | 이 분석에 미치는 영향 |
|---|---|---|
| **#106 (T25) CPU 부하 테스트** — a76a982 · 15b7eb1 | BE `be/src/routes/load.ts`(34줄) · `be/src/load/cpu-pool.ts`(88줄) · `be/src/load/cpu-worker.ts`(12줄) 추가. `GET /api/load/config`는 항상 등록, `POST /api/load/cpu`는 **`LOAD_TEST_ENABLED`가 `true|1|yes|on`일 때만** 등록(`NODE_ENV`와 무관). 연산은 `worker_threads` Worker 1개(파드당)가 sha256을 고정 횟수(`light` 5,000 · `medium` 15,000 · `heavy` 30,000) 반복. 실행 중 + 대기 합계 8개 초과면 429, 작업 2초 초과면 Worker 종료 후 503, `app.onClose`에서 pool 종료. `preHandler` 장애 주입 훅이 `/api/load/`를 제외. `routes/metrics.ts`의 `cpuPercent` 100% 상한 제거(Worker 포함 프로세스 CPU). 테스트 `be/tests/load.test.ts` 6개 추가, 통합 테스트가 `LOAD_TEST_ENABLED=true` · `NODE_ENV=production`으로 `/api/load/cpu` 200을 검증. FE `fe/src/CpuLoadPanel.tsx`(123줄) + `i18n.ts` 문구 + `App.tsx` 패널 삽입. `deploy/values-be.yaml env.LOAD_TEST_ENABLED: "true"`(공통 → **prod도 켜짐**), `APP_VERSION v2.1.0`. README API 표 · 환경변수 표 · "CPU 오토스케일 테스트" 절 | 환경변수 1개 추가(아래 표). 새 라우트 2개가 FE nginx `/api/` 프록시를 타므로 공개 주소에서 열린다. 인증 없음 → 결정 항목 C-1. 컨테이너 조건(읽기 전용 FS · 숫자 UID · CJS `__dirname`)은 아래 점검표에서 ✔. 트래픽 분석기 입력: 브라우저 한 탭당 최대 20 req/s 추가(패널 자체 제한 RPS ≤ 20, 동시 8, 최대 5분) |
| #74 (T35) `CHAOS_ENABLED` test 전용 | `deploy/values-be.test.yaml`(새 파일, `env.CHAOS_ENABLED: "true"`)로 이동. 파이프라인이 `values-be.yaml → deploy/<대상>/values.yaml → values-be.test.yaml` 순서로 합치고 prod에는 이 파일이 없다 | 직전 **C-1(prod의 `POST /api/chaos`) 해결**. 같은 패턴을 `LOAD_TEST_ENABLED`에도 쓸 수 있다(C-1 선택지) |
| #79 (T29) BE 자동 확장 | `deploy/values-be.yaml replicas: 2`, `autoscaling: {enabled, min 2, max 6, cpu 70%}`, `resources.requests.cpu 100m`(CPU limit 없음). `deploy/aws/values.yaml`은 주석만. onprem은 `replicas: 1` · `autoscaling.enabled: false`. plan.yaml `replicas: {default: 2, aws: 2, onprem: 1}`, `nodes.aws` t3.medium 3~5대 Cluster Autoscaler | "replica 1" 전제가 바뀜: aws는 파드 2~6개. 파드별 인메모리 상태(`chaosState` · `/api/metrics` 버킷 · CPU Worker 큐)는 **1/N에만** 걸린다(아래 "상태"). T25의 CPU 부하는 이 HPA를 시연하려는 기능이다 |
| #69 · #81 · fc9c587 (T32 · T33) test DB 온프레미스 연결 | `infra/envs/aws variables.tf db_link.test = {fqdn demo-app-db-test.tailb7ed7e.ts.net, secret demo-app-db-onprem-test}` + `module "db_link"`(tailscale). VPC CNI NetworkPolicy로 test BE 파드 · 마이그레이션 Job 파드만 통로 사용 | "test · prod가 같은 RDS"는 더 이상 맞지 않는다: **aws test는 온프레미스 Postgres(tailnet), prod만 RDS**. 앱 코드는 Secret `demo-app-db`만 읽으므로 코드 영향 없음 |
| #66 (T28) smoke 본문 조건 | `.deploy/smoke.json` `/health expect_body {database: connected}`, `/api/info expect_body {dbConnected: true}` | 메모리 폴백이면 503뿐 아니라 본문으로도 승격이 막힌다(의도) |
| #65 (T31) 미리보기 `/api/` 라우팅 | `deploy/values-fe.yaml previewAuth.routes: [/api/ → demo-app-be-preview:8000]`(차트 v2.4.0+) | green 미리보기 화면의 `/api/`가 green BE로 간다. FE 이미지 · nginx.conf는 그대로 |
| #82 · #97 · #98 · #101 (T31 · T38) onprem · gcp 미리보기 | `deploy/onprem/values.yaml previewAuth.remoteKey`, `deploy/gcp/values.yaml previewAuth.remoteKey + ingress(managedCertificate, 고정 IP)`, aws 루트 `gcp_preview_hosts` · Route53 A 레코드, gcp 루트 고정 IP · 시크릿 | 앱 코드 영향 없음. 모두 차트 · 인프라 |
| #107 · #108 · #109 (T39) 배포 대상 matrix | `deploy.yml`이 `.github/scripts/deploy-targets.sh`로 test/prod matrix를 만들고(`DEPLOY_TARGETS` → `DEPLOY_TARGET` → aws), `.github/tests/deploy-routing.test.cjs`(node:test, `npm ci --prefix .github/tests`)가 `request` 잡에서 분기 회귀를 검사. `onprem-wsl` 대상 추가(#105) | checks.yml 입력(`node-dirs` 등)은 그대로. `.github/tests`는 checks의 Node 잡이 아니라 `request` 잡에서 돈다 |
| 템플릿 bump #72 · #83 · 854d3fd · af801d2 · de62992 · #104 | `.deploy/config.yaml template_version: v2.17.0`, `infra_versions: {aws: v2.11.0, gcp: v1.16.2}`. 워크플로 8종 `@v2.17.0`(`approval-timeout.yml`은 `@v2` 태그), `chart-version: 2.17.0`. onprem tf `?ref=v2.17.0`, aws 모듈 `v2.11.0` + `preview_auth` · `db_link` `v2.17.0`, gcp `v1.16.2` | 직전 문서의 **버전 네 갈래 불일치 · B-3 해결**. `check-artifacts.sh` 통과(0건) |
| 887828e (yolo) | `fe/index.html <title>` "배포 현황 · Demo-App" | 영향 없음 |
| 이번 작업 트리 | `deploy/values-be.yaml APP_VERSION: v2.1.1`(미커밋) | `/api/info`의 `version`만 바뀐다 |

## 서비스
| 이름 | 경로 | 스택 | 실행 명령 | 포트 | 헬스체크 | Dockerfile | 외부 노출 |
|---|---|---|---|---|---|---|---|
| demo-app-be | `be/` | Node 22(alpine) · TypeScript 5.9 · Fastify 5 · Drizzle ORM 0.45 · postgres.js 3.4 · `@prometheus-io/client` 0.16.1 · pino · `node:worker_threads`(T25) · pnpm 10.28.1 | 빌드 `pnpm build`(tsc, CJS 출력) → 실행 `node dist/index.js` | 8000 (`PORT` 기본 8000, `HOST` 0.0.0.0) | `GET /health`: DB 연결 시 200 `{database: connected}`, 메모리 폴백이면 **503** `{status: degraded, database: fallback-memory}`; 장애 주입 `dbError`는 본문 `chaosDbError`로만 표시. `GET /healthz/liveness` 항상 200 | 있음 (3단계, `USER 1000`, builder · deps `--platform=$BUILDPLATFORM`) | 아니오. FE nginx가 클러스터 안에서 `http://demo-app-be:8000`으로 `/api/`, `/health`를 프록시. green 미리보기는 oauth2-proxy가 `/api/`를 `demo-app-be-preview:8000`으로 |
| demo-app-fe | `fe/` | Node 22 빌드 → `nginxinc/nginx-unprivileged:alpine`(UID 101) 정적 서빙 · Vite 6.4 · React 19 · Tailwind 4 · lucide-react · pnpm 10.28.1 | 빌드 `pnpm build`(`tsc -b && vite build`) → `nginx -g 'daemon off;'` | 3000 (`fe/nginx.conf` `listen 3000`) | 없음(정적). 값 파일 `probe.path: /`, `ingress.healthcheckPath: /` | 있음 (2단계, `USER 101`, builder `--platform=$BUILDPLATFORM`) | 예. aws는 ALB Ingress(`ingress.enabled: true`) + green 미리보기 호스트(previewAuth, Cognito), gcp는 GCE Ingress + ManagedCertificate, onprem은 Quick Tunnel → Service |

- 워커 · 크론 · 큐 소비자 없음. 서비스 2개. T25의 CPU Worker는 BE 프로세스 안의 `worker_threads`(별도 프로세스 · 파드 아님)라 서비스 단위가 늘지 않는다.
- FE → BE 호출은 전부 상대 경로(`fetch('/api/...')`, `App.tsx` 10곳 + `CpuLoadPanel.tsx` 2곳)라 번들에 BE 주소 · 환경변수가 없다. i18n도 번들 내장이다.
- BE 라우트: `/health`, `/healthz/liveness`, `/metrics`, `/api/info`, `/api/metrics`, `/api/votes`, `POST /api/votes/:id`, `/api/guestbook`, `POST /api/guestbook`, `GET /api/chaos`(항상, 본문 `enabled`), `POST /api/chaos` · `POST /api/chaos/reset`(`CHAOS_ENABLED=true`일 때만), **`GET /api/load/config`(항상, `{enabled, intensities, maxRps: 20, maxDurationSec: 300}`)**, **`POST /api/load/cpu`(`LOAD_TEST_ENABLED=true`일 때만, body `{intensity: light|medium|heavy}` 스키마 검증 · `additionalProperties: false`)**. README API 표와 일치.
- `preHandler` 장애 주입 훅은 `/metrics`, `/health`, `/healthz/*`, `/api/chaos*`, `/api/metrics*`, `/api/load/*`를 제외한다. 즉 지연 · 에러율은 `/api/info` · `/api/votes*` · `/api/guestbook*`에만 걸린다.
- `fe/nginx.conf`는 `location /api/`와 `location /health`만 프록시하므로 **`/metrics`(Prometheus)는 FE 공개 주소에서 열리지 않는다.** `/api/metrics` · `/api/chaos` · `/api/load/*`는 열린다.
- FE 브라우저 한 탭당 `/api/info` 1 req/s + `/api/metrics` 1 req/s(상시), 부하 생성기 켜면 `/api/votes`에 최대 60 req/s, **CPU 부하 패널 켜면 `POST /api/load/cpu`에 5 · 10 · 20 req/s(동시 8, 요청당 4초 타임아웃, 최대 300초, 탭 숨김 · 패널 닫기 · 초기화로 중지)** 추가(트래픽 분석기 입력).
- CPU 연산량 실측(로컬 Apple Silicon, Node 24): `light` 5.6ms · `medium` 11.4ms · `heavy` 17.0ms. t3.medium에서는 2~3배로 본다(가정 12). 20 req/s × heavy ≈ 파드당 0.3~1.0 코어, request 100m · HPA 70% 기준이면 파드 1개로도 확장 조건을 넘는다 — README의 "파드가 늘면 같은 전체 부하가 분산된다"와 일치.
- `SIGTERM` 처리: BE `app.close()`(→ `onClose`로 CPU Worker `terminate`) 후 종료, nginx 기본 동작.
- 테스트 5파일 14개: chaos 게이트 3, PGSSL 해석 3, **load 6**(플래그 해석 · 비활성 404 · 프리셋 · 큐 429 · close · 2초 데드라인 복구), 계측 제외 1, 통합(실제 진입 파일을 자식 프로세스로 띄워 `DATABASE_URL`을 닿지 않는 포트로 주고 메모리 폴백 + chaos + `/api/load/cpu` 검증) 1.

### 컨테이너화 점검 (App Chart 조건 + artifacts.md 규칙)
| 조건 | demo-app-be (`be/Dockerfile`) | demo-app-fe (`fe/Dockerfile`) |
|---|---|---|
| non-root 숫자 UID | `USER 1000` ✔. `worker_threads`는 권한 · 추가 capability 불필요 ✔ | `USER 101` ✔ |
| 읽기 전용 루트 FS | 디스크 쓰기 없음(pino → stdout, `fs` 쓰기 없음). CPU Worker는 `dist/load/cpu-worker.js`를 읽기만 하고 쓰기 경로 없음 ✔ | nginx-unprivileged가 pid · temp를 `/tmp`에 둠 → 차트 기본 `writablePaths: [/tmp]`(가정 1) ✔ |
| Worker 경로 해석 | `be/package.json`에 `"type"` 없음 + tsconfig `module: NodeNext` → **CJS 출력**. `dist/load/cpu-pool.js`가 `require(...)` · `__dirname` · `__filename`을 쓰고 `cpu-worker.js`가 같은 디렉터리에 있음(`pnpm build` 후 확인) ✔. ESM으로 바꾸면 `__dirname`이 깨진다(가정 13) | — |
| 다단계, 런타임에 패키지 매니저 없음 | 3단계. runner에서 npm · corepack · yarn 삭제 ✔ | 2단계. 런타임은 nginx만 ✔ |
| 런타임 환경변수를 굽지 않음 | `ENV NODE_ENV PORT HOST`는 기본값 수준, 비밀값 없음. `LOAD_TEST_ENABLED` · `CHAOS_ENABLED`는 이미지에 없고 값 파일로만 들어감 ✔ | 빌드 시 환경변수 없음 ✔ |
| lockfile 고정 | `--frozen-lockfile`만 사용 ✔ | 동일 ✔ |
| 베이스 이미지 보안 패치 | `apk upgrade --no-cache` ✔ | `apk upgrade --no-cache` 전체 ✔ |
| 교차 아키텍처 빌드 | deps 스테이지가 `$BUILDPLATFORM`에서 `pnpm install --prod` 후 복사. 운영 의존성 8개에 네이티브 모듈 없음 재확인(`pnpm ls --prod --depth Infinity`, 2026-10-11) ✔ (B-1 참고). T25는 Node 내장 모듈(`node:crypto` · `node:worker_threads`)만 쓴다 | builder만 `$BUILDPLATFORM`, 산출물은 정적 파일 ✔ |
| `.dockerignore` | `node_modules dist .git .env .env.* *.md Dockerfile .dockerignore` ✔ (`tests/`는 없지만 `src`만 COPY) | 동일 ✔ |
| 포트 계약 | `ENV PORT=8000` = `containerPort: 8000` = `service.port: 8000` = nginx `demo-app-be:8000` = previewAuth route 8000 ✔ | `EXPOSE 3000` = `listen 3000` = `containerPort: 3000` ✔ |
| 자원 | `requests: cpu 100m, memory 128Mi`, `limits: memory 256Mi`, **CPU limit 없음** → Worker가 코어 1개를 그대로 쓸 수 있다(C-4). Worker isolate 메모리(수십 MB)는 256Mi 안 | `50m / 32Mi / 64Mi` |
| Docker `HEALTHCHECK` | busybox `wget … /health`(k8s는 무시, compose 용) — 메모리 폴백이면 503이라 unhealthy로 보임. 의도와 일치 | 없음 |

## 데이터 저장소
- **PostgreSQL 17** 하나. 로컬은 `docker-compose.yml`(`postgres:17-alpine`, `db/init.sql`을 `/docker-entrypoint-initdb.d`에 마운트).
- 스키마: `db/init.sql` — `votes`, `guestbook` + 시드. Drizzle 스키마(`be/src/db/schema.ts`)는 같은 모양. `drizzle-kit`은 devDependency로만 있고 마이그레이션 산출물 · 스크립트 없음. **`db/init.sql`이 유일한 스키마 소스**(b8bc6d8 이후 변경 없음). T25는 DB를 쓰지 않는다.
- 배포 시 적용: `migration.enabled: true` + `secretName: demo-app-db` + deploy.yml `services[].migration: db/init.sql` → pre-install/pre-upgrade Job이 매 배포마다 실행. `CREATE TABLE IF NOT EXISTS`, votes `ON CONFLICT DO NOTHING`, guestbook `WHERE NOT EXISTS (SELECT 1 FROM guestbook)` — **전부 재실행 안전** ✔.
- 운영 DB(aws): **prod는 RDS Postgres 17 `db.t4g.micro` 20GB 단일 AZ**, **test는 온프레미스(맥북 k3d) Postgres를 tailnet(`db_link`, T32 · T33)으로** 쓴다. onprem은 환경마다 StatefulSet, gcp는 Cloud SQL(`modules/database/gcp`). 접속 정보는 service-base 차트가 Secret `demo-app-db`로 각 네임스페이스에 만든다. 앱은 어느 경우든 `DATABASE_URL` + `PGSSL`만 읽는다.
- TLS: `deploy/values-be.yaml env.PGSSL: require` → `sslOption()` → postgres.js `ssl: 'require'`(인증서 미검증). 세 대상 공통(onprem Postgres도 TLS 켜짐, 값 파일 주석).
- SQLite · 파일 저장 등 다중 인스턴스를 막는 저장소 없음.

## 상태
- **인메모리 폴백**(`memoryFallback`): 기동 시 연결 실패(connect_timeout 2s)면 투표 · 방명록을 프로세스 메모리로 처리. `/health`가 **503** + 본문 `fallback-memory`라 readiness · 승격 smoke(`/health expect 200` + `expect_body database: connected`)가 실패한다 → DB 장애가 숨지 않는다. 기동 실패 뒤 DB가 살아나면 `checkDbHealth` 성공 시 `db = drizzle(...)`를 만들어 저장 경로와 `/health`가 일치한다.
- **파드별 인메모리 싱글톤 3종** — aws는 파드 2~6개(HPA)라 **요청이 어느 파드에 가느냐에 따라 1/N에만 보인다**(plan.yaml 주석 · 트래픽 분석 "주의"):
  - `chaosState`: `dbError: true`면 데이터 라우트만 메모리로 떨어지고 readiness는 유지. 파드 재시작 · green 파드 · 새 HPA 파드는 초기 상태.
  - 대시보드 지표(`be/src/routes/metrics.ts`): 60초 창 버킷. `cpuPercent`는 Worker 포함 프로세스 CPU라 100%를 넘을 수 있다(T25에서 상한 제거).
  - **CPU Worker 풀(`CpuPool`)**: Worker 1개 + 큐 8. 파드마다 따로이므로 전체 동시 처리량은 8 × 파드 수.
- 업로드 · 세션 · 서버 캐시 없음. 브라우저 `localStorage`에 투표 여부(`demo_voted_option`)와 언어만 저장. CPU 부하 패널 상태는 React state(새로고침 시 초기화).
- 로그: stdout(pino level은 값 파일 `LOG_LEVEL: warn`; `[DB]` 기동 메시지는 `console.*`라 그대로 찍힌다). nginx 계측 로그는 `syslog:server=127.0.0.1:5531`(UDP)로 보내 수신 사이드카가 없어도 nginx는 멈추지 않는다.

## 환경변수
| 서비스 | 이름 | 출처 | 읽는 시점 |
|---|---|---|---|
| demo-app-be | `DATABASE_URL` | Secret `demo-app-db`(`envFromSecrets`). 코드 기본값은 로컬 compose 주소 | 실행 (기동 시 1회) |
| demo-app-be | `PGSSL` (또는 `PGSSLMODE`) | `env`(values-be.yaml `require`, gcp 값 파일도 `require`). 비움 · `disable`이면 TLS 없음, `allow`·`prefer`·`verify-full`은 그대로, 그 외는 `require` | 실행 (기동 시 1회) |
| demo-app-be | `PG_URL` | Secret `demo-app-db`에 있으나 **코드는 읽지 않음**(마이그레이션 Job만 사용, 해롭지 않음) | — |
| demo-app-be | `CHAOS_ENABLED` | `env`(**`deploy/values-be.test.yaml` `"true"` — test 전용**, T35). `true|1|yes|on`이면 `POST /api/chaos*` 등록. prod에는 값이 없어 404 | 실행 (라우트 등록 시) |
| demo-app-be | **`LOAD_TEST_ENABLED`** (T25) | `env`(**`deploy/values-be.yaml` `"true"` — test · prod 공통**). `true|1|yes|on`이면 `POST /api/load/cpu` 등록, 아니면 404(`GET /api/load/config.enabled: false`). 코드 기본값 꺼짐. `NODE_ENV`와 독립(README · 테스트가 명시). 끄려면 값 파일에서 `"false"` 후 재배포 | 실행 (라우트 등록 시, `loadEnabledFromEnv()`) |
| demo-app-be | `PORT` / `HOST` | Dockerfile `ENV PORT=8000 HOST=0.0.0.0`, 차트 `containerPort: 8000` 일치 | 실행 |
| demo-app-be | `APP_VERSION` | `env`(values-be.yaml HEAD `v2.1.0`, 작업 트리 `v2.1.1`). `v2` 접두면 FE 테마 전환 | 실행 (요청마다) |
| demo-app-be | `NODE_ENV` | Dockerfile `production`. `/api/info`의 `env`로 노출. 게이트 판단에는 쓰지 않음 | 실행 |
| demo-app-be | `LOG_LEVEL` | `env`(values-be.yaml `warn`). 기본 `info` | 실행 |
| demo-app-be | `HOSTNAME` / `POD_NAME` / `REGION` | 선택. k8s가 `HOSTNAME`을 파드 이름으로 넣음(`/api/info` · `/api/metrics` · **`/api/load/cpu` 응답**에 노출). `REGION` 기본 `ap-northeast-2`, gcp 값 파일 `asia-northeast3` | 실행 (요청마다) |
| demo-app-fe | `VITE_API_URL` | `vite.config.ts` 개발 서버 프록시 대상만. 번들 · 이미지에 들어가지 않음 | 개발 시 |
| demo-app-fe | BE 주소 | `fe/nginx.conf` `demo-app-be:8000` 고정 → k8s Service 이름 · `service.port`와 일치 | 이미지 빌드 시 (설정 파일) |
| demo-app-fe | `previewAuth.*` | 차트 값(values-fe.yaml): Cognito `issuerUrl` + Secrets Manager `remoteKey` + `routes`(aws). onprem · gcp는 `deploy/<대상>/values.yaml`의 `remoteKey`(k8s · Secret Manager 이름). 앱 코드가 읽는 값이 아니라 차트가 oauth2-proxy 구성에 쓴다(가정 6) | 배포 시 (차트) |

- `.env.example` 없음. `.gitignore`가 `.env*`를 막고 레포에 `.env` · `*.tfstate` 없음(`git status --ignored` 확인; 무시 항목은 `be/dist`, `fe/dist`, `fe/tsconfig.tsbuildinfo`, `node_modules`뿐).
- `be/src` 전체 `process.env` 사용처는 위 목록이 전부(`grep` 확인, 2026-10-11). README 환경변수 표와 일치(`LOAD_TEST_ENABLED` 행 포함).
- 비밀값은 DB 자격증명(Secret)뿐. `previewAuth.remoteKey`는 Secrets Manager **ARN**(계정 ID 포함)이고 값 자체는 아니다.
- FE `index.html`이 Pretendard 웹폰트를 `cdn.jsdelivr.net`에서 받는다(브라우저 → CDN, 변화 없음).

## 검사 명령 (checks.yml 입력)
- node-dirs: `["be", "fe"]` / python-dirs: `[]` / image-dirs: `["be", "fe"]` / db-init: `db/init.sql` / iac-path: `infra`
  - `.github/workflows/deploy.yml`이 정확히 이 값으로 `checks.yml@v2.17.0`을 호출한다(`template-ref: v2.17.0`).
- 이번 실행 결과 (Node 24.10.0 · pnpm 10.28.1, 2026-10-11, 커밋 55b1586. `pnpm install`은 이미 설치된 `node_modules`를 재사용했고 다시 돌리지 않았다):

| 디렉터리 | `pnpm install --frozen-lockfile` | `pnpm lint` | `pnpm test` | `pnpm build` |
|---|---|---|---|---|
| `be` | 재실행 안 함(lockfile 변경 없음, 직전 실행 ✔) | ✔ `tsc --noEmit` | ✔ **14/14 통과** (chaos 3 · db-ssl 3 · load 6 · metrics 1 · 통합 1, 1.67초) | ✔ `tsc` → `dist/load/cpu-pool.js` · `cpu-worker.js` 생성 확인 |
| `fe` | 재실행 안 함(동일) | ✔ `tsc --noEmit` | 스크립트 없음(checks가 요구하지 않음) | ✔ `tsc -b && vite build` (index 0.81KB · css 28.02KB · js 267.07KB, 31 modules, 0.94초) |

  - `pnpm test`에서 Node 24가 `cpu-worker.ts`를 Worker로 띄울 때 `MODULE_TYPELESS_PACKAGE_JSON` 경고(ESM으로 재해석)를 4번 찍는다. tsx 경로에서만 나오고 통과에 영향 없음. 운영 이미지는 컴파일된 CJS `.js`를 띄우므로 해당 없음(B-3).
  - ESLint는 없고 `lint`는 타입 검사다. checks의 Node 잡 통과 기준(`lint` · `build` 존재, lockfile 존재)은 충족.
- 빠진 스크립트 · lockfile: 없음.
- 그 외 잡: vuln-scan · image-scan(Trivy HIGH+) · iac-scan(`infra`) · secret-scan · license-scan · config-guard. `.trivyignore`는 AWS IaC 예외 3건(AWS-0040 · 0041 · 0104)만 있다. `.github/tests`(deploy-routing 회귀, `npm ci`)는 checks가 아니라 `deploy.yml`의 `request` 잡에서 돈다.

## 산출물 점검 (artifacts.md 규칙 대비)

`bash deploy-provision/scripts/check-artifacts.sh .` 실행 결과 — **✓ 산출물 검사 통과(0건)**. 직전 문서의 버전 불일치 12건은 템플릿 bump(#104 등)로 모두 해소됐다.

| 산출물 | 상태 | 비고 |
|---|---|---|
| `be/Dockerfile`, `be/.dockerignore` | ✔ | 위 표. T25 Worker 파일이 `dist/`로 함께 복사된다. `--platform=$BUILDPLATFORM`는 운영 의존성이 순수 JS인 동안 안전 |
| `fe/Dockerfile`, `fe/.dockerignore` | ✔ | 변화 없음 |
| `deploy/values-be.yaml` | ✔ | `containerPort` · `service.port` 8000, `replicas: 2` + HPA 2~6 · 70%, `requests 100m/128Mi` · `limits memory 256Mi`, `probe.path: /health`, `envFromSecrets: [demo-app-db]`, `migration`, `metrics.port: 8000`, `env: APP_VERSION · LOAD_TEST_ENABLED "true" · PGSSL require · LOG_LEVEL warn`. `image.tag: ""` ✔. **`LOAD_TEST_ENABLED`가 prod까지 켜지는 것은 T25의 의도("prod 지원")이지만 결정 항목 C-1** |
| `deploy/values-be.test.yaml` | ✔ | `env.CHAOS_ENABLED: "true"` test 전용(T35). prod에는 합쳐지지 않음 |
| `deploy/values-fe.yaml` | ✔ | `containerPort: 3000`, `replicas: 1`, `probe.path: /`, `ingress.enabled: true` · `healthcheckPath: /`, resources, `metrics.port: 4040` + `nginxLogExporter`(가정 6), `previewAuth`(issuer · remoteKey ARN · `routes /api/ → demo-app-be-preview:8000`) |
| `deploy/aws/values.yaml` · `deploy/onprem/values.yaml` · `deploy/gcp/values.yaml` | ✔ | aws 주석만(공통값 그대로); onprem `ingress.enabled: false` · `replicas: 1` · `autoscaling.enabled: false` · `previewAuth.remoteKey`; gcp NEG · gce Ingress · `PGSSL` · `REGION` · `previewAuth.remoteKey + ingress(managedCertificate, 고정 IP)` |
| `.deploy/smoke.json` | ✔ | BE 8개 · FE 2개 경로 모두 현재 코드에 존재. `/health` · `/api/info`는 `expect_body`로 DB 연결 전제. **`/api/load/config`는 smoke에 없다** — 추가는 선택(B-4). `GET /api/chaos`는 게이트와 무관하게 200 |
| `.deploy/plan.yaml` | ✔ | `target: aws`로 브리프와 일치. `services` 포트 · health · migration · resources · `replicas {default 2, aws 2, onprem 1}` · `autoscaling {min 2, max 6, cpu 70}` · `nodes.aws t3.medium 3~5`가 값 파일 · 코드와 일치 |
| `.github/workflows/deploy.yml` 호출부 | ✔ 입력 일치 | `services` JSON = plan.yaml, 검사 입력 위 참조, 대상 matrix는 `deploy-targets.sh`(기본 aws), `preview-host` · `preview-auth` 대상 · 환경별, `chart-version: 2.17.0` |
| **버전 표기** | ✔ | `config.yaml template_version: v2.17.0` = 워크플로 `@v2.17.0`(approval-timeout만 `@v2` 유동 태그) = `chart-version 2.17.0` = onprem tf `?ref=v2.17.0`. aws 모듈 `v2.11.0` · gcp `v1.16.2`는 `infra_versions`로 의도 고정(check-artifacts가 허용). `preview_auth` · `db_link`만 `v2.17.0`. `.deploy/config.yaml`은 CODEOWNERS 보호 파일이라 yolo 경로가 고칠 수 없고 지금은 고칠 것도 없다 |

## 필요한 코드 수정
### (a) 배포에 필요
- **없음.** 검사 명령(lint · test 14 · build × 2)이 모두 통과하고, T25의 Worker는 읽기 전용 FS · 숫자 UID · CJS `__dirname` 조건을 충족하며, check-artifacts 0건이다.

### (b) 권장 — 운영 정합성 · 품질
- **B-1. 교차 아키텍처 빌드 가드** (`be/Dockerfile`): deps 스테이지가 `$BUILDPLATFORM`에서 설치한 `node_modules`를 타깃 이미지에 복사한다. 운영 의존성 8개가 모두 순수 JS(T25도 Node 내장 모듈만)라 문제없지만, 네이티브 prod 의존성(예: `sharp`, `bcrypt`)이 들어오면 amd64 러너 → arm64 노드에서 기동 실패한다. 네이티브 의존성이 추가될 때 deps 스테이지의 `--platform`을 지우는 규칙을 README에 한 줄 적는 것을 권한다(변화 없음).
- **B-2. `PG_URL` 정리**: Secret에 `PG_URL`(sslmode 포함)이 있지만 코드는 `DATABASE_URL` + `PGSSL`만 읽는다. 동작은 맞으므로 코드 변경은 불필요하고, README 환경변수 표에 "`PG_URL`은 마이그레이션 Job만 사용"을 적어 혼동을 줄인다(변화 없음).
- **B-3. Worker 모듈 형식 고정** (`be/src/load/cpu-pool.ts`): Worker 경로를 `join(__dirname, 'cpu-worker' + extname(__filename))`로 만들어 CJS 전제가 코드에 박혀 있다. 지금은 `package.json`에 `"type"`이 없어 CJS로 컴파일되므로 맞지만, 누군가 `"type": "module"`을 넣으면(Node 24 테스트 경고가 바로 그렇게 권한다) `__dirname`이 사라져 `/api/load/cpu`가 503(`CPU worker failed`)으로 떨어진다. 주석 한 줄("CJS 전제, ESM 전환 시 `import.meta.url`로")이나 `fileURLToPath(new URL('./cpu-worker.js', import.meta.url))`로 양쪽에서 도는 형태를 권한다. 테스트 경고 자체는 무해하다.
- **B-4. smoke에 `/api/load/config` 추가** (`.deploy/smoke.json`, provision 몫): `GET /api/load/config expect 200`을 넣으면 T25 라우트 등록까지 승격 전에 확인된다. `expect_body {enabled: true}`까지 걸면 C-1 결정(test 전용화)과 충돌하므로 상태 코드만 권한다.

### (c) 동작을 바꾸는 것 — 사람이 결정
- **C-1. prod의 `LOAD_TEST_ENABLED`** (신규): `deploy/values-be.yaml`이 test · prod 공통이라 prod에서도 인증 없는 `POST /api/load/cpu`가 FE 공개 주소(`/api/` 프록시)로 열린다. 요청당 연산이 고정 프리셋(≤ `heavy` 30,000 sha256, 실측 ≤ ~50ms)이고 파드당 동시 8개 · 2초 데드라인이 있어 단일 요청으로 파드를 멈출 수는 없지만, 방문자 누구나 HPA를 최대(6 파드)까지 밀고 Cluster Autoscaler(최대 5 노드)까지 올릴 수 있어 **비용과 CPU 경합(C-4)이 외부 입력에 좌우된다.** README는 이를 알고 있고("다른 방문자도 요청할 수 있다"), T25 커밋 메시지는 prod 지원을 의도로 적었다. 선택지: ① T35처럼 `deploy/values-be.test.yaml`로 옮겨 test에서만 켠다(코드 변경 없음, prod HPA 시연은 불가) ② 현재 유지(시연 기간) 후 `"false"` 커밋 ③ 유지하되 prod에서는 ALB · oauth2-proxy 뒤로 둔다(차트 기능 미확인). 민감 데이터 `예` 브리프라 보안 분석기 · 예산 분석기 판단 대상.
- **C-2. 인메모리 폴백의 데이터 라우트**: `/health` 503 + `expect_body`로 readiness · 승격에는 드러나지만, 파드가 Service에서 빠지기 전 짧은 창과 `dbError` 주입 중에는 여전히 메모리에 쓴 데이터가 사라진다. 파드 2개 이상이면 폴백 파드와 정상 파드가 섞여 응답이 파드마다 다를 수 있다. 시연 안전망으로 유지할지(README 명시) 운영에서 503으로 바꿀지는 결정 사항.
- **C-3. 민감 데이터 관점의 입력 처리**: 방명록은 이름 50자 · 메시지 500자 trim 외에 검증 · 레이트리밋 · CORS 제한(`origin: true`)이 없다(변화 없음). `/api/load/cpu`는 스키마 검증 · 큐 제한이 있어 입력 자체는 안전하다.
- **C-4. BE CPU limit 부재** (신규, T25 · T29 결합): `resources.limits`에 CPU가 없어 Worker가 노드 코어 1개를 통째로 쓸 수 있고, 6 파드가 t3.medium(2 vCPU) 3대에 몰리면 FE · 시스템 파드와 경합한다. CPU limit(예: `500m`)을 두면 경합은 막지만 쓰로틀링으로 응답 시간이 늘고 HPA 비율(request 기준)은 그대로다. 부하 측정 후 조정한다는 값 파일 주석대로 사람이 정한다.

## 확인 못 한 것
- App Chart 2.17.0 본문(프로브 timeout · liveness 경로 · `previewAuth`가 만드는 리소스 · `routes` 처리 · `metrics.nginxLogExporter`가 여는 포트 · 값 파일 합치기 순서)은 이 레포에 없다. `probe.path: /health`가 liveness에도 쓰인다면 메모리 폴백 503이 재시작 루프를 만든다 — readiness 전용이라고 가정(가정 7).
- Secret `demo-app-db`의 `DATABASE_URL` 실제 형식(sslmode 유무)은 platform service-base 차트를 열지 않아 미확인. `PGSSL: require`가 명시 옵션이라 어느 쪽이든 TLS로 붙는다(가정 4).
- 검사는 로컬 Node 24.10으로 돌렸다. checks.yml은 Node 22(가정 2)로 추정되며 tsconfig `target: ES2022`라 차이 요소는 없지만 같은 버전으로 재실행하지는 않았다. docker 빌드 · 멀티 아키텍처 빌드 · 컨테이너 안에서의 Worker 기동도 이 실행에서 돌리지 않았다(CJS 출력과 파일 존재만 확인).
- CPU 프리셋 실측은 Apple Silicon 값이다. t3.medium(x86, 버스트 크레딧) 실측은 없다(가정 12).
- `nginxinc/nginx-unprivileged`가 `/tmp` 밖에 쓰는지는 이미지 소스가 레포에 없어 확인 못 함(가정 1).
- `fe/src/App.tsx`(1,025줄) · `i18n.ts`(411줄) · `CpuLoadPanel.tsx`는 API 호출부 · 저장소 사용 · 환경변수 · 요청 빈도만 읽었다. UI 세부는 보지 않았다.
- aws test DB가 온프레미스로 간 뒤 `db/init.sql` 마이그레이션 Job이 tailnet 통로로 실제 성공하는지는 파이프라인 로그 몫(fc9c587이 NetworkPolicy를 고쳤다).

## 가정
1. **FE 쓰기 경로 = `/tmp`만**: `nginxinc/nginx-unprivileged`는 pid와 `*_temp_path`를 `/tmp`로 두는 이미지이고 `fe/Dockerfile` 주석도 같은 전제. 차트 기본 `writablePaths: [/tmp]`로 충분하다고 본다.
2. **Node 런타임 22**: `.nvmrc` · `engines` 없음. 두 Dockerfile의 `node:22-alpine`을 기준으로 잡았다. `worker_threads` · `performance.now()` · `createHash`는 Node 22에서 모두 안정 API다.
3. **서비스 포트 계약**: BE Service 8000은 FE nginx의 `demo-app-be:8000` 하드코딩에 맞춘 것이며, 두 서비스가 같은 네임스페이스에 뜬다(deploy.yml이 같은 `namespace`로 올린다).
4. **DB Secret 키 형식**: `DATABASE_URL`은 host · 자격증명 · DB명을 담고 sslmode는 없거나 `require`. 둘 중 어느 경우든 `PGSSL: require` 명시 옵션이 적용되므로 결과는 같다. `PG_URL`은 마이그레이션 Job(`psql "$PG_URL"`)만 쓴다고 본다.
5. **마이그레이션 = `db/init.sql` 재실행**: Drizzle 마이그레이션 산출물이 없으므로 향후 스키마 변경도 `init.sql`에 idempotent SQL을 덧붙이는 방식으로 간다.
6. **차트 기능 추정**: `metrics.nginxLogExporter`는 `127.0.0.1:5531` syslog를 받아 `4040`으로 노출하는 사이드카, `previewAuth`는 `preview-host`에 oauth2-proxy(Cognito OIDC)를 두고 `routes`로 `/api/`를 green BE에 보내는 차트 기능이라고 본다. 둘 다 앱 코드와 이미지에는 닿지 않는다.
7. **`probe.path`는 readiness 전용**: `/health` 503이 readiness만 떨어뜨리고 liveness(`/healthz/liveness`는 별도 경로)는 차트가 따로 쓴다고 본다. 틀리면 메모리 폴백이 재시작 루프가 된다.
8. **AWS 우선**: 브리프 선호 대상이 AWS라 "외부 노출" · Ingress · TLS · 미리보기 · DB 판단은 aws(ALB Ingress, RDS/tailnet, Cognito) 기준이고 onprem · gcp 차이는 병기했다. plan.yaml · deploy-targets.sh 기본 대상도 aws다.
9. **장애 주입 · 인메모리 폴백 · CPU 부하 API는 시연 의도**: README · PR #44 · #52 · #106이 명시하므로 "버그"가 아니라 결정 항목(c)으로 분류했다.
10. **aws는 파드 2~6개**: `replicas: 2` + HPA라 파드별 인메모리 상태(`chaosState` · `/api/metrics` 버킷 · CPU Worker 큐)는 요청이 닿은 파드의 값이다. onprem은 1개.
11. **운영 의존성은 순수 JS 유지**: `--platform=$BUILDPLATFORM` deps 스테이지는 이 전제 위에서만 안전하다(`pnpm ls --prod` 확인, 2026-10-11).
12. **t3.medium CPU 프리셋 소요는 로컬 실측의 2~3배**: x86 t3 버스트 인스턴스 기준 추정이며, `heavy`도 2초 데드라인(`CpuPool` 기본 `timeoutMs 2000`) 안에 끝난다고 본다.
13. **BE는 CJS로 유지**: `be/package.json`에 `"type"`이 없고 `tsc`가 CJS를 내므로 `cpu-pool.ts`의 `__dirname` · `__filename`이 유효하다. ESM 전환은 B-3을 먼저 적용해야 한다.
