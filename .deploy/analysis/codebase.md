# 코드베이스 분석

분석일: 2026-10-10 (이전 분석 2026-10-09를 현재 코드로 다시 검증해 재작성)
브리프: 하루 100명 이하 · 월 10만 원 이하 · 민감 데이터 **예**(`regulated`) · 선호 대상 **AWS** · 가용성 **시연용**.
레포는 이미 배포 산출물(Dockerfile · `deploy/` 값 파일 · `infra/envs/{aws,gcp,onprem}` · 워크플로 · `.deploy/smoke.json`)을 갖고 있다. 이 분석은 산출물이 현재 코드와 App Chart 조건, `deploy-provision/references/artifacts.md` 규칙에 맞는지까지 본다.

## 이전 분석(2026-10-09) 이후 바뀐 것

| PR | 코드 · 산출물 변화 | 이 분석에 미치는 영향 |
|---|---|---|
| #44 대시보드 · 관리자 패널 | BE에 `/api/metrics`(파드 1개 기준 인메모리 지표), `/api/chaos` GET/POST, `/api/chaos/reset`(지연 · 에러율 · DB 단절 주입) 추가. `checkDbHealth`에 3초 캐시 · 1초 타임아웃. FE 전면 개편(1초 폴링 2종, 부하 생성기 최대 60 RPS, `lucide-react`). FE `package.json`에 미사용 의존성 `dev@0.1.5`가 들어옴 | 인증 없는 장애 주입 경로가 외부에 노출됨(아래 수정 목록 C-1). 헬스 경로도 주입 대상에 포함됨(C-2) |
| #40 T17 계측 | BE `/metrics`(Prometheus, `@prometheus-io/client`), `pnpm test` 스크립트 + 테스트 2개. `deploy/values-*.yaml`에 `metrics` 키, `fe/nginx.conf`에 syslog 계측 로그. infra 세 루트에 observability 모듈 | 검사 명령에 테스트가 생김. 값 파일 · nginx.conf 계약이 새로 생김(아래 점검) |
| #45~#50 T27 · T8 · T26 | `.deploy/config.yaml` `template_version: v2.1.2` + `infra_versions`(aws · gcp `v1.16.0`). 워크플로 `deploy/infra/rollout`은 `@v2.1.3`, `onprem-verify`는 `@v2.1.2`, `chart-version: 2.1.2`. onprem Terraform `?ref=v2.1.2`, aws · gcp `?ref=v1.16.0`. 대상 선택지에 `onprem-secondary` 추가 | 버전 표기가 세 갈래로 갈라짐(아래 산출물 점검). 코드 문제는 아님 |
| 브리프 | 온프레미스 → **AWS**, 민감 데이터 미정 → **예**, 일반 운영 → **시연용** | `.deploy/plan.yaml`의 `target: onprem`은 브리프와 어긋남(plan은 이 분석 밖 산출물). RDS 접속 TLS 문제가 "가능성"에서 "AWS면 실제로 겪는 문제"로 바뀜(A-1) |

이전 분석의 **정정**: "기동 시 DB 연결 실패면 `sqlClient`가 null로 남아 재연결하지 않는다"는 틀렸다. `be/src/db/index.ts`는 `sqlClient = postgres(...)`를 먼저 대입하고 `SELECT 1`을 던지므로 실패해도 `sqlClient`는 남고 **`db`(drizzle 인스턴스)만 null**로 남는다. 결과는 더 나쁘다: DB가 나중에 살아나면 `checkDbHealth`는 true를 돌려 `/health`가 `connected`라고 답하지만, 라우트는 `isDbConnected && db` 조건에서 `db`가 null이라 계속 메모리에 쓴다(B-3).

