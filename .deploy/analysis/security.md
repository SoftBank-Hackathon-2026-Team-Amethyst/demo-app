# 보안 분석

조사 범위: `be/`, `fe/`, 두 Dockerfile, `docker-compose.yml`, `db/init.sql`, `deploy/`, `infra/envs/{onprem,aws}`, `.github/workflows/`, `.trivyignore`, `.github/CODEOWNERS`, `.deploy/config.yaml`. 로컬 도구: trivy 0.75.0(DB 2026-10-07), pnpm 10.28.1.

## 배포를 막는 문제

없음.

- 비밀값 커밋: `git ls-files`에 `.env*`, `*.tfstate`, `*.tfvars`, 키 파일 없음. 소스 · 워크플로 · Terraform 루트에서 키 · 토큰 · 비밀번호 패턴을 찾은 결과, 실제 값은 로컬 개발용 기본 비밀번호만 있다(아래 "배포 뒤" 참고). `.gitignore`가 `.env`, `.env.*`, `.terraform/`, `*.tfstate*`를 막고 있다. 파이프라인 `secret-scan`(gitleaks)이 다시 검사한다.
- HIGH 이상 취약점: `trivy fs --severity HIGH,CRITICAL --scanners vuln` 결과 `be/pnpm-lock.yaml` 0건, `fe/pnpm-lock.yaml` 0건. `pnpm audit`은 fe 0건, be 2건 모두 moderate(esbuild ≤0.24.2, GHSA-67mh-4wv8-2f99, `drizzle-kit` devDependency 경로). 운영 이미지는 `pnpm install --prod`라 포함되지 않는다.
- 인증 없는 관리 기능: 없음. 엔드포인트는 `/health`, `/healthz/liveness`, `/api/info`, `/api/votes`, `/api/guestbook`뿐이고 관리 · 삭제 · 설정 변경 API가 없다. Argo Rollouts 대시보드는 공개하지 않는다(포트 포워드만).

## 배포 뒤 고칠 문제

우선순위 순.

1. **lockfile 무시 fallback** — `be/Dockerfile:10`, `be/Dockerfile:25`, `fe/Dockerfile:9`의 `pnpm install --frozen-lockfile || pnpm install`. lockfile이 어긋나면 조용히 새 버전을 받아 trivy가 검사한 lockfile과 다른 의존성이 이미지에 들어간다. `|| pnpm install`을 지우고 lockfile 불일치를 빌드 실패로 둔다.
2. **CORS 전체 허용** — `be/src/index.ts:25` `origin: true`(요청 Origin을 그대로 반사). FE nginx가 같은 오리진에서 `/api`를 프록시하므로 운영에서는 CORS가 필요 없다. 플러그인을 빼거나 허용 오리진을 환경변수로 제한한다. 인증 · 쿠키가 없어 현재 위험은 낮다.
3. **쓰기 API에 속도 제한 없음** — `POST /api/votes/:id`(`be/src/routes/votes.ts:26`), `POST /api/guestbook`(`be/src/routes/guestbook.ts:32`). 1인 1투표는 FE localStorage만으로 막는다(`votes.ts:6` 주석). 누구나 무제한 투표 · 방명록 등록이 가능하고 방명록은 `TEXT`라 DB를 채울 수 있다. `@fastify/rate-limit` 또는 Ingress/Tunnel 단 제한을 붙인다.
4. **DB 연결 실패를 조용히 숨김** — `be/src/db/index.ts:36-39`에서 연결 실패 시 메모리 모드로 계속 뜨고, `/health`(`be/src/routes/health.ts:6-14`)는 DB가 끊겨도 200 `status: ok`를 돌려준다. 자격 증명 오류 · 접속 차단을 배포가 감지하지 못하고 운영에 가짜 데이터가 노출된다. 운영에서는 DB 실패를 readiness 실패로 반영하거나 fallback을 환경변수로 끈다.
5. **BE→DB 전송 암호화 미지정** — `deploy/values-be.yaml:13-14`가 `demo-app-db` Secret을 통째로 주입하고, 그 `DATABASE_URL`은 service-base 템플릿(`database-secret.yaml:18`) 기준 `sslmode` 없이 만들어진다(`PG_URL`만 `sslmode=require`). postgres.js 기본은 비암호화 연결이라 클러스터 안 BE→Postgres 구간이 평문이 될 수 있다. 온프레미스 DB는 `ssl=on`이지만 평문 연결도 받는다. 앱에서 `ssl: 'require'`를 켜거나 `PG_URL`을 쓰도록 맞춘다. 같은 Secret의 `DATABASE_URL` 스킴이 `postgresql+psycopg://`(SQLAlchemy 형식)인 점은 보안보다 연결 가능성 문제이므로 코드베이스 · 서비스 분석에서 확인한다.
6. **`/health`와 `/api/info`의 외부 노출** — `fe/nginx.conf:17-21`이 `/health`를 밖으로 프록시하고 `/api/info`(`be/src/routes/meta.ts:6-22`)는 파드 호스트명 · 환경 · 리전 · DB 연결 상태를 돌려준다. 데모 목적의 의도된 노출이지만 정보 노출이므로 운영에서는 `/health` 프록시를 지우고 `/api/info` 필드를 줄인다.
7. **`.dockerignore` 없음** — 루트 · `be/` · `fe/` 모두 없다. Dockerfile이 `src`, `package.json` 등만 COPY해 이미지에는 안 들어가지만, 빌드 컨텍스트에 `node_modules`와 로컬 `.env`가 포함된다. `node_modules`, `.env*`, `dist`를 넣는다.
8. **nginx 보안 헤더 없음** — `fe/nginx.conf`에 `X-Content-Type-Options`, `Referrer-Policy`, CSP가 없다. React가 출력을 이스케이프해 XSS 경로는 없지만 기본 헤더는 넣는다.
9. **로컬 개발 기본 비밀번호** — `docker-compose.yml:7-8`(demo/demo), `be/src/db/index.ts:5`와 `README.md:58`의 기본 `DATABASE_URL`. 운영에서는 `demo-app-db` Secret의 `DATABASE_URL`이 덮어쓰므로 쓰이지 않는다. 표시만 하고, 운영 Secret 주입이 빠지면 4번 fallback 때문에 조용히 localhost로 붙으려다 메모리 모드로 가는 점만 기억한다.
10. **이미지** — BE 런타임은 npm · corepack · yarn을 지우고(`be/Dockerfile:31-33`) UID 1000으로 실행한다. FE는 `nginx-unprivileged`(UID 101)에 `tiff`만 업그레이드(`fe/Dockerfile:22`). `apk upgrade --no-cache` 전체로 바꾸면 `image-scan`에서 걸릴 다른 패키지도 같이 올라간다. App Chart가 `runAsNonRoot` · `readOnlyRootFilesystem` · `drop ALL`을 강제하므로 두 이미지 모두 요건에 맞다.

