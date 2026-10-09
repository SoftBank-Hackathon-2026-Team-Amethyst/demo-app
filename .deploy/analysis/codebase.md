# 코드베이스 분석

브리프: 하루 100명 이하 · 월 10만 원 이하 · 민감 데이터 미정(`regulated`) · 선호 대상 온프레미스 · 일반 운영.
레포는 이미 한 차례 배포 산출물(Dockerfile · `deploy/` 값 파일 · `infra/envs/{aws,onprem}` · 워크플로)을 갖고 있다. 이 분석은 그 산출물이 코드와 App Chart 조건에 맞는지까지 본다.

## 서비스
| 이름 | 경로 | 스택 | 실행 명령 | 포트 | 헬스체크 | Dockerfile | 외부 노출 |
|---|---|---|---|---|---|---|---|
| demo-app-be | `be/` | Node 22 (alpine) · TypeScript 5.9 · Fastify 5.12 · Drizzle ORM 0.45 · postgres.js 3.4 · pnpm 10.28.1 | 빌드 `pnpm build`(tsc) → 실행 `node dist/index.js` | 8000 (`PORT`, 기본 8000, `HOST` 0.0.0.0) | `GET /health` (DB 상태 포함, DB 끊겨도 200) · `GET /healthz/liveness` | 있음 (`be/Dockerfile`, 3단계, `USER 1000`) | 아니오. FE nginx가 클러스터 안에서 `http://demo-app-be:8000`으로 프록시 |
| demo-app-fe | `fe/` | Node 22 빌드 → nginx-unprivileged(alpine, UID 101) 정적 서빙 · Vite 6.4 · React 19.3 · Tailwind 4.3 · pnpm 10.28.1 | 빌드 `pnpm build`(`tsc -b && vite build`) → `nginx -g 'daemon off;'` | 3000 (`fe/nginx.conf` `listen 3000`) | 없음(정적). 값 파일은 `probe.path: /`. `/health`는 BE로 프록시됨 | 있음 (`fe/Dockerfile`, 2단계, `USER 101`) | 예. aws는 ALB Ingress, onprem은 Cloudflare Quick Tunnel → `demo-app-fe.<env>.svc:80` |

- 워커 · 크론 · 큐 소비자 없음. 서비스 2개.
- FE → BE 호출은 모두 상대 경로(`fetch('/api/...')`, `fe/src/App.tsx`)라 FE 번들에 BE 주소가 들어가지 않는다. 경로 라우팅은 `fe/nginx.conf`(`/api/` · `/health` → `demo-app-be:8000`)가 맡는다.
- BE 라우트: `/health`, `/healthz/liveness`, `/api/info`, `/api/votes`, `POST /api/votes/:id`, `/api/guestbook`, `POST /api/guestbook`.
- 두 서비스 모두 `SIGTERM` 처리: BE는 `app.close()` 후 종료(`be/src/index.ts`), nginx는 기본 동작.

### 컨테이너화 점검 (App Chart 조건)
| 조건 | demo-app-be | demo-app-fe |
|---|---|---|
| non-root 숫자 UID | `USER 1000` ✔ | `USER 101` ✔ |
| 읽기 전용 루트 FS | 디스크 쓰기 없음(pino → stdout, `fs` 사용 없음) ✔ | nginx-unprivileged는 pid · temp 경로를 `/tmp`에 둠 → 차트 기본 `writablePaths: [/tmp]`로 충분 ✔ (가정 1) |
| 런타임 환경변수를 이미지에 굽지 않음 | `ENV NODE_ENV=production PORT=8000 HOST=0.0.0.0`은 기본값 수준. 비밀값 없음 ✔ | 빌드 시 환경변수 없음 ✔ |
| 그 외 | `pnpm install --frozen-lockfile \|\| pnpm install` 폴백이 lockfile 불일치를 숨김(아래 수정 목록). `HEALTHCHECK`는 busybox wget 사용 | `apk upgrade tiff`로 베이스 이미지 CVE 보정. `.trivyignore`는 AWS IaC 예외만 있음 |