## 서비스
| 이름 | 경로 | 스택 | 실행 명령 | 포트 | 헬스체크 | Dockerfile | 외부 노출 |
|---|---|---|---|---|---|---|---|
| demo-app-be | `be/` | Node 22(alpine) · TypeScript 5.9 · Fastify 5.12 · Drizzle ORM 0.45 · postgres.js 3.4.9 · `@prometheus-io/client` 0.16.1 · pino · pnpm 10.28.1 | 빌드 `pnpm build`(tsc) → 실행 `node dist/index.js` | 8000 (`PORT` 기본 8000, `HOST` 0.0.0.0) | `GET /health`(DB 상태 포함, DB 끊겨도 200) · `GET /healthz/liveness` | 있음 (3단계, `USER 1000`) | 아니오. FE nginx가 클러스터 안에서 `http://demo-app-be:8000`으로 `/api/`, `/health`를 프록시 |
| demo-app-fe | `fe/` | Node 22 빌드 → `nginxinc/nginx-unprivileged:alpine`(UID 101) 정적 서빙 · Vite 6.4 · React 19.3 · Tailwind 4.3 · lucide-react · pnpm 10.28.1 | 빌드 `pnpm build`(`tsc -b && vite build`, 산출물 280KB) → `nginx -g 'daemon off;'` | 3000 (`fe/nginx.conf` `listen 3000`) | 없음(정적). 값 파일 `probe.path: /`. `/health`는 BE로 프록시됨 | 있음 (2단계, `USER 101`) | 예. aws는 ALB Ingress(`ingress.enabled: true`), onprem은 Quick Tunnel → `demo-app-fe.<env>.svc:80` |

- 워커 · 크론 · 큐 소비자 없음. 서비스 2개.
- FE → BE 호출은 전부 상대 경로(`fetch('/api/...')`)라 번들에 BE 주소가 없다. 경로 라우팅은 `fe/nginx.conf`가 맡는다. `/metrics`, `/api/metrics`, `/api/chaos`도 `/api/` 프록시를 타므로 **FE 공개 주소에서 그대로 열린다**.
- BE 라우트(현재): `/health`, `/healthz/liveness`, `/metrics`(Prometheus 텍스트), `/api/info`, `/api/metrics`, `/api/votes`, `POST /api/votes/:id`, `/api/guestbook`, `POST /api/guestbook`, `GET|POST /api/chaos`, `POST /api/chaos/reset`. README API 표에는 #40 · #44 경로가 빠져 있다.
- `preHandler` 장애 주입 훅은 `/metrics`, `/api/chaos*`, `/api/metrics*`만 제외한다. 즉 **`/health`, `/healthz/liveness`, 모든 `/api/*`가 지연 · 에러율 주입 대상**이다.
- FE 브라우저 한 탭당 `/api/info` 1 req/s + `/api/metrics` 1 req/s(상시), 부하 생성기 켜면 `/api/votes`에 최대 60 req/s 추가. 하루 100명 기준으로 BE 요청량은 열려 있는 탭 수 × 2 rps가 바닥이다(트래픽 분석기 입력).
- 두 서비스 모두 `SIGTERM` 처리: BE는 `app.close()` 후 종료, nginx는 기본 동작.
- Prometheus 계측(`be/src/metrics.ts`, `fe/nginx.conf` `map $http_user_agent`)은 `kube-probe/`, `ELB-HealthChecker/`, `GoogleHC/`, `one-tatchi-smoke` UA와 `/health*`, `/metrics`를 집계에서 뺀다. 테스트 2개가 이 동작을 고정한다.

### 컨테이너화 점검 (App Chart 조건 + artifacts.md 규칙)
| 조건 | demo-app-be (`be/Dockerfile`) | demo-app-fe (`fe/Dockerfile`) |
|---|---|---|
| non-root 숫자 UID | `USER 1000` ✔ | `USER 101` ✔ |
| 읽기 전용 루트 FS | 디스크 쓰기 없음(pino → stdout, `fs` 쓰기 없음; 통합 테스트만 `tmpdir` 사용) ✔ | nginx-unprivileged가 pid · temp를 `/tmp`에 둠 → 차트 기본 `writablePaths: [/tmp]` (가정 1) ✔ |
| 다단계, 런타임에 패키지 매니저 없음 | 3단계. runner에서 npm · corepack · yarn 삭제 ✔ | 2단계. 런타임은 nginx만 ✔ |
| 런타임 환경변수를 굽지 않음 | `ENV NODE_ENV PORT HOST`는 기본값 수준, 비밀값 없음 ✔ | 빌드 시 환경변수 없음 ✔ |
| lockfile 고정, `\|\| pnpm install` 우회 없음 | `--frozen-lockfile`만 사용 ✔ (이전 분석의 폴백 지적은 해소됨) | 동일 ✔ |
| 베이스 이미지 보안 패치 | `apk upgrade --no-cache` ✔ | `apk upgrade --no-cache tiff`로 **tiff만** 올림. 다른 패키지 CVE가 생기면 image-scan에서 막힘 (B-5) |
| `.dockerignore` | `node_modules dist .git .env .env.* *.md Dockerfile .dockerignore` ✔ (`tests/`는 없지만 Dockerfile이 `src`만 COPY) | 동일 ✔ |
| 포트 계약 | `ENV PORT=8000` = `containerPort: 8000` = `service.port: 8000` = nginx `demo-app-be:8000` ✔ | `EXPOSE 3000` = `listen 3000` = `containerPort: 3000` ✔ |

