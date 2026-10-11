# 코드베이스 분석

분석일: 2026-10-11 (yolo 델타 재검증, 기준 커밋 b8bc6d8 → 현재 HEAD **142633a**)
직전 분석: 2026-10-10 yolo 재검증(기준 b8bc6d8). 이번 실행은 전체 재작성이 아니라 `git log --oneline b8bc6d8..HEAD`(44 커밋, 93 파일, +11,856/−1,799 — 그중 `.deploy/analysis/**` 산출물이 대부분)와 바뀐 파일을 현재 코드로 다시 검증한 **델타 재검증**이다. 바뀌지 않은 결론은 직전 문서를 그대로 유지하고 "변화 없음"으로 적었다.
브리프: 하루 100명 이하 · 월 10만 원 이하 · 민감 데이터 **예**(`regulated`) · 선호 대상 **AWS** · 가용성 **시연용** (변화 없음).
워크트리 상태: 브랜치 `yolo/html-footer-note` = origin/main 142633a. 커밋되지 않은 변경은 `fe/index.html`에 `<meta name="description">` 한 줄뿐(이번 yolo 실행의 변경, 정적 자원 · 서버 계약 무관).
레포는 배포 산출물(Dockerfile · `deploy/` 값 파일 · `infra/envs/{aws,gcp,onprem}` · 워크플로 · `.deploy/smoke.json`)을 이미 갖고 있고, 이 분석은 산출물이 현재 코드와 App Chart 조건, `deploy-provision/references/artifacts.md` 규칙에 맞는지까지 본다.

## 이전 분석(b8bc6d8) 이후 바뀐 것