## 데이터 저장소
- **PostgreSQL 17** 하나. 로컬은 `docker-compose.yml`(`postgres:17-alpine`, 볼륨 `postgres_data`, `db/init.sql`을 `/docker-entrypoint-initdb.d`에 마운트).
- 스키마: `db/init.sql` — `votes`, `guestbook` 두 테이블 + 시드. Drizzle 스키마(`be/src/db/schema.ts`)는 같은 모양이고 `drizzle-kit`은 devDependency로만 있으며 `drizzle.config.ts` · 마이그레이션 디렉터리 · 스크립트가 없다. 즉 **마이그레이션 도구는 없고 `db/init.sql`이 유일한 스키마 소스**다.
- 배포 시 적용: App Chart `migration.enabled: true` + `--set-file migration.sql=db/init.sql`(deploy.yml `services[].migration`) → pre-install/pre-upgrade Job이 `psql "$PG_URL" -v ON_ERROR_STOP=1`로 매 배포마다 실행.
  - `CREATE TABLE IF NOT EXISTS`, `votes` 시드 `ON CONFLICT (option_key) DO NOTHING`은 재실행 안전.
  - **`guestbook` 시드는 재실행 안전하지 않다.** `ON CONFLICT DO NOTHING`에 충돌 대상이 없고 `guestbook`에 unique 제약이 없어, 배포마다 시드 2건이 다시 들어간다.
- 운영 DB는 플랫폼 모듈이 만든다: onprem은 환경(test · prod)마다 StatefulSet Postgres 17(`ssl=on`, 자체 서명 인증서, 5Gi), aws는 RDS Postgres 17 `db.t4g.micro`. 접속 정보는 service-base 차트가 Secret `demo-app-db`로 각 네임스페이스에 만든다.
- SQLite · 파일 저장 등 다중 인스턴스를 막는 저장소 없음.

## 상태
- **인메모리 폴백** (`be/src/db/index.ts` `memoryFallback`): 기동 시 DB 연결 실패(connect_timeout 2s)면 프로세스 메모리로 투표 · 방명록을 처리하고 `/health`는 여전히 `200 {database: "fallback-memory"}`를 돌려준다. 결과:
  - replica ≥ 2이거나 Blue-Green 전환 중이면 파드마다 다른 데이터가 보인다.
  - readiness가 DB 장애를 드러내지 않아 Rollout과 승격 판단이 "정상"으로 본다. 데모 안전망이 운영에서는 장애 은폐가 된다(아래 수정 목록).
  - 기동 때 실패하면 `sqlClient`가 null로 남아 이후 DB가 살아나도 재연결하지 않는다(`checkDbHealth`는 `sqlClient` 없으면 false).
- 업로드 · 세션 · 서버 캐시 없음. 1인 1투표 제한은 브라우저 `localStorage`(`demo_voted_option`)만 사용 — 서버 상태 아님.
- 로그는 stdout(pino / nginx). 디스크에 쓰는 것 없음.

## 환경변수
| 서비스 | 이름 | 출처 | 읽는 시점 |
|---|---|---|---|
| demo-app-be | `DATABASE_URL` | Secret `demo-app-db`(`envFromSecrets`). 코드 기본값은 로컬 compose 주소. **주의**: 이 Secret의 `DATABASE_URL`은 `postgresql+psycopg://…`(Python용, sslmode 없음), `PG_URL`은 `postgresql://…?sslmode=require`다. postgres.js는 스킴을 무시하고 host · 자격증명만 읽으므로 접속은 되지만 TLS를 쓰지 않는다(아래 수정 목록) | 실행 (기동 시 1회) |
| demo-app-be | `PG_URL` | Secret `demo-app-db`. 현재 코드는 읽지 않음 — 읽도록 바꾸는 것이 권장 | 실행 |
| demo-app-be | `PORT` | 고정값. Dockerfile `ENV PORT=8000`, 차트 `containerPort: 8000` 일치 | 실행 |
| demo-app-be | `HOST` | 고정값 `0.0.0.0`(Dockerfile) | 실행 |
| demo-app-be | `APP_VERSION` | `env`(deploy/values-be.yaml `v1.0.0`). v2 접두면 테마 전환. 데모용 | 실행 (요청마다) |
| demo-app-be | `NODE_ENV` | Dockerfile `production`. `/api/info`의 `env`로 노출 | 실행 |
| demo-app-be | `LOG_LEVEL` | 선택. 기본 `info` | 실행 |
| demo-app-be | `HOSTNAME` / `POD_NAME` / `REGION` | 선택. k8s가 `HOSTNAME`을 파드 이름으로 넣음. `REGION` 기본 `ap-northeast-2`(onprem에서는 사실과 다름, 표시용) | 실행 |
| demo-app-be | `APP_ENV` | README에만 있고 코드에서 읽지 않음 (README 오류) | — |
| demo-app-fe | `VITE_API_URL` | `vite.config.ts` 개발 서버 프록시 대상만. 번들 · 이미지에 들어가지 않음 | 개발 시 |
| demo-app-fe | BE 주소 | `fe/nginx.conf`에 `demo-app-be:8000` 고정 → k8s Service 이름 `demo-app-be`, `service.port: 8000`(values-be.yaml)과 일치해야 함 | 이미지 빌드 시 (설정 파일) |