## 데이터 저장소
- **PostgreSQL 17** 하나. 로컬은 `docker-compose.yml`(`postgres:17-alpine`, 볼륨 `postgres_data`, `db/init.sql`을 `/docker-entrypoint-initdb.d`에 마운트).
- 스키마: `db/init.sql` — `votes`, `guestbook` 두 테이블 + 시드. Drizzle 스키마(`be/src/db/schema.ts`)는 같은 모양. `drizzle-kit`은 devDependency로만 있고 `drizzle.config.ts` · 마이그레이션 디렉터리 · 스크립트가 없다. **마이그레이션 도구는 없고 `db/init.sql`이 유일한 스키마 소스**(변화 없음).
- 배포 시 적용: `migration.enabled: true` + `secretName: demo-app-db` + deploy.yml `services[].migration: db/init.sql` → pre-install/pre-upgrade Job이 매 배포마다 실행.
  - `CREATE TABLE IF NOT EXISTS`, `votes` 시드 `ON CONFLICT (option_key) DO NOTHING`은 재실행 안전.
  - **`guestbook` 시드는 여전히 재실행 안전하지 않다.** unique 제약이 없어 `ON CONFLICT DO NOTHING`이 아무것도 막지 않고, 배포(또는 Blue-Green 재배포)마다 시드 2건이 다시 들어간다(B-1).
- 운영 DB는 플랫폼 모듈이 만든다: aws는 RDS Postgres 17 `db.t4g.micro` 20GB 단일 AZ(test · prod가 **같은 RDS**, `infra/envs/aws/main.tf` 주석), onprem은 환경마다 StatefulSet. 접속 정보는 service-base 차트가 Secret `demo-app-db`로 각 네임스페이스에 만든다.
- SQLite · 파일 저장 등 다중 인스턴스를 막는 저장소 없음.

## 상태
- **인메모리 폴백** (`be/src/db/index.ts` `memoryFallback`): 기동 시 연결 실패(connect_timeout 2s)면 투표 · 방명록을 프로세스 메모리로 처리하고 `/health`는 `200 {database: "fallback-memory"}`. 운영 관점의 결과:
  - readiness가 DB 장애를 드러내지 않아 Rollout · 승격 판단이 "정상"으로 본다.
  - 기동 실패 뒤 DB가 살아나도 `db`가 null이라 **`/health`는 `connected`, 데이터는 메모리**로 엇갈린다(이전 분석 정정 참고).
  - replica ≥ 2이거나 Blue-Green 전환 중이면 파드마다 다른 데이터.
- **장애 주입 상태** (`be/src/routes/chaos.ts` `chaosState`): 파드별 인메모리 싱글톤. `dbError: true`면 `checkDbHealth`가 false를 돌려 라우트가 메모리로 떨어진다. 파드가 재시작되면 초기화된다. Blue-Green의 green 파드는 새 프로세스라 주입 상태를 물려받지 않는다.
- **대시보드 지표** (`be/src/routes/metrics.ts`): 60초 창의 인메모리 버킷. 파드 1개 기준이며 코드 주석도 그렇게 적고 있다. replica 1(aws · onprem 값 파일)에서는 문제 없음.
- 업로드 · 세션 · 서버 캐시 없음. 1인 1투표 제한은 브라우저 `localStorage`(`demo_voted_option`)만 사용.
- 로그는 stdout(pino / nginx `access_log /dev/stdout`). nginx 계측 로그는 `syslog:server=127.0.0.1:5531`(UDP)로 보내므로 수신 사이드카가 없어도 nginx는 멈추지 않는다.