| 커밋 · PR | 코드 · 산출물 변화 | 이 분석에 미치는 영향 |
|---|---|---|
| **#103 (T25) Pod 카드 → Kubernetes 조회 API** | FE: `fe/src/RuntimePods.tsx`(113줄) · `fe/src/runtime.ts`(71줄, 응답 스키마 검증 `parseRuntimeSnapshot`) 추가, `App.tsx`에서 `/api/metrics` 기반 파드 목록(`pods` 상태 · `Meter` · `POD_TTL_MS`) 제거 → 파드 카드는 **`GET /api/runtime`** 5초 폴링. `fe/nginx.conf`를 **템플릿**(`/etc/nginx/templates/default.conf.template`)으로 바꾸고 `location = /api/runtime`을 `runtime-status.${POD_NAMESPACE}.svc.cluster.local:8080`으로 프록시(요청 시 DNS 해석 `resolver ${RUNTIME_DNS_RESOLVER} valid=10s`). `fe/docker-entrypoint.d/19-runtime-dns.sh`가 기동 시 `/etc/resolv.conf`의 nameserver와 `POD_NAMESPACE`(기본 `default`)를 envsubst해 `/tmp/runtime-default.conf` · `/tmp/runtime-nginx.conf`를 만들고, `fe/Dockerfile`의 `CMD`가 `nginx -c /tmp/runtime-nginx.conf`로 바뀜. `ENV NGINX_ENVSUBST_TEMPLATE_DIR=/tmp/no-templates`로 베이스 이미지의 envsubst 스크립트(쓰기 불가 `/etc/nginx/conf.d` 대상)를 무력화. `deploy/values-fe.yaml podNamespaceEnv: true`, `deploy/values-runtime-status.yaml`(`serviceName: demo-app-be`), `.deploy/config.yaml runtime_status_values`, `.github/workflows/runtime-status.yml`(fe `pnpm test` + 이미지 빌드 + `--read-only --tmpfs /tmp`에서 `nginx -t`), `fe/package.json`에 `test` 스크립트 · devDependency `tsx 4.19.3`, `fe/tests/runtime.test.tsx`(6건), `vite.config.ts`에 `/api/runtime` 개발 프록시(`VITE_RUNTIME_API_URL`, 기본 `:8080`), `docs/runtime-status.md`. BE: `be/src/routes/metrics.ts` `cpuPercent`의 `Math.min(100, …)` 상한 제거(워커 스레드 포함 시 100% 초과 가능) | **FE 컨테이너 계약 변화**: 쓰기 경로가 여전히 `/tmp`뿐이라 `writablePaths` 기본값으로 충분(아래 컨테이너화 점검). FE가 **플랫폼이 설치하는 제3의 서비스(`runtime-status`, 포트 8080, 네임스페이스별)**에 런타임 의존한다. 그 서비스가 없거나 죽어도 nginx 기동 · `/` · `/api/` 프록시는 영향 없고 파드 카드만 "조회 불가"로 표시된다(요청 시 DNS 해석 + FE `catch`). `/api/metrics`는 트래픽 차트용으로 계속 쓴다. **FE에도 `pnpm test`가 생겨** checks의 Node 잡 입력(`lint` · `build`)은 그대로지만 테스트 실행 대상이 늘었다 |
| **#106 · a76a982 · 15b7eb1 (T25) CPU 부하 테스트** | BE: `be/src/routes/load.ts`(`GET /api/load/config` 항상 등록, `POST /api/load/cpu`는 `LOAD_TEST_ENABLED` truthy일 때만 등록, 본문 스키마 `intensity ∈ {light 5000, medium 15000, heavy 30000}` sha256 반복), `be/src/load/cpu-pool.ts`(파드당 **Worker Thread 1개** 재사용, 실행+대기 합 8개 초과 시 **429**, 작업당 2초 데드라인 초과 시 워커 종료 · **503**), `be/src/load/cpu-worker.ts`. `be/src/index.ts` preHandler 장애 주입 제외 목록에 `/api/load/` 추가, `loadRoutes` 등록. `deploy/values-be.yaml env.LOAD_TEST_ENABLED: "true"`(test · prod **공통**), `APP_VERSION: v2.1.0`. 테스트 `be/tests/load.test.ts`(6건) + 통합 테스트에 `LOAD_TEST_ENABLED=true · NODE_ENV=production`으로 `/api/load/cpu` 200 검증. FE: `fe/src/CpuLoadPanel.tsx`(5/10/20 RPS · 강도 · 1/3/5분, 동시 요청 8개 상한, 탭 숨김 시 정지), README API 표 · 환경변수 표 · "CPU 오토스케일 테스트" 절 | BE 라우트 2개 · 환경변수 1개 추가. `__dirname`/`__filename`을 쓰므로 CJS 출력이 전제인데 `be/tsconfig.json module: NodeNext` + `package.json`에 `"type": "module"` 없음 → CJS로 컴파일돼 `dist/load/cpu-worker.js`를 찾는다(로컬 `pnpm build` · docker build 통과로 확인). 새 네이티브 의존성 없음(`be/pnpm-lock.yaml` 변경 없음, `node:worker_threads` · `node:crypto`는 코어) → B-1 전제 유지. **인증 없는 CPU 소모 API가 prod에도 열린다**(C-1) |
| **#88 (T17) BE test liveness** | `deploy/values-be.test.yaml`에 `probe.livenessPath: /healthz/liveness` 추가(주석: "DB 불통은 readiness(/health)만 내린다. 정상 BE를 kubelet이 반복 재시작하지 않는다 (#211)") | 직전 가정 7("`probe.path`는 readiness 전용")이 **틀렸음이 드러남**: 차트 기본은 `probe.path`를 liveness에도 쓴다고 읽힌다. test는 이 파일로 분리됐지만 **prod는 여전히 `/health`(DB 의존)가 liveness** → RDS 불통 시 prod BE가 재시작 루프(C-2) |
| **#79 (T29) BE HPA** · #107~#110 (T39) | `deploy/values-be.yaml replicas: 2` + `autoscaling {enabled, min 2, max 6, cpu 70%}` + `resources`를 공통 값으로 이동, `deploy/aws/values.yaml`의 `replicas: 1` 삭제, `deploy/onprem/values.yaml autoscaling.enabled: false`. `.deploy/plan.yaml` replicas/autoscaling/`nodes.aws` 갱신. `deploy.yml`이 `DEPLOY_TARGETS` matrix(`.github/scripts/deploy-targets.sh`, `.github/tests/deploy-routing.test.cjs`를 `request` 잡에서 `npm ci && npm test`) | 파드별 인메모리 상태(`chaosState` · `/api/metrics` 버킷 · 메모리 폴백 · CPU 워커 큐)가 **파드 ≥ 2에서 1/N에만 걸린다**(직전 가정 10 "replica 1" 철회). FE 트래픽 차트는 `podSeries`로 파드별 합산하므로 다중 파드를 이미 처리한다. `.github/tests`는 npm(package-lock) 기반의 워크플로 전용 테스트이며 checks `node-dirs` 대상이 아니다 |
| **#74 (T35) CHAOS_ENABLED 분리** · #66 (T28) smoke | `CHAOS_ENABLED: "true"`를 `deploy/values-be.yaml`에서 지우고 `deploy/values-be.test.yaml`에만 둠. `.deploy/smoke.json` `/health`에 `expect_body {database: connected}`, `/api/info`에 `{dbConnected: true}` | 직전 **C-1(prod의 `/api/chaos`) 해결** — prod는 `POST /api/chaos*`가 404. smoke가 메모리 폴백을 본문으로도 잡는다 |
| **#104 템플릿 v2.17.0** (그 사이 v2.4.0 → … → v2.14.0) · #63 · #72 · #83 · #94 | `.deploy/config.yaml template_version: v2.17.0`, `infra_versions {aws: v2.11.0, gcp: v1.16.2}`, 워크플로 전부 `@v2.17.0` · `template-ref: v2.17.0` · `chart-version: 2.17.0`, `slack-notify@v2.17.0`, onprem tf `?ref=v2.17.0`, aws `preview_auth` · `db_link` `?ref=v2.17.0`(나머지 aws 모듈 v2.11.0, gcp v1.16.2) | **직전 check-artifacts 12건(버전 표기 네 갈래)이 모두 해소** — 오늘 `check-artifacts.sh .` **통과(문제 0건)**. 직전 B-3 종료. `.deploy/config.yaml`은 여전히 CODEOWNERS 보호 파일이며 `runtime_status_values` · `infra_versions`는 규칙 밖 추가 키(사람 PR로 들어감, config-guard 통과 전제) |
| T38 (#97 · #98 · #101) · T31 · T33 (#69 · #81 · #90) · T17 관측 | gcp · onprem `previewAuth.remoteKey`(FE 전용 green 미리보기), `values-fe.yaml previewAuth.routes`(`/api/` → `demo-app-be-preview:8000`, 차트 ≥ v2.4.0), aws `db_link`(test 네임스페이스 DB를 온프레미스 Postgres로 tailnet 연결, NetworkPolicy는 BE 파드 + 마이그레이션 Job만 허용), infra 루트 다수 | 앱 코드 · 이미지에 닿지 않는다. 데이터 저장소 절에 test DB 위치만 반영 |
| 887828e (yolo) · 워크트리 미커밋 | `fe/index.html` `<title>` 변경(커밋됨), `<meta description>` 추가(미커밋) | 정적 자원. 서버 계약 무관 |

직전 문서의 **정정 2건**: (1) 가정 7 — 차트는 `probe.path`를 liveness에도 쓴다(위 #88). (2) 가정 10 — aws BE는 replica 2 + HPA다.

## 서비스
| 이름 | 경로 | 스택 | 실행 명령 | 포트 | 헬스체크 | Dockerfile | 외부 노출 |
|---|---|---|---|---|---|---|---|
| demo-app-be | `be/` | Node 22(alpine) · TypeScript 5.9 · Fastify 5 · Drizzle ORM 0.45 · postgres.js 3.4 · `@prometheus-io/client` 0.16.1 · pino · `node:worker_threads`(CPU 부하 워커) · pnpm 10.28.1 | 빌드 `pnpm build`(tsc, CJS) → 실행 `node dist/index.js` | 8000 (`PORT` 기본 8000, `HOST` 0.0.0.0) | `GET /health`: DB 연결 시 200 `{database: connected}`, 메모리 폴백이면 **503** `{status: degraded, database: fallback-memory}`. `GET /healthz/liveness` 항상 200. 값 파일: `probe.path: /health`, test만 `probe.livenessPath: /healthz/liveness` | 있음 (3단계, `USER 1000`, builder · deps `--platform=$BUILDPLATFORM`, 변화 없음) | 아니오. FE nginx가 클러스터 안에서 `http://demo-app-be:8000`으로 `/api/`, `/health`를 프록시 |
| demo-app-fe | `fe/` | Node 22 빌드 → `nginxinc/nginx-unprivileged:alpine`(UID 101) 정적 서빙 + 프록시 · Vite 6.4 · React 19 · Tailwind 4 · lucide-react · pnpm 10.28.1 | 빌드 `pnpm build`(`tsc -b && vite build`) → 엔트리포인트 `19-runtime-dns.sh`가 `/tmp`에 설정 렌더 → `nginx -c /tmp/runtime-nginx.conf -g 'daemon off;'` | 3000 (`listen 3000`) | 없음(정적). 값 파일 `probe.path: /`, `ingress.healthcheckPath: /` | 있음 (2단계, `USER 101`, builder `--platform=$BUILDPLATFORM`, **CMD · 템플릿 · 엔트리포인트 변경**) | 예. aws는 ALB Ingress + green 미리보기 호스트(previewAuth), onprem은 Quick Tunnel → Service |

- 워커 · 크론 · 큐 소비자 없음. 이 레포의 서비스는 **2개**(변화 없음). 단, FE가 **플랫폼이 네임스페이스마다 설치하는 `runtime-status`(Service `runtime-status`, 포트 8080, `.deploy/config.yaml runtime_status_values` → `deploy/values-runtime-status.yaml serviceName: demo-app-be`)**에 런타임 의존한다. 이 레포에 코드 · 이미지가 없으므로 `plan.yaml services`에는 넣지 않는다(가정 6).
- FE → BE 호출은 전부 상대 경로(`App.tsx` 10곳 + `RuntimePods.tsx` `/api/runtime` + `CpuLoadPanel.tsx` `/api/load/config` · `/api/load/cpu`)라 번들에 BE 주소 · 환경변수가 없다.
- BE 라우트: `/health`, `/healthz/liveness`, `/metrics`, `/api/info`, `/api/metrics`, `/api/votes`, `POST /api/votes/:id`, `/api/guestbook`, `POST /api/guestbook`, `GET /api/chaos`(항상), `POST /api/chaos` · `POST /api/chaos/reset`(`CHAOS_ENABLED`), **`GET /api/load/config`(항상), `POST /api/load/cpu`(`LOAD_TEST_ENABLED`)**. README API 표와 일치.
- FE nginx 경로: `location = /api/runtime`(정확 일치, `runtime-status.<ns>:8080`) > `location /api/`(`demo-app-be:8000`) > `location /health`(`demo-app-be:8000`) > `/`(SPA fallback). `/metrics`(Prometheus)는 여전히 FE 공개 주소에서 열리지 않는다.
- `preHandler` 장애 주입 훅 제외: `/metrics`, `/health`, `/healthz/*`, `/api/chaos*`, `/api/metrics*`, **`/api/load/*`**. 지연 · 에러율은 `/api/info` · `/api/votes*` · `/api/guestbook*`에만 걸린다.
- FE 브라우저 한 탭당 `/api/info` 1 req/s + `/api/metrics` 1 req/s + **`/api/runtime` 0.2 req/s**(상시), 부하 생성기 켜면 `/api/votes` 최대 60 req/s, **CPU 부하 패널 켜면 `/api/load/cpu` 최대 20 req/s**(동시 8개 상한, 최대 5분) 추가(트래픽 분석기 입력).
- `SIGTERM`: BE `app.close()` → `onClose`에서 CPU 워커 풀 `close()`(대기 작업 503으로 거절, 워커 terminate) 후 종료. nginx 기본 동작.
- 테스트: BE 5파일(chaos 3 · db-ssl 3 · metrics 1 · **load 6** · 통합 1, 통합은 `LOAD_TEST_ENABLED=true`로 `/api/load/cpu`까지 검증), FE 1파일(`runtime.test.tsx` 6건, `renderToStaticMarkup`로 파드 카드 렌더 · 스키마 거부 검증).

### 컨테이너화 점검 (App Chart 조건 + artifacts.md 규칙)
| 조건 | demo-app-be (`be/Dockerfile`, 변화 없음) | demo-app-fe (`fe/Dockerfile`, 변경) |
|---|---|---|
| non-root 숫자 UID | `USER 1000` ✔ | `USER 101` ✔ (`apk upgrade`를 위해 잠시 root 후 복귀) |
| 읽기 전용 루트 FS | 디스크 쓰기 없음(워커 스레드도 메모리만) ✔ | 기동 시 `19-runtime-dns.sh`가 **`/tmp/runtime-default.conf` · `/tmp/runtime-nginx.conf`만** 쓴다. 베이스 이미지 envsubst 스크립트는 `NGINX_ENVSUBST_TEMPLATE_DIR=/tmp/no-templates`(없는 디렉터리)라 바로 return. pid · temp는 비특권 이미지 기본 `/tmp`. → 차트 기본 `writablePaths: [/tmp]`로 충분(가정 1). `.github/workflows/runtime-status.yml`이 `--read-only --tmpfs /tmp`에서 `nginx -t`까지 검증 ✔ |
| 다단계, 런타임에 패키지 매니저 없음 | 3단계, runner에서 npm · corepack · yarn 삭제 ✔ | 2단계, 런타임은 nginx + envsubst(베이스 내장) ✔ |
| 런타임 환경변수를 굽지 않음 | `ENV NODE_ENV PORT HOST` 기본값 수준 ✔ | 빌드 시 환경변수 없음. `POD_NAMESPACE` · DNS resolver는 **기동 시** 읽는다 ✔ |
| lockfile 고정 | `--frozen-lockfile` ✔ | 동일 ✔ (`fe/pnpm-lock.yaml`에 tsx 4.19.3 추가 반영) |
| 베이스 이미지 보안 패치 | `apk upgrade --no-cache` ✔ | `apk upgrade --no-cache` ✔ |
| 교차 아키텍처 빌드 | deps 스테이지 `$BUILDPLATFORM` 설치 후 복사. 운영 의존성 변동 없음(lockfile 동일) ✔ (B-1) | builder만 `$BUILDPLATFORM`, 산출물은 정적 파일 + 셸 스크립트 ✔. `COPY --chmod=755`는 BuildKit 필요(GH buildx · 로컬 모두 통과) |
| `.dockerignore` | `node_modules dist .git .env .env.* *.md Dockerfile .dockerignore` ✔ | 동일 ✔ (`tests/`는 목록에 없지만 COPY 대상이 `src` · 설정 파일 · `docker-entrypoint.d/19-runtime-dns.sh`뿐) |
| 포트 계약 | `ENV PORT=8000` = `containerPort: 8000` = `service.port: 8000` = nginx `demo-app-be:8000` = plan.yaml `port: 8000` ✔ | `EXPOSE 3000` = `listen 3000` = `containerPort: 3000` = plan.yaml `port: 3000` ✔ |
| 기동 순서 의존 | 없음(DB 불통은 메모리 폴백 + `/health` 503) | `runtime-status` 부재 시에도 기동 · `nginx -t` 통과(요청 시 DNS 해석). `POD_NAMESPACE` 미주입 시 `default`로 렌더돼 `/api/runtime`만 502 |
| Docker `HEALTHCHECK` | busybox `wget … /health`(k8s는 무시) | 없음 |

## 데이터 저장소
- **PostgreSQL 17** 하나(변화 없음). 로컬은 `docker-compose.yml`(`postgres:17-alpine`, `db/init.sql` 마운트).
- 스키마: `db/init.sql` — `votes`, `guestbook` + 시드. **b8bc6d8 이후 `db/` · `be/src/db/` 변경 없음.** Drizzle 마이그레이션 산출물 없음, `db/init.sql`이 유일한 스키마 소스. 재실행 안전(`IF NOT EXISTS` · `ON CONFLICT DO NOTHING` · `WHERE NOT EXISTS`) ✔.
- 배포 시 적용: `migration.enabled: true` + `secretName: demo-app-db` + deploy.yml `services[].migration: db/init.sql` → pre-install/pre-upgrade Job 매 배포(변화 없음). aws test는 NetworkPolicy가 마이그레이션 Job 파드(`batch.kubernetes.io/job-name=demo-app-be-migration`)도 허용(#90).
- 운영 DB 위치(aws 기준): **prod = RDS Postgres 17**(`db.t4g.micro`, 단일 AZ), **test = 온프레미스(맥북 k3d) Postgres를 Tailscale `db_link`로 연결**(T33, `infra/envs/aws/main.tf module "db_link"`, Secret `demo-app-db-onprem`). 직전 문서의 "test · prod가 같은 RDS"는 더 이상 맞지 않는다. onprem 대상은 환경마다 StatefulSet. 접속 정보는 service-base 차트가 Secret `demo-app-db`로 만든다(가정 4).
- TLS: `env.PGSSL: require` → postgres.js `ssl: 'require'`(변화 없음). CPU 부하 API는 DB를 쓰지 않는다.
- SQLite · 파일 저장 등 다중 인스턴스를 막는 저장소 없음.

## 상태
- **파드별 인메모리 상태가 늘었고, 파드 수가 2 이상**(aws replica 2 + HPA 2~6)이라 다음은 모두 **1/N 파드에만** 존재한다: `chaosState`(장애 주입), `/api/metrics` 60초 버킷, 메모리 폴백 데이터, **CPU 워커 큐(8개)**. FE는 `/api/metrics`를 파드별로 합산하고 파드 카드는 `/api/runtime`(Kubernetes 목록)으로 보므로 화면은 다중 파드를 처리한다. 장애 주입 `POST /api/chaos`는 Service 라운드로빈으로 한 파드에만 도달한다(트래픽 분석 "주의").
- **인메모리 폴백**(`memoryFallback`, 변화 없음): 기동 시 연결 실패면 투표 · 방명록을 메모리로. `/health` 503 → readiness · smoke(`expect_body database: connected`)가 잡는다. test는 liveness가 `/healthz/liveness`라 재시작하지 않고 Service에서만 빠진다. **prod는 liveness도 `/health`**로 추정돼 재시작 루프(C-2).
- **CPU 부하 상태**: 파드당 Worker Thread 1개(지연 생성, 2초 데드라인 초과 시 terminate 후 다음 요청에서 재생성). 작업 결과 외 영속 상태 없음. 브라우저가 RPS · 시간 제한을 가지며 서버 전체 상한은 파드당 큐 8개뿐.
- **대시보드 지표**(`be/src/routes/metrics.ts`): `cpuPercent`가 100%를 넘을 수 있다(워커 스레드 포함). FE는 더 이상 이 값을 파드 카드에 쓰지 않는다.
- 업로드 · 세션 · 서버 캐시 없음. 브라우저 `localStorage`에 투표 여부 · 언어만(변화 없음).
- 로그: BE stdout(`LOG_LEVEL: warn`). nginx 계측 로그는 `syslog:server=127.0.0.1:5531`(UDP) — `/api/runtime` 응답도 `metrics` 로그에 잡힌다(`$record_metrics` 제외 목록은 kube-probe · ELB · GoogleHC · smoke UA뿐).

## 환경변수
| 서비스 | 이름 | 출처 | 읽는 시점 |
|---|---|---|---|
| demo-app-be | `DATABASE_URL` | Secret `demo-app-db`(`envFromSecrets`). 코드 기본값은 로컬 compose 주소 | 실행 (기동 시 1회) |
| demo-app-be | `PGSSL` (또는 `PGSSLMODE`) | `env`(values-be.yaml `require`, gcp도 `require`) | 실행 (기동 시 1회) |
| demo-app-be | `PG_URL` | Secret `demo-app-db`에 있으나 코드는 읽지 않음(마이그레이션 Job 용, 가정 4) | — |
| demo-app-be | **`LOAD_TEST_ENABLED`** | `env`(**values-be.yaml `"true"` — test · prod 공통**). `true|1|yes|on`이면 `POST /api/load/cpu` 등록, 아니면 404. `NODE_ENV`와 독립 | 실행 (라우트 등록 시) |
| demo-app-be | `CHAOS_ENABLED` | **`deploy/values-be.test.yaml`만** `"true"`. prod · 대상별 값 파일에 없음 → prod는 `POST /api/chaos*` 404 (직전 C-1 해결) | 실행 (라우트 등록 시) |
| demo-app-be | `PORT` / `HOST` | Dockerfile `ENV PORT=8000 HOST=0.0.0.0`, 차트 `containerPort: 8000` 일치 | 실행 |
| demo-app-be | `APP_VERSION` | `env`(values-be.yaml **`v2.1.1`**). `v2` 접두면 FE 테마 전환 | 실행 (요청마다) |
| demo-app-be | `NODE_ENV` | Dockerfile `production`. `/api/info`의 `env` | 실행 |
| demo-app-be | `LOG_LEVEL` | `env`(values-be.yaml `warn`) | 실행 |
| demo-app-be | `HOSTNAME` / `POD_NAME` / `REGION` | 선택. k8s가 `HOSTNAME`을 파드 이름으로. `/api/load/cpu` 응답의 `hostname`에도 사용. `REGION` 기본 `ap-northeast-2`, gcp `asia-northeast3` | 실행 (요청마다) |
| demo-app-fe | **`POD_NAMESPACE`** | 차트 `podNamespaceEnv: true`(Downward API `metadata.namespace`, 가정 6). 없으면 엔트리포인트가 `default`로 대체 | **기동 시** (`19-runtime-dns.sh` → nginx 설정 렌더) |
| demo-app-fe | **`RUNTIME_DNS_RESOLVER`** | 값 파일이 아니라 엔트리포인트가 `/etc/resolv.conf` 첫 `nameserver`에서 유도(IPv6면 `[…]`) | 기동 시 |
| demo-app-fe | `NGINX_ENVSUBST_TEMPLATE_DIR` | Dockerfile 고정 `/tmp/no-templates`(베이스 스크립트 무력화용) | 기동 시 |
| demo-app-fe | runtime-status 주소 | nginx 템플릿 고정 `runtime-status.${POD_NAMESPACE}.svc.cluster.local:8080` → 플랫폼 Service 이름 · 포트와 맞아야 한다(가정 6) | 기동 시 렌더, 요청 시 DNS 해석 |
| demo-app-fe | BE 주소 | `fe/nginx.conf` `demo-app-be:8000` 고정 → k8s Service 이름 · `service.port` 일치 | 이미지 빌드 시 (템플릿 파일) |
| demo-app-fe | `VITE_API_URL` / **`VITE_RUNTIME_API_URL`** | `vite.config.ts` 개발 서버 프록시 대상만(기본 `:8000` / `:8080`). 번들 · 이미지에 없음 | 개발 시 |
| demo-app-fe | `previewAuth.*` | 차트 값(aws Cognito `issuerUrl` · Secrets Manager ARN, gcp · onprem은 `remoteKey` 이름, `routes` `/api/` → `demo-app-be-preview:8000`). 앱 코드가 읽지 않음 | 배포 시 (차트) |

- `.env.example` 없음, `.gitignore`가 `.env*`를 막는다(변화 없음). `be/src` 전체 `process.env` 사용처는 위 목록이 전부(`grep` 확인, `load.ts`의 `LOAD_TEST_ENABLED` · `HOSTNAME` 추가).
- README 환경변수 표에 `LOAD_TEST_ENABLED` 추가됨. 비밀값은 DB 자격증명(Secret)뿐.
- FE `index.html`이 Pretendard 웹폰트를 `cdn.jsdelivr.net`에서 받는다(변화 없음).

## 검사 명령 (checks.yml 입력)
- node-dirs: `["be", "fe"]` / python-dirs: `[]` / image-dirs: `["be", "fe"]` / db-init: `db/init.sql` / iac-path: `infra`
  - `.github/workflows/deploy.yml`이 정확히 이 값으로 `checks.yml@v2.17.0`을 호출한다(변화 없음, 버전만 상승).
- 이번 실행 결과 (2026-10-11, 로컬 Node 24.10.0 · pnpm 10.28.1, 커밋 142633a + 미커밋 `fe/index.html` meta 1줄). 수치는 이번 yolo 실행이 먼저 돌린 결과를 인용했고 이 문서 작성 중 다시 돌리지 않았다:

| 디렉터리 | `pnpm install --frozen-lockfile` | `pnpm lint` | `pnpm test` | `pnpm build` | 소요 |
|---|---|---|---|---|---|
| `be` | ✔ | ✔ `tsc --noEmit` | ✔ (5파일: chaos · db-ssl · metrics · load · 통합) | ✔ `tsc` | 13초 |
| `fe` | ✔ | ✔ `tsc --noEmit` | ✔ **(신규, `runtime.test.tsx`)** | ✔ `tsc -b && vite build` | 17초 |

  - `docker build be` ✔(캐시), `docker build fe` ✔ 64초(새 엔트리포인트 · 템플릿 포함), `terraform fmt -check infra/envs/aws` ✔.
  - checks의 Node 잡 통과 기준(`lint` · `build` 존재, lockfile 존재)은 두 디렉터리 모두 충족. FE `test` 스크립트는 checks가 요구하지 않지만 `runtime-status.yml`이 fe 변경 시 돌린다.
  - 추가 잡(이 레포 자체): `deploy.yml request` 잡이 `.github/tests`(npm, `js-yaml` · `picomatch`, `package-lock.json`)를 `npm ci && npm test`로 돌린다 — 배포 대상 분기 회귀 검사. checks `node-dirs`와 무관.
  - pnpm 10 의존성 빌드 스크립트 차단 경고(esbuild)는 그대로일 것으로 본다(가정 15). ESLint 없음, `lint`는 타입 검사(변화 없음).
- 빠진 스크립트 · lockfile: 없음.
- 그 외 잡: vuln-scan · image-scan(Trivy HIGH+) · iac-scan · secret-scan · license-scan · config-guard. `.gitleaksignore`에 `security.md` 과거 커밋 1건 예외 추가됨(8cadbb6, generic-api-key 오탐).

## 산출물 점검 (artifacts.md 규칙 대비)

`bash deploy-provision/scripts/check-artifacts.sh .` (2026-10-11, HEAD 142633a) — **✓ 산출물 검사 통과, 문제 0건** (직전 12건 전부 해소).

| 산출물 | 상태 | 비고 |
|---|---|---|
| `be/Dockerfile`, `be/.dockerignore` | ✔ 변화 없음 | B-1 전제(운영 의존성 순수 JS) 유지 — lockfile 변경 없음 |
| `fe/Dockerfile`, `fe/.dockerignore`, `fe/docker-entrypoint.d/19-runtime-dns.sh`, `fe/nginx.conf`(템플릿) | ✔ | 쓰기 경로 `/tmp`만. `CMD`가 `/tmp/runtime-nginx.conf`를 가리키므로 **엔트리포인트 스크립트가 반드시 먼저 돌아야 한다**(nginx 이미지 엔트리포인트는 `$1 = nginx`일 때 `/docker-entrypoint.d/*`를 실행 — CMD 첫 인자가 `nginx`라 충족). `resolver` 없이 변수 `proxy_pass`를 쓰면 nginx가 기동 실패하므로 `resolver` 줄이 템플릿에 반드시 남아야 한다 |
| `deploy/values-be.yaml` | ✔ | `containerPort` · `service.port` 8000, `replicas: 2` + HPA 2~6/70%, `resources 100m·128Mi/256Mi`, `probe.path: /health`, `envFromSecrets`, `migration`, `env` `APP_VERSION v2.1.1` · `LOAD_TEST_ENABLED "true"` · `PGSSL` · `LOG_LEVEL`. `CHAOS_*` 없음(T35 규칙 ✔) |
| `deploy/values-be.test.yaml` | ✔ | `CHAOS_ENABLED "true"` + `probe.livenessPath: /healthz/liveness`. 파일명 규약으로 test만 병합(가정 7) |
| `deploy/values-fe.yaml` | ✔ | `containerPort: 3000`, **`podNamespaceEnv: true`**, `replicas: 1`, HPA 꺼짐, `probe.path: /`, `ingress.enabled: true` · `healthcheckPath: /`, `metrics.port 4040` + `nginxLogExporter`, `previewAuth` + `routes` |
| `deploy/values-runtime-status.yaml` | ✔ | `serviceName: demo-app-be` — runtime-status가 목록을 뽑을 BE 릴리스 이름. plan.yaml · nginx 템플릿과 일치 |
| `deploy/aws/values.yaml` · `deploy/onprem/values.yaml` · `deploy/gcp/values.yaml` | ✔ | aws는 주석만(replica는 공통 값 + HPA); onprem `ingress.enabled: false` · `replicas: 1` · `autoscaling.enabled: false` · `previewAuth.remoteKey`; gcp NEG · gce 클래스 · `PGSSL` · `REGION` · `previewAuth`(ManagedCertificate, 고정 IP). artifacts.md의 "aws `replicas: 1`" 문구와는 다르지만 T29 결정(플랫폼 v2.11.0 Cluster Autoscaler)이고 check-artifacts는 통과 |
| `.deploy/smoke.json` | ✔ | BE 8개 · FE 2개 경로 모두 현재 코드에 존재. `/health` · `/api/info`에 `expect_body`로 DB 연결 확인. **`/api/load/config` · `/api/runtime`은 없음**(B-2) |
| `.deploy/plan.yaml` | ✔ | `target: aws`, 서비스 2개 포트 · health · migration · resources · replicas(be 2/2/1, fe 1) · autoscaling · `nodes.aws` t3.medium 3~5가 값 파일 · 코드와 일치. `layers` 키 없음(aws test DB가 온프레미스인데 plan에 없는 것은 check-artifacts 규칙상 문제 없음 — 확인 못 한 것 참고) |
| `.github/workflows/deploy.yml` 호출부 | ✔ 입력 일치 | `services` JSON = plan.yaml, 검사 입력 위 참조, 대상은 `DEPLOY_TARGETS`→`DEPLOY_TARGET`→`aws`, `preview-host` · `preview-auth`는 matrix(`deploy-targets.sh`), `chart-version: 2.17.0`, `template-ref: v2.17.0` |
| 버전 표기 | ✔ | `config.yaml v2.17.0` = 워크플로 7종 `@v2.17.0` = `chart-version 2.17.0` = `slack-notify@v2.17.0` = onprem tf 5개 `?ref=v2.17.0` = aws `preview_auth` · `db_link` `?ref=v2.17.0`. aws 나머지 6개 모듈 `v2.11.0` · gcp 7개 `v1.16.2`는 `infra_versions` 고정(artifacts.md 1~4행이 허용). `template-update.yml`만 `@v2`(규칙상 예외). `variables.tf chart_version` 기본값(aws 2.9.0 · gcp 1.16.0 · onprem 1.16.0)은 service-base 차트 버전이라 검사 대상이 아니지만 onprem 설명("template_version과 같게")과 어긋난다 — 확인 못 한 것 |
| `.deploy/config.yaml` | ✔ 형식 | CODEOWNERS 보호. `runtime_status_values` · `infra_versions`는 규칙(artifacts.md 126행 "그 밖의 키를 넣지 않는다") 밖 키이지만 사람 PR로 들어갔고 파이프라인이 읽는다. yolo 경로는 이 파일을 건드리지 않는다 |

## 필요한 코드 수정
### (a) 배포에 필요
- **없음.** 검사 7개 + docker build 2개 + terraform fmt가 통과하고, check-artifacts 0건, 포트 · 헬스 · 환경변수 계약이 Dockerfile · 값 파일 · plan.yaml · smoke.json · deploy.yml 사이에서 일치한다.

### (b) 권장 — 운영 정합성 · 품질
- **B-1. 교차 아키텍처 빌드 가드**(`be/Dockerfile`, 직전 그대로): deps 스테이지가 `$BUILDPLATFORM`에서 설치한 `node_modules`를 복사한다. 이번 변경은 코어 모듈만 써서 안전. 네이티브 prod 의존성이 들어오면 deps 스테이지의 `--platform`을 지워야 한다는 규칙을 README에 한 줄 권장.
- **B-2. smoke에 `GET /api/load/config expect 200` 추가**(`.deploy/smoke.json`): `LOAD_TEST_ENABLED` 계약(라우트 등록)을 승격 전에 확인한다. 게이트와 무관하게 항상 200이라 환경별 분기가 필요 없다. 반대로 **`/api/runtime`은 smoke에 넣지 않는 것을 권장** — runtime-status(플랫폼 릴리스)가 늦게 뜨면 앱 승격이 막힌다. provision 단계 몫.
- **B-3. README 검사 명령 갱신**(문서): "FE: `pnpm lint && pnpm build`"에 `pnpm test`가 빠져 있다(`docs/runtime-status.md`에는 있음).
- **B-4. `PG_URL` 정리**(직전 B-2 그대로, 문서): README에 "`PG_URL`은 마이그레이션 Job만 사용".

### (c) 동작을 바꾸는 것 — 사람이 결정
- **C-1. prod의 `LOAD_TEST_ENABLED: "true"`**: `deploy/values-be.yaml`이 공통이라 prod 공개 주소에서 **인증 없는 CPU 소모 API**(`POST /api/load/cpu`)가 열린다. README는 의도("test · prod 모두")라고 적는다. 파드당 상한(워커 1개 · 큐 8 · 2초)은 있지만 파드 수 × 1코어까지 쓰고 HPA를 최대 6까지 밀어 **노드 비용**이 든다(가정 12). T35와 같은 방식으로 `deploy/values-be.test.yaml`로 옮기면 prod는 `/api/load/config enabled: false` + 404가 된다(FE 패널은 자동으로 비활성 표시). 보안 · 예산 분석기 판단 대상. check-artifacts의 플래그 규칙(`CHAOS_*` · `DEBUG` · `FAULT_*`)에는 걸리지 않는다.
- **C-2. prod BE liveness = `/health`(DB 의존)**: `probe.livenessPath: /healthz/liveness`가 test 값 파일에만 있다(PR #88 제목도 "for BE test"). prod에서 RDS가 불통이면 `/health` 503 → kubelet 재시작 루프(메모리 폴백 데이터 · 장애 주입 상태 매번 소실). 공통 `deploy/values-be.yaml`로 옮길지(권장: readiness만으로 충분히 Service에서 빠진다), prod는 재시작이 복구 수단이라 그대로 둘지 결정. 값 파일 한 줄이라 provision이 바꿀 수 있다.
- **C-3. `/api/runtime` 공개 노출**: FE가 공개 주소에서 Kubernetes 파드 이름 · 버전 · 리비전 · 리소스 요청/한도 · 재시작 횟수를 인증 없이 보여 준다. 시연 의도이지만 민감 데이터 `예` 브리프라 보안 분석기 판단 대상. nginx에서 경로를 막거나 미리보기 인증 뒤로 보내는 것은 앱 코드 변경(`RuntimePods` 제거 또는 조건부)이 따른다.
- **C-4. 인메모리 폴백의 데이터 라우트**(직전 C-2): 파드 ≥ 2에서 `dbError` 주입은 한 파드에만 걸려 화면이 "일부만 degraded"로 보인다. 시연 설명 또는 운영에서 503 전환 중 결정.
- **C-5. 입력 처리**(직전 C-3 그대로): 방명록 검증 · 레이트리밋 · CORS `origin: true` 없음. `/api/load/cpu`도 레이트리밋이 큐 크기뿐.

## 확인 못 한 것
- App Chart 2.17.0 본문: `podNamespaceEnv`(Downward API 변수 이름이 `POD_NAMESPACE`인지), `probe.livenessPath` 키 이름 · 기본 동작(liveness가 `probe.path`를 쓴다는 것은 값 파일 주석에서 추정), `writablePaths` 기본 `/tmp`, `previewAuth.routes`, `nginxLogExporter` 포트. 이 레포에 차트가 없다.
- **runtime-status 서비스 자체**: 이미지 · RBAC(파드 목록 · metrics.k8s.io 읽기) · Service 이름 `runtime-status` · 포트 8080 · `/api/runtime` 응답 계약은 platform 레포(`v2.17.0`)에 있다. FE `parseRuntimeSnapshot`이 스키마를 검증하므로 계약 불일치는 파드 카드 "조회 불가"로만 나타나고 다른 기능에는 영향이 없다. 배포 워크플로가 앱보다 먼저 설치하는지(`docs/runtime-status.md` 3항)는 실행 기록으로만 확인 가능.
- `deploy/values-be.test.yaml`이 test에만 병합되는 규칙(platform `scripts/values-files.sh`)은 파일 주석과 `deploy.yml`의 `prod_common` 필터(`deploy/values-!(*.test).yaml`)로 추정했다.
- nginx-unprivileged 베이스 엔트리포인트의 다른 스크립트(`10-listen-on-ipv6-by-default.sh` · `15-local-resolvers.envsh` · `30-tune-worker-processes.sh`)가 읽기 전용 루트에서 조용히 건너뛰는지는 `runtime-status.yml`의 `--read-only --tmpfs /tmp` `nginx -t` 검사(CI)에 의존한다. 이 실행에서 컨테이너를 실제로 띄우지는 않았다(docker build만).
- Secret `demo-app-db`의 `DATABASE_URL` 형식(sslmode 유무), aws test의 `demo-app-db-onprem` Secret과 `demo-app-db`의 관계(db_link가 같은 이름으로 만드는지)는 platform 모듈을 열지 않아 미확인. `envFromSecrets: [demo-app-db]`는 변화 없다.
- 검사는 로컬 Node 24.10으로 돌렸다. checks.yml · Dockerfile · `runtime-status.yml`은 Node 22(가정 2). CPU 워커 · `worker_threads` 동작은 22 · 24 공통이지만 같은 버전으로 재실행하지는 않았다.
- `variables.tf chart_version` 기본값(aws 2.9.0 · gcp · onprem 1.16.0)이 실제 적용값인지(tfvars · CI 입력으로 덮는지)는 infra 범위라 보지 않았다. check-artifacts 규칙 대상은 아니다.
- `.deploy/plan.yaml`에 `layers` · `database_scope`가 없는데 aws test DB는 온프레미스(db_link)다. check-artifacts는 `layers`가 없으면 "모든 계층이 target에 있다"로 보고 통과시킨다. 서비스 분석기 · 사람이 plan 표기를 맞출지 판단.
- `fe/src/App.tsx`(약 1,000줄) · `i18n.ts`는 API 호출부 · 상태 · 새 컴포넌트 연결만 읽었다. CPU 부하 소요 시간 · HPA 반응은 측정하지 않았다(가정 12).

## 가정
1. **FE 쓰기 경로 = `/tmp`만**: `19-runtime-dns.sh`의 출력 2개, 비특권 nginx의 pid · temp, `NGINX_ENVSUBST_TEMPLATE_DIR` 우회가 전부라고 본다(근거: Dockerfile 주석, 스크립트 본문, `runtime-status.yml`의 read-only `nginx -t`). 차트 기본 `writablePaths: [/tmp]`로 충분.
2. **Node 런타임 22**: 두 Dockerfile `node:22-alpine`, `runtime-status.yml` `node-version: 22`. `.nvmrc` · `engines` 없음.
3. **서비스 포트 · 네임스페이스 계약**: FE nginx의 `demo-app-be:8000` · `runtime-status.<ns>:8080` 하드코딩은 두 서비스와 runtime-status가 **같은 네임스페이스**(deploy.yml `namespace: test|prod`)에 뜬다는 전제.
4. **DB Secret 키 형식**: `DATABASE_URL`은 host · 자격증명 · DB명, sslmode는 없거나 `require`. `PGSSL: require`가 명시 옵션이라 결과는 같다. `PG_URL`은 마이그레이션 Job만 쓴다.
5. **마이그레이션 = `db/init.sql` 재실행**: Drizzle 산출물 없음. 스키마 변경은 `init.sql`에 idempotent SQL 추가 방식.
6. **차트 · 플랫폼 기능 추정**: `podNamespaceEnv: true` → Downward API로 `POD_NAMESPACE` 주입; `probe.livenessPath` → liveness 경로 분리(없으면 `probe.path` 공용); `metrics.nginxLogExporter` → `127.0.0.1:5531` syslog 수신 사이드카 → `4040`; `previewAuth` → oauth2-proxy(Cognito OIDC) + `routes`; `runtime_status_values` → 배포 워크플로가 네임스페이스마다 `runtime-status` 릴리스(Service `runtime-status:8080`)를 앱보다 먼저 설치. 모두 앱 코드 · 이미지에 닿지 않고 실패 시 파드 카드만 영향.
7. **`values-<svc>.test.yaml`는 test만 병합**: 파일 주석 + `deploy.yml prod_common` 필터 근거. 따라서 prod는 `CHAOS_ENABLED` 없음 · liveness `/health`.
8. **AWS 우선**: 브리프 선호 대상 AWS. "외부 노출" · Ingress · TLS · DB 위치 · HPA 판단은 aws 기준, onprem · gcp 차이는 병기.
9. **장애 주입 · 인메모리 폴백 · CPU 부하 API는 시연 의도**: README · PR #44 · #52 · #106이 명시 → "버그"가 아니라 결정 항목(c).
10. **aws BE 파드 2 + HPA 2~6**: 파드별 인메모리 상태는 1/N. FE는 `/api/runtime`으로 파드 전체를 본다. onprem은 replica 1 · HPA 꺼짐.
11. **운영 의존성은 순수 JS 유지**: `be/pnpm-lock.yaml`이 b8bc6d8 이후 변경 없음(직전 `pnpm ls --prod` 확인 결과 유효). `worker_threads` · `crypto`는 Node 코어.
12. **CPU 부하 비용(추정, 미측정)**: 32바이트 sha256 1회 ≈ 1µs로 보면 요청당 light ≈ 5ms · medium ≈ 15ms · heavy ≈ 30ms, 브라우저 1개 최대 20 rps × heavy ≈ 0.6코어 ≈ 600m. BE CPU request 100m · HPA 목표 70%(≈ 70m)라 브라우저 1개로도 1~2 HPA 주기 안에 최대 6파드까지 확장될 수 있다. CPU limit이 없어 파드당 워커 1개 = 최대 1코어(node t3.medium 2 vCPU). 실제 값은 시연 측정(README "10 RPS · 중간 · 3분") 후 트래픽 · 예산 분석기가 갱신.
13. **runtime-status 부재는 FE 기능 저하만**: nginx가 요청 시 DNS 해석(`resolver … valid=10s`)하고 `proxy_connect_timeout 2s` · `proxy_read_timeout 4s`, FE는 3.5초 abort + `catch`로 마지막 목록 유지. 기동 · smoke(`/`, `/no-such-page`)는 영향 없음.
14. **check-artifacts 결과는 HEAD 기준**: 미커밋 `fe/index.html` 변경은 검사 대상 경로(`.github .deploy deploy infra` · Dockerfile)가 아니다.
15. **pnpm 10 `approve-builds` 경고 무해**: 직전 실행과 같은 lockfile 구조(esbuild 빌드 스크립트 차단)이며 lint · test · build 통과에 영향 없음.