## 노출

| 서비스 | 외부 노출 | 이유 |
|---|---|---|
| demo-app-fe (nginx :3000, Service :80) | 예 | 유일한 진입점. 온프레미스는 Cloudflare Quick Tunnel이 `demo-app-fe.<env>.svc` Service로 바로 연결(`infra/envs/onprem/main.tf:31-34`, `deploy/onprem/values.yaml` `ingress.enabled: false`). AWS는 ALB Ingress HTTPS(`deploy/values-fe.yaml:12-13`, host 있으면 80→443 리다이렉트). |
| demo-app-be (Fastify :8000) | 아니오 | FE nginx가 클러스터 안에서 `/api/`, `/health`를 `demo-app-be:8000`으로 프록시(`fe/nginx.conf:11-21`). `deploy/values-be.yaml`에 ingress 없음(차트 기본 `enabled: false`). |
| PostgreSQL (온프레미스 StatefulSet / AWS RDS) | 아니오 | 클러스터 내부 Service만. AWS는 노드 보안 그룹에서만 허용(`infra/envs/aws/main.tf:124`). 자격 증명은 External Secrets로 네임스페이스에 주입. |
| Argo Rollouts 대시보드 | 아니오 | 포트 포워드로만 연다(cluster_addons onprem 주석). |
| cloudflared metrics :2000 | 아니오 | 파드 liveness 전용, Service 없음. |
| docker-compose postgres :5432 | 로컬만 | 로컬 개발용. 배포 산출물이 아니다. |

Ingress는 FE만 켠다. 온프레미스 Quick Tunnel은 토큰 없는 `--url` 모드라 주소가 무작위이고 접근 제어(Cloudflare Access)가 없다. 100명 이하 데모에는 맞지만 운영 전환 시 Named Tunnel + Access를 검토한다.

## 규제

- 데이터 보관 위치 제한: 데이터만 사내 (확인 전 보수적 판단, "가정" 참고). DB는 온프레미스 클러스터 볼륨에 두고, 사용자 트래픽은 Cloudflare 엣지를 지나는 것을 허용한다. 민감 데이터 없음이 확인되면 "없음"으로 낮출 수 있다.
- 인프라가 제공해야 하는 설정:
  - 저장 데이터 암호화: 온프레미스 DB 모듈(k3s local-path 볼륨)은 자체 암호화가 없다. 호스트 디스크 암호화(FileVault)에 의존한다. AWS 모듈은 RDS 암호화 기본.
  - 전송 구간 암호화: 사용자↔엣지는 Cloudflare(HTTPS)/ALB(TLS 1.3 정책). 엣지↔FE, FE↔BE는 클러스터 내부 평문. BE↔DB는 "배포 뒤 5번".
  - 접근 로그: nginx access log와 Fastify pino 요청 로그가 stdout으로 나온다. 온프레미스는 보존 수단이 없다(파드 재시작 시 소실). 배포 감사 로그는 S3(`deploy.yml:23` OIDC).
  - 백업 보존: 온프레미스 DB 모듈에 백업 없음. 방명록 데이터를 지켜야 하면 볼륨 스냅샷 또는 `pg_dump` 크론을 추가한다. AWS는 RDS 자동 백업.
  - 비밀값 관리: DB 자격 증명은 Terraform `random_password` → k8s Secret → External Secrets로 주입. 온프레미스는 비밀번호가 로컬 tfstate에 남는다(모듈 주석대로 맥북 밖으로 내보내지 않는다).
  - 운영 관문: `.deploy/config.yaml` `compliance: regulated`, `CODEOWNERS`가 `config.yaml`과 자기 자신을 코드 오너 리뷰로 보호한다. 유지한다.