## 환경변수
| 서비스 | 이름 | 출처 | 읽는 시점 |
|---|---|---|---|
| demo-app-be | `DATABASE_URL` | Secret `demo-app-db`(`envFromSecrets`). 코드 기본값은 로컬 compose 주소. postgres.js는 URL 스킴을 무시하고 host · 자격증명 · `?sslmode=`만 읽는다(`node_modules/postgres/src/index.js` 437~445행 확인). 이전 분석 기준 이 키는 `postgresql+psycopg://…`이고 sslmode가 없다 → **TLS 없이 접속 시도**(A-1, 가정 4) | 실행 (기동 시 1회) |
| demo-app-be | `PG_URL` | Secret `demo-app-db`(`…?sslmode=require`). **현재 코드는 읽지 않음** | — |
| demo-app-be | `PORT` / `HOST` | 고정값. Dockerfile `ENV PORT=8000 HOST=0.0.0.0`, 차트 `containerPort: 8000` 일치 | 실행 |
| demo-app-be | `APP_VERSION` | `env`(values-be.yaml `v1.0.0`). `v2` 접두면 테마 전환 | 실행 (요청마다) |
| demo-app-be | `NODE_ENV` | Dockerfile `production`. `/api/info`의 `env`로 노출 | 실행 |
| demo-app-be | `LOG_LEVEL` | 선택. 기본 `info` | 실행 |
| demo-app-be | `HOSTNAME` / `POD_NAME` / `REGION` | 선택. k8s가 `HOSTNAME`을 파드 이름으로 넣음. `REGION` 기본 `ap-northeast-2`(AWS 서울이면 사실과 일치) | 실행 (요청마다) |
| demo-app-be | `APP_ENV` | README에만 있고 코드는 읽지 않음 (README 오류, 변화 없음) | — |
| demo-app-be | `PGSSL` | `deploy/gcp/values.yaml`의 `env.PGSSL: require`. **postgres.js는 `PGSSL`을 읽지 않는다**(소스에 없음). gcp 값 파일의 의도는 코드에 닿지 않음 | — |
| demo-app-fe | `VITE_API_URL` | `vite.config.ts` 개발 서버 프록시 대상만. 번들 · 이미지에 들어가지 않음 | 개발 시 |
| demo-app-fe | BE 주소 | `fe/nginx.conf` `demo-app-be:8000` 고정 → k8s Service 이름 · `service.port`와 일치해야 함 | 이미지 빌드 시 (설정 파일) |

- `.env.example` 없음. `.gitignore`가 `.env*`를 막고 레포에 `.env` 없음. 이 워크트리에는 `*.tfstate`도 없다(`git status --ignored` 확인).
- 비밀값은 DB 자격증명뿐. `be/src` 전체에서 `process.env`는 위 목록이 전부다. 장애 주입 · 관리자 패널을 끄거나 잠그는 환경변수는 **없다**.
- FE `index.html`이 Pretendard 웹폰트를 `cdn.jsdelivr.net`에서 받는다. 브라우저 → 외부 CDN 호출이며 서버 egress는 아니다(민감 데이터 관점의 CSP 결정은 보안 분석기 몫).

## 검사 명령 (checks.yml 입력)
- node-dirs: `["be", "fe"]` / python-dirs: `[]` / image-dirs: `["be", "fe"]` / db-init: `db/init.sql` / iac-path: `infra`
  - `.github/workflows/deploy.yml`이 정확히 이 값으로 `checks.yml@v2.1.3`을 호출한다.
- 로컬 실행 결과 (Node 24.10.0 · pnpm 10.28.1, 2026-10-10):

| 디렉터리 | `pnpm install --frozen-lockfile` | `pnpm lint` | `pnpm test` | `pnpm build` |
|---|---|---|---|---|
| `be` | ✔ (lockfile 일치) | ✔ `tsc --noEmit` | ✔ 2/2 통과(단위 1 + 통합 1, 통합은 실제 진입 파일을 자식 프로세스로 띄워 메모리 폴백으로 검증, ~1초) | ✔ `tsc` |
| `fe` | ✔ (lockfile 일치) | ✔ `tsc --noEmit` | 스크립트 없음 | ✔ `tsc -b && vite build` (index 0.8KB · css 27KB · js 250KB) |

  - pnpm 10이 의존성 빌드 스크립트를 기본 차단한다는 경고가 두 곳 모두 떴다(`pnpm approve-builds`). 빌드 · 테스트에는 영향 없었다.
  - ESLint는 없고 `lint`는 타입 검사다. checks의 Node 잡 통과 기준(`lint` · `build` 존재)은 충족.
  - `db-init`은 Python 잡 전용이라 현재 사실상 미사용(값은 두어도 무해).
