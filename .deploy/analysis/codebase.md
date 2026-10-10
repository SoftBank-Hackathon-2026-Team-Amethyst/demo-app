# 코드베이스 분석

분석일: 2026-10-10 (yolo 재검증, 기준 커밋 b8bc6d8)
직전 분석: 2026-10-10 janto 2차(커밋 3b0caf7, PR #52). 이번 실행은 전체 재작성이 아니라 그 이후 변경(`git log 3b0caf7..HEAD`)과 PR #52 안에서 문서보다 뒤에 커밋된 코드 수정을 현재 코드로 다시 검증한 **델타 재검증**이다.
브리프: 하루 100명 이하 · 월 10만 원 이하 · 민감 데이터 **예**(`regulated`) · 선호 대상 **AWS** · 가용성 **시연용** (변화 없음).
레포는 배포 산출물(Dockerfile · `deploy/` 값 파일 · `infra/envs/{aws,gcp,onprem}` · 워크플로 · `.deploy/smoke.json`)을 이미 갖고 있고, 이 분석은 산출물이 현재 코드와 App Chart 조건, `deploy-provision/references/artifacts.md` 규칙에 맞는지까지 본다.

## 이전 분석(3b0caf7) 이후 바뀐 것

| 커밋 · PR | 코드 · 산출물 변화 | 이 분석에 미치는 영향 |
|---|---|---|
| **#51 · #52 (3b0caf7 자체)** — 직전 문서가 반영하지 못한 코드 수정 | BE `be/src/db/index.ts`: `PGSSL`/`PGSSLMODE`를 postgres.js `ssl` 옵션으로 넘기는 `sslOption()` + `db-ssl.test.ts`. `checkDbHealth`가 성공 시 `db`를 다시 만들고 `ignoreChaos` 옵션을 가짐. `/health`는 실제 DB에 못 닿으면 **503**. `preHandler` 장애 주입 훅이 `/health` · `/healthz/`를 제외. `POST /api/chaos*`는 `CHAOS_ENABLED=true`일 때만 등록(`chaos.test.ts`). `db/init.sql` guestbook 시드 `WHERE NOT EXISTS`. FE `package.json`에서 `dev` 제거. `fe/Dockerfile` `apk upgrade --no-cache` 전체. `deploy/values-be.yaml`에 `PGSSL: require` · `LOG_LEVEL: warn` · `CHAOS_ENABLED: "true"`. `deploy/values-fe.yaml`에 `ingress.healthcheckPath: /`. `.deploy/plan.yaml` `target: aws`, `deploy.yml` 기본 `DEPLOY_TARGET` aws. smoke에 `/api/chaos` · `/api/metrics` 추가. README API 표 · 환경변수 표 · 검사 명령 갱신 | 직전 문서의 **A-1 · B-1 · B-2 · B-3 · B-4 · B-5 · B-6 · C-1 · C-2가 모두 해결**됐다. A-1은 `PG_URL` 우선 읽기가 아니라 `PGSSL` 환경변수 방식으로 풀렸다(가정 4 참고). C-3는 `/health` 503으로 readiness에 드러나므로 반쯤 해결 |
| #54 FE 다국어 | `fe/src/i18n.ts`(384줄, en · ja · ko, 기본 en) 추가, `App.tsx` 1,018줄. 언어는 `localStorage`(`LANG_KEY`)에만 저장 | 서버 측 영향 없음. 번들 js 250KB → 261.5KB. 환경변수 · 빌드 시 설정 없음 |
| #53 템플릿 v2.1.4 | `.deploy/config.yaml template_version: v2.1.4`, 워크플로 4종 `@v2.1.4` | 코드 영향 없음 |
| #55 `APP_VERSION` v2.0.0 | `deploy/values-be.yaml env.APP_VERSION: v2.0.0` | `/api/info`가 `v2` 접두 → FE 테마 전환. 코드 변경 없음 |
| #56 FE p95 | 클라이언트 측 측정값에서 p95 계산(`App.tsx` 441행) | 서버 영향 없음 |
| #57 (T9) Dockerfile `--platform=$BUILDPLATFORM` | `be/Dockerfile` builder · deps 스테이지, `fe/Dockerfile` builder 스테이지가 러너 호스트 아키텍처에서 돈다. 런타임 스테이지는 `--platform` 없음(타깃 아키텍처) | BE deps 스테이지의 `node_modules`가 타깃과 다른 아키텍처에서 설치돼 복사된다. **운영 의존성 트리에 네이티브 모듈이 없음을 확인**(`pnpm ls --prod --depth Infinity`에 esbuild · fsevents 없음, `fsevents`는 devDependency `tsx` 아래만). 지금은 안전하나 네이티브 prod 의존성이 추가되면 깨진다(아래 B-1) |
| #59 (T31) Cognito 중계 | `infra/envs/aws`에 `module "preview_auth"`(`?ref=v2.2.1`), 변수 `preview_hosts` · `preview_saml_metadata_url`, 출력 `preview_auth`, `cluster_addons.readable_secret_arns`에 미리보기 시크릿 추가, `.terraform.lock.hcl` 커밋 | 앱 코드 영향 없음. aws 루트 안에서 모듈 ref가 v1.16.0과 v2.2.1로 섞임(산출물 점검) |
| #60 (T31) 템플릿 v2.2.1 | `deploy.yml` · `infra.yml` · `rollout.yml` · `onprem-verify.yml` `@v2.2.1`, `template-ref: v2.2.1`, `chart-version: 2.2.1`, `preview-host` 입력(test `green-yolo.…`, prod `green.…`). `deploy/values-fe.yaml previewAuth.enabled: true` + `issuerUrl` · `remoteKey`, onprem · gcp 값 파일은 `previewAuth.enabled: false`. **`.deploy/config.yaml`은 v2.1.4 그대로** | 버전 표기 불일치가 다시 생김(산출물 점검). FE 이미지 · nginx.conf는 그대로이고 미리보기 인증은 차트(oauth2-proxy 사이드카/Ingress로 추정, 가정 6)가 맡는다 |

직전 문서의 **정정**: "`/metrics`, `/api/metrics`, `/api/chaos`도 `/api/` 프록시를 타므로 FE 공개 주소에서 열린다"는 절반만 맞다. `fe/nginx.conf`는 `location /api/`와 `location /health`만 프록시하므로 **`/metrics`(Prometheus)는 FE 공개 주소에서 열리지 않는다**(README 44행도 같은 설명). `/api/metrics` · `/api/chaos`는 열린다.

## 서비스
| 이름 | 경로 | 스택 | 실행 명령 | 포트 | 헬스체크 | Dockerfile | 외부 노출 |
|---|---|---|---|---|---|---|---|
| demo-app-be | `be/` | Node 22(alpine) · TypeScript 5.9 · Fastify 5 · Drizzle ORM 0.45 · postgres.js 3.4 · `@prometheus-io/client` 0.16.1 · pino · pnpm 10.28.1 | 빌드 `pnpm build`(tsc) → 실행 `node dist/index.js` | 8000 (`PORT` 기본 8000, `HOST` 0.0.0.0) | `GET /health`: DB 연결 시 200, 메모리 폴백이면 **503** `{status: degraded, database: fallback-memory}`; 장애 주입 `dbError`는 본문 `chaosDbError`로만 표시. `GET /healthz/liveness` 항상 200 | 있음 (3단계, `USER 1000`, builder · deps `--platform=$BUILDPLATFORM`) | 아니오. FE nginx가 클러스터 안에서 `http://demo-app-be:8000`으로 `/api/`, `/health`를 프록시 |
| demo-app-fe | `fe/` | Node 22 빌드 → `nginxinc/nginx-unprivileged:alpine`(UID 101) 정적 서빙 · Vite 6.4 · React 19 · Tailwind 4 · lucide-react · pnpm 10.28.1 | 빌드 `pnpm build`(`tsc -b && vite build`) → `nginx -g 'daemon off;'` | 3000 (`fe/nginx.conf` `listen 3000`) | 없음(정적). 값 파일 `probe.path: /`, `ingress.healthcheckPath: /` | 있음 (2단계, `USER 101`, builder `--platform=$BUILDPLATFORM`) | 예. aws는 ALB Ingress(`ingress.enabled: true`) + green 미리보기 호스트(previewAuth), onprem은 Quick Tunnel → Service |

- 워커 · 크론 · 큐 소비자 없음. 서비스 2개.
- FE → BE 호출은 전부 상대 경로(`fetch('/api/...')`, `App.tsx` 10곳)라 번들에 BE 주소 · 환경변수가 없다. i18n도 번들 내장이다.
- BE 라우트: `/health`, `/healthz/liveness`, `/metrics`, `/api/info`, `/api/metrics`, `/api/votes`, `POST /api/votes/:id`, `/api/guestbook`, `POST /api/guestbook`, `GET /api/chaos`(항상), `POST /api/chaos` · `POST /api/chaos/reset`(`CHAOS_ENABLED=true`일 때만 등록, 아니면 404). README API 표와 일치.
- `preHandler` 장애 주입 훅은 `/metrics`, `/health`, `/healthz/*`, `/api/chaos*`, `/api/metrics*`를 제외한다. 즉 지연 · 에러율은 `/api/info` · `/api/votes*` · `/api/guestbook*`에만 걸린다.
- FE 브라우저 한 탭당 `/api/info` 1 req/s + `/api/metrics` 1 req/s(상시), 부하 생성기 켜면 `/api/votes`에 최대 60 req/s 추가(트래픽 분석기 입력, 변화 없음).
- `SIGTERM` 처리: BE `app.close()` 후 종료, nginx 기본 동작.
- 테스트 4파일 8개: chaos 게이트 3, PGSSL 해석 3, 계측 제외 1, 통합(실제 진입 파일을 자식 프로세스로 띄워 `DATABASE_URL`을 닿지 않는 포트로 주고 메모리 폴백 + chaos 검증) 1.

### 컨테이너화 점검 (App Chart 조건 + artifacts.md 규칙)
| 조건 | demo-app-be (`be/Dockerfile`) | demo-app-fe (`fe/Dockerfile`) |
|---|---|---|
| non-root 숫자 UID | `USER 1000` ✔ | `USER 101` ✔ |
| 읽기 전용 루트 FS | 디스크 쓰기 없음(pino → stdout, `fs` 쓰기 없음) ✔ | nginx-unprivileged가 pid · temp를 `/tmp`에 둠 → 차트 기본 `writablePaths: [/tmp]`(가정 1) ✔ |
| 다단계, 런타임에 패키지 매니저 없음 | 3단계. runner에서 npm · corepack · yarn 삭제 ✔ | 2단계. 런타임은 nginx만 ✔ |
| 런타임 환경변수를 굽지 않음 | `ENV NODE_ENV PORT HOST`는 기본값 수준, 비밀값 없음 ✔ | 빌드 시 환경변수 없음 ✔ |
| lockfile 고정 | `--frozen-lockfile`만 사용 ✔ | 동일 ✔ |
| 베이스 이미지 보안 패치 | `apk upgrade --no-cache` ✔ | `apk upgrade --no-cache` 전체 ✔ (직전 B-5 해결) |
| 교차 아키텍처 빌드 (#57) | deps 스테이지가 `$BUILDPLATFORM`에서 `pnpm install --prod` 후 복사. 운영 의존성에 네이티브 모듈 없음 확인 ✔ (B-1 참고) | builder만 `$BUILDPLATFORM`, 산출물은 정적 파일 ✔ |
| `.dockerignore` | `node_modules dist .git .env .env.* *.md Dockerfile .dockerignore` ✔ (`tests/`는 없지만 `src`만 COPY) | 동일 ✔ (`src/i18n.ts` 포함) |
| 포트 계약 | `ENV PORT=8000` = `containerPort: 8000` = `service.port: 8000` = nginx `demo-app-be:8000` ✔ | `EXPOSE 3000` = `listen 3000` = `containerPort: 3000` ✔ |
| Docker `HEALTHCHECK` | busybox `wget … /health`(k8s는 무시, compose 용) — 메모리 폴백이면 503이라 unhealthy로 보임. 의도와 일치 | 없음 |

## 데이터 저장소
- **PostgreSQL 17** 하나. 로컬은 `docker-compose.yml`(`postgres:17-alpine`, `db/init.sql`을 `/docker-entrypoint-initdb.d`에 마운트).
- 스키마: `db/init.sql` — `votes`, `guestbook` + 시드. Drizzle 스키마(`be/src/db/schema.ts`)는 같은 모양. `drizzle-kit`은 devDependency로만 있고 마이그레이션 산출물 · 스크립트 없음. **`db/init.sql`이 유일한 스키마 소스**(변화 없음).
- 배포 시 적용: `migration.enabled: true` + `secretName: demo-app-db` + deploy.yml `services[].migration: db/init.sql` → pre-install/pre-upgrade Job이 매 배포마다 실행. `CREATE TABLE IF NOT EXISTS`, votes `ON CONFLICT DO NOTHING`, guestbook `WHERE NOT EXISTS (SELECT 1 FROM guestbook)` — **전부 재실행 안전** ✔ (직전 B-1 해결).
- 운영 DB: aws는 RDS Postgres 17 `db.t4g.micro` 20GB 단일 AZ(test · prod가 **같은 RDS**), onprem은 환경마다 StatefulSet. 접속 정보는 service-base 차트(`chart_version 1.16.0`)가 Secret `demo-app-db`로 각 네임스페이스에 만든다.
- TLS: `deploy/values-be.yaml env.PGSSL: require` → `sslOption()` → postgres.js `ssl: 'require'`(인증서 미검증). 세 대상 공통.
- SQLite · 파일 저장 등 다중 인스턴스를 막는 저장소 없음.

## 상태
- **인메모리 폴백**(`memoryFallback`): 기동 시 연결 실패(connect_timeout 2s)면 투표 · 방명록을 프로세스 메모리로 처리. 현재 동작:
  - `/health`가 **503**이라 readiness · 승격 smoke(`/health expect 200`)가 실패한다 → DB 장애가 숨지 않는다(직전 C-3의 최소안 달성).
  - 기동 실패 뒤 DB가 살아나면 `checkDbHealth` 성공 시 `db = drizzle(...)`를 만들어 저장 경로와 `/health`가 일치한다(직전 B-3 해결).
  - replica 1(aws · onprem)이라 파드가 Service에서 빠지면 FE는 BE 다운으로 표시한다. Blue-Green 전환 창에서만 두 파드 공존.
- **장애 주입 상태**(`chaosState`): 파드별 인메모리 싱글톤. `dbError: true`면 데이터 라우트만 메모리로 떨어지고 readiness는 유지. 파드 재시작 · green 파드는 초기 상태.
- **대시보드 지표**(`be/src/routes/metrics.ts`): 60초 창 인메모리 버킷, 파드 1개 기준.
- 업로드 · 세션 · 서버 캐시 없음. 브라우저 `localStorage`에 투표 여부(`demo_voted_option`)와 언어(#54)만 저장.
- 로그: stdout(pino level은 값 파일 `LOG_LEVEL: warn`; `[DB]` 기동 메시지는 `console.*`라 그대로 찍힌다). nginx 계측 로그는 `syslog:server=127.0.0.1:5531`(UDP)로 보내 수신 사이드카가 없어도 nginx는 멈추지 않는다.

## 환경변수
| 서비스 | 이름 | 출처 | 읽는 시점 |
|---|---|---|---|
| demo-app-be | `DATABASE_URL` | Secret `demo-app-db`(`envFromSecrets`). 코드 기본값은 로컬 compose 주소 | 실행 (기동 시 1회) |
| demo-app-be | `PGSSL` (또는 `PGSSLMODE`) | `env`(values-be.yaml `require`, gcp 값 파일도 `require`). 비움 · `disable`이면 TLS 없음, `allow`·`prefer`·`verify-full`은 그대로, 그 외는 `require` | 실행 (기동 시 1회) |
| demo-app-be | `PG_URL` | Secret `demo-app-db`에 있으나 **코드는 읽지 않음**(변화 없음, 해롭지 않음) | — |
| demo-app-be | `CHAOS_ENABLED` | `env`(values-be.yaml `"true"`). `true|1|yes|on`이면 `POST /api/chaos*` 등록. **values-be.yaml은 test · prod 공통**이고 `deploy/aws/values.yaml`에 덮어쓰기가 없어 prod도 열린다(C-1) | 실행 (라우트 등록 시) |
| demo-app-be | `PORT` / `HOST` | Dockerfile `ENV PORT=8000 HOST=0.0.0.0`, 차트 `containerPort: 8000` 일치 | 실행 |
| demo-app-be | `APP_VERSION` | `env`(values-be.yaml `v2.0.0`). `v2` 접두면 FE 테마 전환 | 실행 (요청마다) |
| demo-app-be | `NODE_ENV` | Dockerfile `production`. `/api/info`의 `env`로 노출 | 실행 |
| demo-app-be | `LOG_LEVEL` | `env`(values-be.yaml `warn`). 기본 `info` | 실행 |
| demo-app-be | `HOSTNAME` / `POD_NAME` / `REGION` | 선택. k8s가 `HOSTNAME`을 파드 이름으로 넣음. `REGION` 기본 `ap-northeast-2`, gcp 값 파일 `asia-northeast3` | 실행 (요청마다) |
| demo-app-fe | `VITE_API_URL` | `vite.config.ts` 개발 서버 프록시 대상만. 번들 · 이미지에 들어가지 않음 | 개발 시 |
| demo-app-fe | BE 주소 | `fe/nginx.conf` `demo-app-be:8000` 고정 → k8s Service 이름 · `service.port`와 일치 | 이미지 빌드 시 (설정 파일) |
| demo-app-fe | `previewAuth.*` | 차트 값(values-fe.yaml): Cognito `issuerUrl` + Secrets Manager `remoteKey`. 앱 코드가 읽는 값이 아니라 차트가 미리보기 인증 구성에 쓴다(가정 6) | 배포 시 (차트) |

- `.env.example` 없음. `.gitignore`가 `.env*`를 막고 레포에 `.env` · `*.tfstate` 없음(`git status --ignored` 확인; 무시 항목은 `be/dist`, `fe/dist`, `infra/envs/*/.terraform`뿐).
- `be/src` 전체 `process.env` 사용처는 위 목록이 전부(`grep` 확인). README 환경변수 표의 `APP_ENV`는 제거됨.
- 비밀값은 DB 자격증명(Secret)뿐. `previewAuth.remoteKey`는 Secrets Manager **ARN**(계정 ID 포함)이고 값 자체는 아니다.
- FE `index.html`이 Pretendard 웹폰트를 `cdn.jsdelivr.net`에서 받는다(브라우저 → CDN, 변화 없음).

## 검사 명령 (checks.yml 입력)
- node-dirs: `["be", "fe"]` / python-dirs: `[]` / image-dirs: `["be", "fe"]` / db-init: `db/init.sql` / iac-path: `infra`
  - `.github/workflows/deploy.yml`이 정확히 이 값으로 `checks.yml@v2.2.1`을 호출한다.
- 이번 실행 결과 (Node 24.10.0 · pnpm 10.28.1, 2026-10-10, 커밋 b8bc6d8):

| 디렉터리 | `pnpm install --frozen-lockfile` | `pnpm lint` | `pnpm test` | `pnpm build` |
|---|---|---|---|---|
| `be` | ✔ "Lockfile is up to date" | ✔ `tsc --noEmit` | ✔ **8/8 통과** (chaos 3 · db-ssl 3 · metrics 1 · 통합 1, 0.63초) | ✔ `tsc` |
| `fe` | ✔ "Lockfile is up to date" | ✔ `tsc --noEmit` | 스크립트 없음(checks가 요구하지 않음) | ✔ `tsc -b && vite build` (index 0.80KB · css 27.71KB · js 261.51KB, 30 modules, 0.96초) |

  - pnpm 10이 의존성 빌드 스크립트(esbuild)를 기본 차단한다는 경고가 두 곳 모두 떴다(`pnpm approve-builds`). 빌드 · 테스트 결과에 영향 없음.
  - ESLint는 없고 `lint`는 타입 검사다. checks의 Node 잡 통과 기준(`lint` · `build` 존재, lockfile 존재)은 충족.
- 빠진 스크립트 · lockfile: 없음.
- 그 외 잡: vuln-scan · image-scan(Trivy HIGH+) · iac-scan(`infra`) · secret-scan · license-scan · config-guard. `.trivyignore`는 AWS IaC 예외 3건(AWS-0040 · 0041 · 0104)만 있다.

## 산출물 점검 (artifacts.md 규칙 대비)

`bash deploy-provision/scripts/check-artifacts.sh .` 실행 결과 — **문제 12건, exit 1**. 전부 버전 표기 불일치이고 코드 · 포트 · 입력 계약 문제는 없었다:

```
✗ .github/workflows/deploy.yml: uses@ 버전이 v2.1.4 과 다르다: (60·74·88·117행 checks/pr-ready/deploy @v2.2.1)
✗ .github/workflows/deploy.yml: template-ref가 v2.1.4 과 다르다: (62·76·106·133행 v2.2.1)
✗ .github/workflows/deploy.yml: chart-version이 2.1.4 과 다르다: (105·132행 2.2.1)
✗ .github/workflows/infra.yml: uses@ 버전이 v2.1.4 과 다르다: (41·54행 @v2.2.1)
✗ .github/workflows/infra.yml: template-ref가 v2.1.4 과 다르다: (46·60행 v2.2.1)
✗ .github/workflows/onprem-verify.yml: uses@ 버전이 v2.1.4 과 다르다: (14행 @v2.2.1)
✗ .github/workflows/onprem-verify.yml: template-ref가 v2.1.4 과 다르다: (21행 v2.2.1)
✗ .github/workflows/rollout.yml: uses@ 버전이 v2.1.4 과 다르다: (20행 @v2.2.1)
✗ .github/workflows/rollout.yml: template-ref가 v2.1.4 과 다르다: (32행 v2.2.1)
✗ .github/workflows/slack-notify-preview.yml: uses@ 버전이 v2.1.4 과 다르다: (28~118행 actions/slack-notify@v2.1.3 ×11)
✗ aws 모듈 ?ref= 버전이 v1.16.0 과 다르다: infra/envs/aws/main.tf:130 modules/preview_auth/aws?ref=v2.2.1
✗ onprem 모듈 ?ref= 버전이 v2.1.4 과 다르다: infra/envs/onprem/main.tf:8·30·39·45·54 ?ref=v2.1.3
문제 12 건
```

| 산출물 | 상태 | 비고 |
|---|---|---|
| `be/Dockerfile`, `be/.dockerignore` | ✔ | 위 표. `--platform=$BUILDPLATFORM`는 운영 의존성이 순수 JS인 동안 안전 |
| `fe/Dockerfile`, `fe/.dockerignore` | ✔ | 직전 B-5(apk upgrade 범위) 해결 |
| `deploy/values-be.yaml` | ✔ | `containerPort` · `service.port` 8000, `probe.path: /health`, `envFromSecrets: [demo-app-db]`, `migration`, `metrics.port: 8000`, `PGSSL` · `LOG_LEVEL` · `CHAOS_ENABLED` · `APP_VERSION v2.0.0`. `image.tag: ""` ✔. `CHAOS_ENABLED`가 prod까지 켜지는 것은 값 파일 구조상 그렇다(C-1) |
| `deploy/values-fe.yaml` | ✔ | `containerPort: 3000`, `probe.path: /`, `ingress.enabled: true`, `ingress.healthcheckPath: /`(직전 B-4 해결), resources, `metrics.port: 4040` + `nginxLogExporter`(가정 6), `previewAuth`(aws 전용, 차트 2.2.1 기능으로 추정) |
| `deploy/aws/values.yaml` · `deploy/onprem/values.yaml` · `deploy/gcp/values.yaml` | ✔ | aws `replicas: 1`; onprem `ingress.enabled: false` · `replicas: 1` · `previewAuth.enabled: false`; gcp `previewAuth.enabled: false` · `PGSSL: require`(이제 코드가 읽으므로 유효, 직전 B-7 철회) |
| `.deploy/smoke.json` | ✔ | BE 8개 · FE 2개 경로 모두 현재 코드에 존재. `/health expect 200`은 DB 연결이 전제(메모리 폴백이면 503 → 승격 차단, 의도). `GET /api/chaos`는 게이트와 무관하게 200 |
| `.deploy/plan.yaml` | ✔ | `target: aws`로 브리프와 일치. `services` 포트 · health · migration · resources · replicas가 값 파일 · 코드와 일치 |
| `.github/workflows/deploy.yml` 호출부 | ✔ 입력 일치 | `services` JSON = plan.yaml, 검사 입력 위 참조, 기본 대상 aws, `preview-host` 환경별 |
| **버전 표기** | ✖ 네 갈래 | `config.yaml template_version: v2.1.4` ↔ 워크플로 4종 `@v2.2.1` · `chart-version: 2.2.1` ↔ `slack-notify-preview.yml` 액션 `@v2.1.3` ↔ onprem tf `?ref=v2.1.3` ↔ aws tf 모듈 6개 `?ref=v1.16.0`(`config.yaml infra_versions`로 의도적 고정, `variables.tf chart_version 1.16.0`) + `preview_auth` 모듈만 `?ref=v2.2.1`. artifacts.md "참조가 모두 `template_version`과 같아야 한다"에 어긋난다. **`.deploy/config.yaml`은 CODEOWNERS 보호 파일(`/.deploy/config.yaml @silano08 …`)이라 yolo 경로가 고칠 수 없다** — v2.2.1로 올리는 것은 사람 PR 몫. `slack-notify-preview.yml` · onprem `?ref`는 보호 파일이 아니므로 provision이 v2.2.1로 맞출 수 있다(단 onprem 모듈 v2.2.1 존재 여부는 platform 레포를 열지 않아 미확인). `infra_versions` 키 자체도 규칙에 없는 추가 키 |

## 필요한 코드 수정
### (a) 배포에 필요
- **없음.** 직전 A-1(RDS TLS)은 #51의 `PGSSL` + values-be `PGSSL: require`로 해결됐고, 검사 명령 7개가 모두 통과한다. check-artifacts 12건은 버전 표기이지 코드 수정 대상이 아니다.

### (b) 권장 — 운영 정합성 · 품질
- **B-1. 교차 아키텍처 빌드 가드** (`be/Dockerfile`): deps 스테이지가 `$BUILDPLATFORM`에서 설치한 `node_modules`를 타깃 이미지에 복사한다. 지금은 운영 의존성 8개가 모두 순수 JS라 문제없지만, 네이티브 prod 의존성(예: `sharp`, `bcrypt`)이 들어오면 amd64 러너 → arm64 노드에서 기동 실패한다. 주석으로 전제를 적어 두었으니(17행) 그대로 두되, 네이티브 의존성이 추가될 때 deps 스테이지의 `--platform`을 지우는 규칙을 README에 한 줄 적는 것을 권한다.
- **B-2. `PG_URL` 정리**: Secret에 `PG_URL`(sslmode 포함)이 있지만 코드는 `DATABASE_URL` + `PGSSL`만 읽는다. 동작은 맞으므로 코드 변경은 불필요하고, README 환경변수 표에 "`PG_URL`은 마이그레이션 Job만 사용"을 적어 혼동을 줄인다.
- **B-3. 산출물 버전 정합(코드 아님)**: `slack-notify-preview.yml` 액션 11곳 `@v2.1.3` → `@v2.2.1`, `infra/envs/onprem/main.tf` 5곳 `?ref=v2.1.3` → `?ref=v2.2.1`. provision 단계 몫이며 config.yaml은 사람 PR.

### (c) 동작을 바꾸는 것 — 사람이 결정
- **C-1. prod의 `CHAOS_ENABLED`**: `deploy/values-be.yaml`이 test · prod 공통이라 prod에서도 인증 없는 `POST /api/chaos`가 열린다. README 68행은 "시연이 끝나면 끈다"고 적고 있다. 환경별 값 파일 분리(차트 · deploy.yml이 환경별 값을 받는지는 미확인)나 시연 종료 후 `"false"` 커밋 중 선택. 민감 데이터 `예` 브리프라 보안 분석기 판단 대상.
- **C-2. 인메모리 폴백의 데이터 라우트**: `/health` 503으로 readiness에는 드러나지만, 파드가 Service에서 빠지기 전 짧은 창과 `dbError` 주입 중에는 여전히 메모리에 쓴 데이터가 사라진다. 시연 안전망으로 유지할지(README 명시) 운영에서 503으로 바꿀지는 결정 사항(직전 C-3 잔여).
- **C-3. 민감 데이터 관점의 입력 처리**(직전 C-4 그대로): 방명록은 이름 50자 · 메시지 500자 trim 외에 검증 · 레이트리밋 · CORS 제한(`origin: true`)이 없다.

## 확인 못 한 것
- App Chart 2.2.1 본문(프로브 timeout · liveness 경로 · `previewAuth`가 만드는 리소스 · `metrics.nginxLogExporter`가 여는 포트)은 이 레포에 없다. `probe.path: /health`가 liveness에도 쓰인다면 메모리 폴백 503이 재시작 루프를 만든다 — readiness 전용이라고 가정(가정 7).
- Secret `demo-app-db`의 `DATABASE_URL` 실제 형식(sslmode 유무)은 platform service-base 차트를 열지 않아 미확인. `PGSSL: require`가 명시 옵션이라 어느 쪽이든 TLS로 붙는다(가정 4).
- `modules/preview_auth/aws`가 v2.2.1에만 있는지, onprem 모듈 v2.2.1이 존재하는지(B-3의 전제)는 platform 레포 미조회.
- 검사는 로컬 Node 24.10으로 돌렸다. checks.yml은 Node 22(가정 2)로 추정되며 tsconfig `target: ES2022`라 차이 요소는 없지만 같은 버전으로 재실행하지는 않았다. docker 빌드 · 멀티 아키텍처 빌드도 이 실행에서 돌리지 않았다.
- `nginxinc/nginx-unprivileged`가 `/tmp` 밖에 쓰는지는 이미지 소스가 레포에 없어 확인 못 함(가정 1).
- `fe/src/App.tsx`(1,018줄) · `i18n.ts`는 API 호출부 · 저장소 사용 · 환경변수만 읽었다. UI 세부는 보지 않았다.

## 가정
1. **FE 쓰기 경로 = `/tmp`만**: `nginxinc/nginx-unprivileged`는 pid와 `*_temp_path`를 `/tmp`로 두는 이미지이고 `fe/Dockerfile` 주석도 같은 전제. 차트 기본 `writablePaths: [/tmp]`로 충분하다고 본다.
2. **Node 런타임 22**: `.nvmrc` · `engines` 없음. 두 Dockerfile의 `node:22-alpine`을 기준으로 잡았다.
3. **서비스 포트 계약**: BE Service 8000은 FE nginx의 `demo-app-be:8000` 하드코딩에 맞춘 것이며, 두 서비스가 같은 네임스페이스에 뜬다(deploy.yml이 같은 `namespace`로 올린다).
4. **DB Secret 키 형식**: `DATABASE_URL`은 host · 자격증명 · DB명을 담고 sslmode는 없거나 `require`. 둘 중 어느 경우든 `PGSSL: require` 명시 옵션이 적용되므로 결과는 같다. `PG_URL`은 마이그레이션 Job(`psql "$PG_URL"`)만 쓴다고 본다.
5. **마이그레이션 = `db/init.sql` 재실행**: Drizzle 마이그레이션 산출물이 없으므로 향후 스키마 변경도 `init.sql`에 idempotent SQL을 덧붙이는 방식으로 간다.
6. **차트 기능 추정**: `metrics.nginxLogExporter`는 `127.0.0.1:5531` syslog를 받아 `4040`으로 노출하는 사이드카, `previewAuth`는 `preview-host`에 oauth2-proxy(Cognito OIDC)를 두는 차트 2.2.1 기능이라고 본다. 둘 다 앱 코드와 이미지에는 닿지 않는다.
7. **`probe.path`는 readiness 전용**: `/health` 503이 readiness만 떨어뜨리고 liveness(`/healthz/liveness`는 별도 경로)는 차트가 따로 쓴다고 본다. 틀리면 메모리 폴백이 재시작 루프가 된다.
8. **AWS 우선**: 브리프 선호 대상이 AWS라 "외부 노출" · Ingress · TLS · 미리보기 판단은 aws(ALB Ingress, RDS, Cognito) 기준이고 onprem · gcp 차이는 병기했다. plan.yaml · deploy.yml 기본 대상도 aws다.
9. **장애 주입 · 인메모리 폴백은 시연 의도**: README · PR #44 · #52가 명시하므로 "버그"가 아니라 결정 항목(c)으로 분류했다.
10. **replica 1**: aws · onprem 값 파일이 `replicas: 1`이라 파드별 인메모리 상태(`chaosState`, `/api/metrics` 버킷)가 단일 값으로 보인다. Blue-Green 전환 창에서만 두 파드가 공존한다.
11. **운영 의존성은 순수 JS 유지**: #57의 `--platform=$BUILDPLATFORM` deps 스테이지는 이 전제 위에서만 안전하다(`pnpm ls --prod` 확인, 2026-10-10).