- `.env.example` 없음. `.gitignore`가 `.env*`를 막고 있고 레포에 `.env` 없음.
- 비밀값 기준: DB 자격증명만. Secret은 Terraform(service-base)이 만들고 앱은 `envFromSecrets`로 받는다. 코드가 읽는 다른 비밀값 없음.

## 검사 명령 (checks.yml 입력)
- node-dirs: `["be", "fe"]` / python-dirs: `[]` / image-dirs: `["be", "fe"]` / db-init: `db/init.sql` / iac-path: `infra`
  - 현재 `.github/workflows/deploy.yml`이 정확히 이 값으로 `checks.yml@v1.8.0`을 호출한다.
- 고정 명령 충족 여부 (Node 22, pnpm):
  - `pnpm install --frozen-lockfile`: `be/pnpm-lock.yaml`, `fe/pnpm-lock.yaml` 있음(lockfileVersion 9.0, `packageManager: pnpm@10.28.1`) ✔
  - `pnpm lint`: be · fe 모두 `tsc --noEmit` ✔ (ESLint는 없음. 타입 검사만으로 통과 기준 충족)
  - `pnpm build`: be `tsc`, fe `tsc -b && vite build` ✔
  - 테스트: Node 잡은 테스트를 돌리지 않는다. `db-init`은 Python 잡에만 적용되므로 지금은 사실상 미사용(값은 두어도 무해).
- 빠진 스크립트 · lockfile: 없음.
- 그 외 잡: vuln-scan(fs) · image-scan(Dockerfile 빌드 후 Trivy HIGH+) · iac-scan(`infra`) · secret-scan · license-scan · config-guard(`.deploy/config.yaml` 형식, 현재 `template_version: v1.8.0`, `compliance: regulated` ✔).

## 필요한 코드 수정
우선순위 순. 1~3은 운영 정합성, 4~7은 품질.

1. **BE가 `PG_URL`을 우선 읽게** (`be/src/db/index.ts`): `process.env.PG_URL || process.env.DATABASE_URL || <로컬 기본값>`. 근거: Secret의 `DATABASE_URL`은 psycopg 스킴이고 sslmode가 없어 TLS 없이 붙는다. onprem Postgres는 `ssl=on`이지만 평문도 허용해 현재는 "우연히" 동작하고, 플랫폼이 TLS를 강제하는 쪽으로 바뀌거나 AWS RDS(Postgres 15+ 기본 `rds.force_ssl=1`)로 가면 연결 실패 → 조용히 메모리 모드로 떨어진다. postgres.js는 `sslmode=require`를 `ssl: 'require'`(인증서 검증 없음)로 처리하므로 자체 서명 인증서에서도 붙는다.
2. **`db/init.sql`의 `guestbook` 시드를 재실행 안전하게**: 매 배포 pre-upgrade Job이 돌 때마다 시드 2건이 중복 삽입된다. 방법 중 하나: `INSERT … SELECT … WHERE NOT EXISTS (SELECT 1 FROM guestbook)` 또는 시드 제거.
3. **DB 장애를 readiness에 드러내기**: 운영에서는 `/health`가 DB 미연결 시 503을 돌려주거나(폴백 유지 시) 최소한 `APP_ENV`/`NODE_ENV`로 폴백을 끌 수 있어야 한다. 함께 **재연결**: 기동 실패 후 `sqlClient`가 null로 고정되는 문제를 고쳐 `checkDbHealth`가 재시도하게 한다. 데모 시연 의도(README)와 충돌하므로 사람이 결정할 항목 — 최소안은 `/health`에 DB 상태를 유지하고 Rollout `probe.path`는 그대로 두되, 운영 승격 판단에 `database` 필드를 쓰는 것.
4. `be/Dockerfile` · `fe/Dockerfile`의 `pnpm install --frozen-lockfile || pnpm install` 폴백 제거: lockfile 불일치가 이미지 빌드에서 숨겨지고 checks(`--frozen-lockfile`)와 결과가 달라진다.
5. `fe/nginx.conf`의 `/health` 프록시 재검토: FE Ingress `healthcheckPath` 기본값 `/health`가 BE로 넘어가 FE 헬스가 BE에 묶인다. FE 자체 200(`return 200`) 또는 values-fe에 `ingress.healthcheckPath: /` 지정. onprem(Ingress 없음)에서는 영향 없음.
6. README 정합성: `APP_ENV`는 코드가 읽지 않음(`NODE_ENV`가 실제). 검사 명령에 `pnpm lint` 추가.
7. `infra/envs/onprem/variables.tf` `chart_version` 기본값 `1.5.1`과 `infra/envs/aws` `1.9.0`이 `.deploy/config.yaml`의 `template_version: v1.8.0`, deploy.yml `chart-version: 1.8.0`과 어긋난다. 템플릿 원칙(한 태그로 참조)에 맞게 한 값으로 맞추는 것은 provision 단계의 몫.

