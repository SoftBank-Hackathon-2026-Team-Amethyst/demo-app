# 분석 보고서

생성: 2026-10-09, `/janto-deploy` 1차 실행(deploy-analyze). 상세는 `.deploy/analysis/*.md`, 브리프는 `.deploy/brief.md`.

## 추천

- **배포 대상: `onprem`** (맥북 k3d, self-hosted runner `macbook-onprem`, Cloudflare Quick Tunnel)
- 이유 한 줄: 브리프가 온프레미스를 선호하고, 월 예산 10만 원 이하에서 클라우드 비용 0원으로 맞는 유일한 후보다. 클러스터 · runner · DB · 터널이 이미 떠 있다.
- 예상 월 비용: **0원**(클라우드) + 운영 부담(맥북 상시 가동, 전기 약 3~5천 원, Quick Tunnel 주소가 cloudflared 재시작 때 바뀜, state가 맥북에만 있음)
- 검토한 대안
  - `aws`: 전체 구성(EKS + 노드 3대 + NAT + ALB + RDS) 약 **40만 5천 원/월**로 예산의 4배. 팀 공용 클러스터에 증분으로만 보면 약 7만 원이라 예산 안이지만, 클러스터 비용은 누군가 내고 있다. 지금은 `DEPLOY_TARGET=aws`로 팀이 함께 쓰고 있어 **두 대상 모두 유지**하고 레포 변수로 고른다.
  - `gcp`: 구현체(T4) 없음. 비용은 aws와 같은 자릿수.
- 규제: `compliance: regulated` 유지(브리프 "모름" → 보수적 분류, `needs_review`). 코드가 저장하는 민감 데이터는 방명록 닉네임 · 자유 텍스트뿐이라 사람이 `none`으로 바꿀 여지가 있다. 바꾸려면 janto PR(CODEOWNERS 리뷰).

## 인프라 구성

| 서비스 | 런타임 | 포트 | 헬스체크 | 외부 노출 | replicas (공통 / aws / onprem) | 자원 요청 / 한도 | DB |
|---|---|---|---|---|---|---|---|
| `demo-app-be` | Node 22 · Fastify 5 (pnpm) | 8000 | `/health` | 아니오 (FE nginx가 `/api`, `/health` 프록시) | 2 / 1 / 1 | 100m · 128Mi / 256Mi | Postgres 17, Secret `demo-app-db`, 마이그레이션 `db/init.sql` |
| `demo-app-fe` | Vite + React → nginx-unprivileged | 3000 | `/` | 예 (onprem: Quick Tunnel → Service, aws: ALB Ingress + HTTPS) | 2 / 1 / 1 | 50m · 32Mi / 64Mi | 없음 |

- 네임스페이스 `test` · `prod`. onprem은 환경마다 Postgres(StatefulSet) 하나씩, aws는 RDS `db.t4g.micro` 하나를 두 환경이 공유.
- 템플릿 버전 `v1.10.0`(main과 같음. 올리는 건 `template-update` PR의 몫).

## 확장 계획

부하는 하루 사용자 수보다 **열린 탭 수**에 비례한다(FE가 1초마다 `/api/info` 폴링 → DB `SELECT 1`). 피크 약 50 req/s 추정, 현재 구성이 5~10배 여유.

1. 앱 수정: `/api/info` 응답 캐시 또는 폴링 간격 완화, `guestbook(created_at)` 인덱스
2. aws `replicas: 2`(노드 파드 한도 안)
3. 노드 추가(예산 초과) → 구조 변경

## 필요한 코드 수정

우선순위 순. 이번 PR에서는 **3 · 4 · 7**만 하고, 동작을 바꾸는 1 · 2 · 5는 리뷰 지점 1에서 결정한다.

1. BE가 Secret의 `PG_URL`(`sslmode=require`)을 `DATABASE_URL`(psycopg 스킴, sslmode 없음)보다 먼저 읽게. TLS 강제 DB(RDS 기본)에서 조용히 메모리 모드로 떨어지는 것을 막는다.
2. `db/init.sql`의 `guestbook` 시드를 재실행 안전하게(`WHERE NOT EXISTS`). 지금은 배포마다 2건 중복 삽입.
3. Dockerfile의 `pnpm install --frozen-lockfile || pnpm install` 폴백 제거(lockfile 불일치를 숨긴다). `.dockerignore`가 빈 파일 → 채운다.
4. FE 값 파일에 `resources`(50m / 32Mi / 64Mi) 추가.
5. `/health`가 DB 미연결에도 200을 돌려주고 기동 실패 뒤 재연결하지 않음. 데모 의도(README)와 충돌하므로 사람 결정. smoke · 승격 판단에서는 응답 본문 대신 `GET /api/info` 등 DB를 실제로 읽는 경로를 함께 본다.
6. README: `APP_ENV`는 코드가 읽지 않음(`NODE_ENV`). 검사 명령에 `pnpm lint`.
7. `infra/envs/onprem` `chart_version` 기본값 `1.5.1`, `infra/envs/aws` `1.9.0`이 `template_version v1.8.0`과 어긋남 → `1.8.0`으로 맞춘다.

## 보안 · 규제

- 배포를 막는 문제: **없음**. 커밋된 비밀값 없음, Trivy HIGH 이상 0건(be · fe), 인증 없는 관리 기능 없음.
- 배포 뒤 고칠 것: CORS `origin: true`, 쓰기 API 속도 제한 없음, DB 장애 은폐(위 5번), `DATABASE_URL`에 sslmode 없음(위 1번).
- 노출: 외부는 `demo-app-fe`만. BE · Postgres · Argo 대시보드는 클러스터 안.
- 운영 승인 경로: `regulated` → prod는 environment 승인(사람). yolo 경로에서 `compliance`를 바꾸면 `config-guard`가 막는다.
- 온프레미스 인프라에 없는 것: 저장 데이터 암호화, 백업, 로그 보존(T27에서 다룬다).

## 가정

- 민감 데이터 취급: 브리프 "모름". 코드 기준으로는 닉네임 · 자유 텍스트만 저장하므로 "없음"이 타당하나, 사람이 확정하기 전까지 `regulated`.
- 데이터 보관 위치 제한: 확인 전 "데이터만 사내"로 가정(onprem 선호와 일치).
- 환율 1 USD = 1,400 KRW. 요금은 서울 리전 온디맨드 공개 요금의 대략치.
- 피크 동시 탭 30개, 체류 5분, Node 기동 RSS 60~90MiB(측정 아님).
- 템플릿 버전은 main의 현재 값(v1.10.0)을 유지한다. 올리는 것은 `template-update` PR의 몫.