- 빠진 스크립트 · lockfile: 없음. (FE `test` 스크립트는 없지만 checks가 요구하지 않는다.)
- 그 외 잡: vuln-scan(fs) · image-scan(Trivy HIGH+) · iac-scan(`infra`) · secret-scan · license-scan · config-guard. `.trivyignore`는 AWS IaC 예외 3건(AWS-0040 · 0041 · 0104)만 있다.

## 산출물 점검 (artifacts.md 규칙 대비)
| 산출물 | 상태 | 비고 |
|---|---|---|
| `be/Dockerfile`, `be/.dockerignore` | ✔ 규칙 충족 | 위 표 |
| `fe/Dockerfile`, `fe/.dockerignore` | △ | `apk upgrade`가 tiff 한정(B-5). 나머지 충족 |
| `deploy/values-be.yaml` | ✔ | `containerPort` · `service.port` 8000, `probe.path: /health`, `envFromSecrets: [demo-app-db]`, `migration.enabled` + `secretName`, `metrics.port: 8000`은 코드의 `/metrics`가 앱 포트에 있으므로 일치. `image.tag: ""` ✔. Ingress 없음 ✔ |
| `deploy/values-fe.yaml` | △ | `containerPort: 3000` = nginx ✔, `probe.path: /` ✔, `ingress.enabled: true` ✔, resources 명시. `metrics.port: 4040` + `nginxLogExporter.enabled`는 nginx.conf의 syslog `127.0.0.1:5531`과 짝을 이루는 차트 기능으로 보이나 차트 본문은 이 레포에 없어 포트 계약을 확인 못 함(가정 6). Ingress `healthcheckPath` 기본 `/health`가 BE로 프록시되는 문제는 그대로(B-4) |
| `deploy/aws/values.yaml` · `deploy/onprem/values.yaml` | ✔ | 규칙대로 `replicas: 1`, onprem `ingress.enabled: false` |
| `deploy/gcp/values.yaml` | △ | `env.PGSSL: require`는 postgres.js가 읽지 않아 무효. gcp는 브리프 대상이 아니라 우선순위 낮음 |
| `.deploy/smoke.json` | ✔ | BE 6개 · FE 2개 경로가 모두 현재 코드에 존재. `POST /api/guestbook {}` → 코드가 400 반환 ✔. `/no-such-page` → `try_files … /index.html` 200 ✔. 신설 `/metrics`(200) 추가는 선택(B-6) |
| `.deploy/plan.yaml` | ✖ 브리프와 불일치 | `target: onprem`인데 새 브리프는 AWS. `services` 항목(포트 · health · migration)은 코드와 일치 |
| `.github/workflows/deploy.yml` 호출부 | ✔ 입력 일치 | `services` JSON = plan.yaml 순서 · 값과 일치. 검사 입력 위 참조 |
| 버전 표기 | ✖ 세 갈래 | `config.yaml template_version: v2.1.2` ↔ 워크플로 `deploy/infra/rollout @v2.1.3`, `template-ref: v2.1.3` ↔ `chart-version: 2.1.2` ↔ `onprem-verify @v2.1.2` ↔ onprem tf `ref=v2.1.2` ↔ aws · gcp tf `ref=v1.16.0`(config `infra_versions`로 의도적 고정, `variables.tf chart_version 1.16.0`). artifacts.md "세 참조가 모두 `template_version`과 같아야 한다"에 어긋난다. `config.yaml`의 `infra_versions`는 규칙이 허용하지 않는 추가 키(CODEOWNERS 리뷰 대상). **이 분석은 config.yaml을 건드리지 않는다** — 정합은 provision · 사람 결정 몫 |

## 필요한 코드 수정
### (a) 배포에 필요 — AWS 대상에서 지금 코드가 의도대로 돌지 않는 것
- **A-1. BE가 `PG_URL`을 우선 읽게** (`be/src/db/index.ts`): `process.env.PG_URL || process.env.DATABASE_URL || <로컬 기본값>`. 근거: Secret의 `DATABASE_URL`에는 sslmode가 없고(가정 4), RDS Postgres 15+는 기본 `rds.force_ssl=1`이라 평문 접속이 거부된다. 거부되면 앱은 **조용히 메모리 모드로 떠서** `/health` 200 · smoke 통과 · 승격까지 되고 데이터만 사라진다. 마이그레이션 Job은 `psql "$PG_URL"`이라 성공하므로 더 눈에 띄지 않는다. postgres.js는 `?sslmode=require`를 `ssl: 'require'`(인증서 미검증)로 처리하므로 코드 한 줄로 끝난다. 온프레미스에서 돌던 것이 AWS에서 깨지는 유일한 코드 요인이다.