## 확인 못 한 것
- nginx-unprivileged 이미지가 `/tmp` 밖(`/var/cache/nginx`, `/etc/nginx` 등)에 쓰는지 — 이미지 기본 설정은 레포에 없어 소스로 확인 못 함. 이전 onprem 배포 상태 파일이 로컬에 있어 한 번은 떴던 것으로 보이나 로그는 없다(`.deploy/log/` 비어 있음).
- AWS RDS 모듈이 파라미터 그룹을 따로 두지 않아 `rds.force_ssl` 실제 값은 RDS 기본값에 의존 — 코드로 확정 못 함(수정 1의 근거는 "실패 가능성"이다).
- Blue-Green 중 두 버전이 같은 DB에 같은 스키마로 붙는 전제(현재 스키마 변경 없음) 외에, 스키마 변경 시 하위 호환 전략은 레포에 없다.
- `fe/src/App.tsx` 전체 로직은 API 호출부만 확인했다(상태 · 저장 관점). UI 세부는 보지 않았다.
- 테스트 코드가 be · fe 모두 없다. checks의 Node 잡은 테스트를 요구하지 않아 통과엔 영향 없다.
- 로컬 `infra/envs/onprem/terraform.tfstate`가 디스크에 있다. `.gitignore`로 추적되지 않음을 `git ls-files`로 확인했다. 내용은 열지 않았다.

## 가정
1. **FE 쓰기 경로 = `/tmp`만**: `nginxinc/nginx-unprivileged`는 공식적으로 pid와 `*_temp_path`를 `/tmp`로 두는 이미지이고, 레포의 `fe/Dockerfile` 주석도 같은 전제를 적고 있다. 차트 기본 `writablePaths: [/tmp]`로 충분하다고 본다.
2. **Node 런타임 22**: `.nvmrc` · `engines`가 없다. 두 Dockerfile의 `node:22-alpine`과 checks.yml의 `node-version: 22`를 기준으로 잡았다.
3. **서비스 포트 계약**: BE Service 포트 8000(values-be.yaml)은 FE nginx의 `demo-app-be:8000` 하드코딩에 맞춘 것이며, 두 서비스가 같은 네임스페이스에 뜬다고 가정했다(deploy.yml이 둘을 같은 `namespace`에 올린다).
4. **DB 접속 정보는 Secret `demo-app-db` 하나**: 환경별로 service-base가 같은 이름으로 만든다(aws · onprem Terraform 루트 모두 `secretName = "${var.service}-db"`). 앱 코드가 다른 비밀값을 읽지 않는다는 것은 `be/src` 전체 grep(`process.env`)으로 확인했다.
5. **마이그레이션 = `db/init.sql` 재실행**: Drizzle 마이그레이션 산출물이 없으므로, 향후 스키마 변경도 `init.sql`에 idempotent SQL을 덧붙이는 방식으로 간다고 가정했다.
6. **온프레미스 우선**: 브리프의 선호 대상이 onprem이고 deploy.yml 기본 `DEPLOY_TARGET`도 `onprem`이다. 분석의 "외부 노출" · Ingress 판단은 onprem(Ingress 끔, Tunnel → FE Service) 기준이며 aws 차이는 표에 병기했다.
7. **인메모리 폴백은 데모 의도**: README가 명시했으므로 "버그"가 아니라 운영 전환 시 결정이 필요한 항목으로 분류했다.