- 브리프 답변과 코드 발견의 불일치:
  - 브리프 "민감 데이터 취급: 모름" ↔ 코드가 저장하는 사용자 입력은 방명록 `name`(닉네임, 50자)과 `message`(자유 텍스트, 500자)뿐(`be/src/db/schema.ts:11-16`). 로그인 · 이메일 · 결제 · 금융 식별자는 없다. 다만 자유 텍스트에는 사용자가 개인정보를 적을 수 있고, 삭제 · 보존 기간 기능이 없다. `regulated` 유지가 맞고 `none`은 제안하지 않는다. 사용자에게 "방명록 자유 텍스트를 개인정보로 볼 것인지"를 확인하면 판단이 끝난다.
  - `.trivyignore`의 AWS-0040 · AWS-0041 · AWS-0104는 AWS 개발 환경 정책 예외로 근거가 적혀 있다. 온프레미스 대상에서는 적용 대상이 없어 영향 없다. 새로 넣을 예외는 없다(취약점 0건).

## 확인 못 한 것

- 컨테이너 **이미지** 취약점(베이스 `node:22-alpine`, `nginxinc/nginx-unprivileged:alpine`의 OS 패키지). 로컬에서 이미지를 빌드하지 않았다. 파이프라인 `image-scan`이 검사한다. `fe/Dockerfile:20-22`가 CVE-2026-4775(tiff)를 이미 손봤다는 점만 확인했다.
- gitleaks를 로컬에서 돌리지 않았다(설치돼 있지 않아 설치하지 않음). `git grep` 패턴 검색으로 대신했고 파이프라인 `secret-scan`이 다시 본다.
- Terraform 모듈 misconfig(`trivy config`)는 돌리지 않았다. 지시 범위(의존성 취약점)를 벗어나고, 파이프라인 `checks.yml`이 `iac-path: infra`로 검사한다.
- 온프레미스 클러스터 호스트(맥북)의 디스크 암호화 · 방화벽 · OS 패치 상태. 레포 밖이다.
- service-base `DATABASE_URL`의 `postgresql+psycopg://` 스킴을 postgres.js가 받는지(실기동 확인 필요). 보안이 아니라 연결 성립 문제라 코드베이스 · 서비스 분석에 넘긴다.

## 가정

- **데이터 보관 위치 "데이터만 사내"**: 브리프가 `handles_sensitive_data: unknown`이고 선호 대상이 온프레미스라, 확인 전까지는 저장 데이터를 사내(온프레미스 클러스터)에 두되 공개 트래픽이 Cloudflare 엣지를 지나는 것은 허용하는 중간값을 택했다. "전부 사내"는 Quick Tunnel 구조 자체와 충돌하고, "없음"은 미확인 상태에서 고를 수 없다. 사용자가 민감 데이터 없음을 확인하면 "없음"으로 바꾼다.
- **방명록 입력은 개인정보일 수 있음**: 스키마에 식별자 컬럼은 없지만 자유 텍스트라 가능성을 배제하지 않았다. 코드 근거만으로 `none`을 권하지 않는 이유다.
- **운영에서 로컬 기본 비밀번호가 쓰이지 않음**: `deploy/values-be.yaml` `envFromSecrets: [demo-app-db]`와 service-base ExternalSecret이 `DATABASE_URL`을 주입한다는 전제. Secret 생성이 실패하면 "배포 뒤 4번" fallback 때문에 조용히 메모리 모드로 가는 점은 이미 적었다.
- **esbuild moderate는 운영 이미지에 없음**: `be/Dockerfile:25`의 `pnpm install --prod`가 devDependency(`drizzle-kit`)를 제외한다는 전제. `|| pnpm install --prod` fallback도 `--prod`라 전제는 유지된다.
- **온프레미스 저장 암호화는 FileVault 의존**: 모듈이 볼륨 암호화를 하지 않으므로 호스트 디스크 암호화가 켜져 있다고 가정했다. 확인되지 않으면 "인프라가 제공해야 하는 설정"에서 미충족으로 본다.
- **trivy 결과의 신뢰 범위**: 로컬 trivy DB는 2026-10-07 갱신본이고 lockfile만 대상이다. 이틀 사이 공개된 취약점은 파이프라인 `vuln-scan`이 잡는다.