### (b) 권장 — 운영 정합성 · 품질
- **B-1. `db/init.sql` `guestbook` 시드 재실행 안전화**: `INSERT … SELECT … WHERE NOT EXISTS (SELECT 1 FROM guestbook)` 또는 시드 제거. 배포마다 2건씩 쌓인다.
- **B-2. FE `package.json`의 `dev@0.1.5` 제거**: #44에서 들어온 미사용 의존성(`node-dev` 재시작 도구, 네이티브 `inotify` 의존). 소스 어디서도 import하지 않는다. 빌드는 통과하지만(pnpm이 빌드 스크립트를 막음) `regulated` 레포의 공급망 · license-scan 표면을 키운다. `pnpm remove dev` 후 lockfile 커밋.
- **B-3. DB 재연결 정합**: 기동 실패 후 DB가 살아나면 `checkDbHealth` 성공 시점에 `db = drizzle(sqlClient, { schema })`를 만들어 `/health`와 실제 저장 경로를 맞춘다. (폴백 자체를 유지할지는 C-3.)
- **B-4. FE Ingress 헬스 경로**: `ingress.healthcheckPath` 기본 `/health`가 BE로 프록시되어 ALB 타깃 헬스가 BE에 묶인다. values-fe에 `ingress.healthcheckPath: /`를 두거나 nginx에 `location = /healthz { return 200; }`를 추가. AWS가 대상이 되면서 실제로 영향을 받는다.
- **B-5. `fe/Dockerfile`의 `apk upgrade --no-cache tiff` → `apk upgrade --no-cache`**: 규칙은 베이스 전체 패치. 새 CVE가 나오면 image-scan에서 막힌다.
- **B-6. README 정합**: API 표에 `/metrics`, `/api/metrics`, `/api/chaos*` 추가, `APP_ENV` 삭제(실제는 `NODE_ENV`), 검사 명령에 `pnpm lint` · `pnpm test` 추가. smoke에 `GET /metrics → 200` 추가 여부는 provision에서 판단.
- **B-7. `deploy/gcp/values.yaml` `PGSSL`**: A-1을 적용하면 불필요해지므로 삭제. (gcp는 대상 아님.)

### (c) 동작을 바꾸는 것 — 사람이 결정
- **C-1. `/api/chaos` 보호**: 인증 없이 FE 공개 주소에서 `POST /api/chaos {errorRate:1}`로 누구나 전 요청을 500으로 만들 수 있다. 시연 기능이라 지우자는 뜻이 아니다. 선택지: ① `CHAOS_ENABLED`(기본 off) 환경변수로 등록 자체를 막고 시연 환경(test)에서만 켠다, ② 간단한 토큰 헤더, ③ 그대로 둔다(시연용 · 하루 100명이면 수용 가능하다는 판단). 민감 데이터 `예` 브리프라 ③은 보안 분석기가 반대할 가능성이 높다.
- **C-2. 헬스 경로를 장애 주입에서 제외할지**: 지금은 `errorRate` · `latencyMs`가 `/health` · `/healthz/liveness`에도 걸린다. `errorRate: 1.0`이면 readiness 실패 → replica 1이라 Service에서 빠짐, liveness가 같은 경로면 재시작 루프. `latencyMs: 2500`은 프로브 타임아웃(차트 기본값 미확인)을 넘길 수 있다. "장애 주입이 k8s 자가 치유를 유발하는 것"이 시연 의도일 수 있어 사람이 정한다. 제외하려면 `be/src/index.ts` 훅의 제외 목록에 `/health`, `/healthz/`를 넣으면 된다.
- **C-3. 인메모리 폴백을 운영에서 유지할지**: 유지하면 DB 장애가 readiness에 드러나지 않는다. 최소안은 `/health`의 `database` 필드를 승격 판단(promote-judge)이 보게 하는 것, 강한 안은 `NODE_ENV=production`에서 폴백 시 503. README가 폴백을 시연 안전망으로 명시하므로 결정 필요.
- **C-4. 민감 데이터 관점의 입력 처리**: 방명록은 이름 50자 · 메시지 500자 trim 외에 검증 · 레이트리밋 · CORS 제한(`origin: true`)이 없다. 시연용 공개 방명록에 실제 개인정보가 들어오면 그대로 RDS에 남는다. 레이트리밋(`@fastify/rate-limit`)과 보존 정책은 요구사항 결정 사항.

## 확인 못 한 것
- Secret `demo-app-db`의 `DATABASE_URL` · `PG_URL` 실제 형식: 이 실행은 앱 레포 안에서만 조사했고 platform의 service-base 차트는 열지 않았다. A-1의 근거는 이전 분석의 관찰을 그대로 가져온 것이다(가정 4). 어느 쪽이든 `PG_URL` 우선 읽기는 해롭지 않다.
- App Chart 본문(프로브 timeout · liveness 경로 · `metrics.nginxLogExporter`가 여는 포트 · syslog 수신 주소)은 이 레포에 없다. values-fe의 `4040`/nginx.conf의 `5531` 짝은 #40 작성자의 검증 기록(`infra/T17-VALIDATION.md`)을 믿었다.
- 검사는 로컬 Node 24.10으로 돌렸다. checks.yml은 Node 22(가정 2)이며 tsconfig `target: ES2022`라 차이가 날 요소는 없지만 같은 버전으로 재실행하지는 않았다.
- `nginxinc/nginx-unprivileged`가 `/tmp` 밖에 쓰는지는 이미지 소스가 레포에 없어 확인 못 함(가정 1). docker는 이 실행에서 돌리지 않았다.
- AWS RDS 모듈의 파라미터 그룹 · `rds.force_ssl` 실제 값은 platform 모듈 안이라 확정 못 함. A-1은 "RDS 기본값이면 실패"가 근거다.
- Blue-Green 중 스키마 변경 시 하위 호환 전략은 레포에 없다(현재 스키마 변경 없음).
- `fe/src/App.tsx`(964줄)는 API 호출부 · 폴링 · 부하 생성기 · 관리자 패널 옵션만 읽었다. UI 세부는 보지 않았다.

## 가정
1. **FE 쓰기 경로 = `/tmp`만**: `nginxinc/nginx-unprivileged`는 pid와 `*_temp_path`를 `/tmp`로 두는 이미지이고 `fe/Dockerfile` 주석도 같은 전제. 차트 기본 `writablePaths: [/tmp]`로 충분하다고 본다.
2. **Node 런타임 22**: `.nvmrc` · `engines` 없음. 두 Dockerfile의 `node:22-alpine`과 이전 분석이 확인한 checks `node-version: 22`를 기준으로 잡았다.
3. **서비스 포트 계약**: BE Service 8000은 FE nginx의 `demo-app-be:8000` 하드코딩에 맞춘 것이며, 두 서비스가 같은 네임스페이스에 뜬다(deploy.yml이 같은 `namespace`로 올린다).
4. **DB Secret 키 형식**: `DATABASE_URL`은 psycopg 스킴 · sslmode 없음, `PG_URL`은 `?sslmode=require`. 이전 분석(2026-10-09)의 관찰을 이번 실행에서 재검증하지 못했다.
5. **마이그레이션 = `db/init.sql` 재실행**: Drizzle 마이그레이션 산출물이 없으므로 향후 스키마 변경도 `init.sql`에 idempotent SQL을 덧붙이는 방식으로 간다.
6. **nginx 계측 사이드카**: `metrics.nginxLogExporter.enabled`가 `127.0.0.1:5531` syslog를 받고 `4040`으로 Prometheus에 노출하는 차트 기능이라고 본다. 틀려도 nginx 서빙에는 영향 없다(UDP syslog).
7. **AWS 우선**: 브리프 선호 대상이 AWS라 "외부 노출" · Ingress · TLS 판단은 aws(ALB Ingress, RDS) 기준이고 onprem 차이는 병기했다. `.deploy/plan.yaml`과 deploy.yml 기본 `DEPLOY_TARGET`은 아직 onprem이다.
8. **장애 주입 · 인메모리 폴백은 시연 의도**: README · PR #44 제목이 명시하므로 "버그"가 아니라 결정 항목(c)으로 분류했다.
9. **replica 1**: aws · onprem 값 파일이 `replicas: 1`이라 파드별 인메모리 상태(`chaosState`, `/api/metrics` 버킷)가 실제로는 단일 값으로 보인다고 가정했다. Blue-Green 전환 창에서만 두 파드가 공존한다.
