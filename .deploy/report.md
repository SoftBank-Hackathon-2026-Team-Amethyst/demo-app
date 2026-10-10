# 분석 보고서

생성: 2026-10-10, `/janto-deploy` 2차 실행(deploy-analyze). 상세는 `.deploy/analysis/*.md`, 브리프는 `.deploy/brief.md`.
브리프가 1차(2026-10-09)와 달라졌다: 민감 데이터 모름 → **예**, 선호 대상 온프레미스 → **AWS**, 가용성 일반 운영 → **시연용**.

## 추천

- **배포 대상: `aws`** (팀 공용 EKS `one-tatchi`, 서울 리전, RDS `db.t4g.micro`, ALB + HTTPS `onetatchi.soulee.dev`)
- 이유 한 줄: 브리프가 AWS를 선호하고, 민감 데이터 "예"에도 서비스 분석상 **사내 보관을 강제하는 데이터가 없다**(방명록 닉네임 · 자유 텍스트, 집계 숫자뿐). 국내 보관 요구까지는 서울 리전(`region == ap-northeast-2` validation)으로 충족한다. 클러스터 · RDS · CI 역할 · DNS가 이미 떠 있고 레포 변수 `DEPLOY_TARGET=aws`로 운영 중이다.
- 검토한 대안
  - `onprem`: 클라우드 비용 0원이지만 선호 대상이 아니고, 맥북 상시 가동과 재시작 때 바뀌는 Quick Tunnel 주소가 시연용 공개 주소로 불안정하다. state가 맥북에만 있다.
  - `gcp`: 구현체(T4)와 플랫폼 변수는 있으나 전체 비용이 AWS와 같은 자릿수(USD 310 이상)이고, 증분 · 무료 구간이 미산정이며 plan 계정의 Helm 조회 문제(`infra/T17-VALIDATION.md`)가 미해결이다.
- 예산: **초과(over)**. 월 10만 원 이하(≈ USD 74.5) 대비 AWS 전체 루트 확인 소계 USD 331.573, 이 앱의 **증분만 따져도** USD 92.045(ALB 3개 + RDS + 공인 IP)다. 클라우드 후보 중 예산 안에 드는 것은 없다. 절감은 별도 견적이 없어 미산정이며, 검토 방향은 시연 시간 외 노드 축소 · ALB 묶기 · RDS를 test/prod 공유 유지다(가용성 `demo`라 가능).

<!-- pricing-summary:start -->
### 예상 월 비용

- 배포 후보: AWS (demo-aws)
- 구성: 가정이 포함된 구성
- 전체 자원 비용: 확인된 소계 USD 331.573; 추가 비용 미정
- 앱 추가 증분: 확인된 소계 USD 92.045; 추가 비용 미정
- 전체 원화: 미산정
- 앱 추가 원화: 미산정
- 예산 비교 범위: 전체 비용
- 예산 초과: 알려진 비용 하한만으로도 예산 상한을 넘습니다.
- 절감액 미산정: 별도 대안 견적이 없습니다. 노드·DB·NAT 등 큰 비용 항목의 대안을 검토하고, 가용성·규제 조건을 확인한 뒤 별도로 계산해야 합니다.
- 단가 조회/시도 시각 (UTC): 2026-10-09T14:06:30Z
- 입력·단가·계산 근거: 567f8c7f2dd4 / ec48d6f74172 / bfda09c9bb53
- 환율: USD 1 = 1,341.486704원; 기준일 2026-10-09; 출처 ECB EXR daily reference rates 2026-10-09 (data-api.ecb.europa.eu EXR/D.KRW.EUR.SP00.A 1503.27 ÷ EXR/D.USD.EUR.SP00.A 1.1206), 2026-10-10 조회, 소수 6자리 반올림
- 미산정·확인 필요 항목: 월 사용량 또는 상한 미정; 앱 추가 사용량 또는 상관관계 미정

<!-- pricing-summary:end -->

## 인프라 구성

| 서비스 | 런타임 | 포트 | 헬스체크 | 외부 노출 | replicas (공통 / aws / onprem) | 자원 요청 / 한도 | DB |
|---|---|---|---|---|---|---|---|
| `demo-app-be` | Node 22 · Fastify 5.12 (pnpm, 3단계 Dockerfile, UID 1000) | 8000 | `/health`, `/healthz/liveness` | 아니오 (FE nginx가 `/api`, `/health` 프록시) | 2 / **1** / 1 | 100m · 128Mi / 256Mi | RDS Postgres 17, Secret `demo-app-db`(키 `PG_URL` · `DATABASE_URL`), 마이그레이션 `db/init.sql` |
| `demo-app-fe` | Vite + React 19 → nginx-unprivileged (UID 101) | 3000 | `/` | 예 (aws: ALB Ingress + HTTPS, onprem: Quick Tunnel) | 2 / **1** / 1 | 50m · 32Mi / 64Mi | 없음 |

- 네임스페이스 `test` · `prod`, Blue-Green(승격은 Slack 버튼). aws는 RDS 하나를 두 환경이 공유(test smoke의 쓰기가 prod 화면에 보이므로 INSERT smoke는 넣지 않는다).
- `replicas: 1`은 시연의 전제다: 장애 주입 상태(`/api/chaos`) · `/api/metrics` 집계 · 메모리 폴백이 파드별 메모리라 파드가 2개면 절반만 적용된다.
- 템플릿 버전: 워크플로는 이미 `v2.1.3`(PR #50)인데 `.deploy/config.yaml`은 `v2.1.2`라 `check-artifacts.sh`가 main에서 7건 실패한다. v2.1.2→v2.1.3은 Slack 알림 액션 · 문서만 바뀌었고(모듈 · 차트 diff 없음) App Chart `2.1.3`이 GHCR에 있으므로 **config.yaml을 v2.1.3으로 맞춘다**(CODEOWNERS 리뷰 대상). aws · gcp 루트는 `infra_versions`대로 `v1.16.0` 유지.

## 확장 계획

부하는 사용자 수보다 **열린 탭 수**에 비례한다(탭당 2.67 req/s: `/api/info` · `/api/metrics` 1초 폴링 + votes · guestbook 3초). 청중 30탭 ≈ 80 req/s, 관리자 패널 부하 생성기(60 RPS × 3탭) 포함 **피크 약 260 req/s**, DB는 3초 TTL 캐시 덕에 약 210 q/s. 현재 구성 한계 ≈ 800~1,000 req/s(동시 탭 300개).

1. `LOG_LEVEL=warn`(요청당 2줄 × 260 req/s → CloudWatch 비용 · CPU)
2. aws `replicas: 2` — 상태 공유(Redis 등) 없이는 시연 기능이 깨지므로 4번이 먼저
3. 노드 추가(예산 초과)
4. 파드 간 상태 공유 · SSE · `guestbook(created_at)` 인덱스

## 필요한 코드 수정

우선순위 순. **이번 PR 범위는 2 · 3 · 4 · 5**(산출물 정합 + 동작을 바꾸지 않는 권장 수정). 1은 이미 열린 PR #51이 맡고, 6은 리뷰 지점 1에서 사람이 정한다.

1. **(배포 필수, PR #51에서 진행 중)** AWS test · prod의 BE가 지금 **메모리 모드**다(`/api/info` `dbConnected:false`, `/health` `database:"fallback-memory"`, 2026-10-10 02:52 UTC 확인). Secret의 `DATABASE_URL`은 psycopg 스킴 · sslmode 없음이고 postgres.js가 `PGSSL`을 읽지 않아 RDS(TLS 강제)에 못 붙는다. 사용자가 연 PR #51(`t28-db-tls`: `PGSSL` → postgres.js `ssl` 옵션, `values-be.yaml` `env.PGSSL: require`)이 고친다. 이 PR은 `be/src/db/index.ts`를 건드리지 않고 #51 머지를 전제로 한다.
2. 산출물 정합: `.deploy/plan.yaml` `target: aws`, `.deploy/config.yaml` `template_version: v2.1.3`, `deploy.yml` `chart-version: 2.1.3` · 기본 대상 `aws`, `onprem-verify.yml` · `infra/envs/onprem` `?ref=` → `v2.1.3`(모듈 동일, apply 불필요).
3. `.deploy/smoke.json`: BE에 `GET /api/chaos`(green이 깨끗한 상태로 떴는지) · `GET /api/metrics` 추가. 본문 검증(`database == "connected"`)은 promote-judge가 상태 코드만 보므로 미지원 — `/health`가 DB 단절에도 200인 문제(6-b)와 함께 사람 결정.
4. `deploy/values-be.yaml` `env.LOG_LEVEL: warn`(코드가 `LOG_LEVEL`을 읽음). `deploy/values-fe.yaml` `ingress.healthcheckPath: /`(차트 기본 `/health`는 BE로 프록시돼 FE 상태가 아님).
5. `fe/package.json`의 미사용 패키지 `dev@0.1.5`(PR #44로 유입, bin · `inotify` 의존) 제거. `fe/Dockerfile` `apk upgrade`를 `tiff`만이 아니라 전체로.
6. **사람 결정(동작 변경)**
   - a. `POST /api/chaos` · `/api/chaos/reset`이 인증 없이 인터넷에 열려 있다 → 보안 분석기는 **배포 차단**으로 분류. 선택지: (i) `CHAOS_ENABLED` 환경변수로 라우트 등록 게이트(값 파일에서 끄면 prod에서 사라짐), (ii) 관리자 토큰 헤더, (iii) 그대로 두고 시연 기간만 감수.
   - b. `/health`가 DB 단절 · 메모리 폴백에도 200 → smoke · 승격 판단이 DB 장애를 못 잡는다(1번이 바로 그 사례).
   - c. `db/init.sql` guestbook 시드가 배포마다 2건 중복 삽입(`WHERE NOT EXISTS`로 멱등화).
   - d. CORS `origin: true`, 쓰기 API 속도 제한 없음, 방명록 삭제 · 보존 기간 없음(규제 측면).

## 보안 · 규제

- 배포를 막는 문제: **1건** — 무인증 `/api/chaos`(위 6-a). 커밋된 비밀값 없음(히스토리 포함), trivy fs HIGH 이상 0건(be · fe), trivy config aws HIGH 이상 0건, `.trivyignore` 3건 모두 근거 있음.
- 노출: 인터넷에서 ALB HTTPS → FE만 Ingress. 다만 FE가 `/api/*` · `/health`를 그대로 프록시해 BE의 info · metrics · votes · guestbook · chaos가 외부에서 닿는다. `/metrics`(Prometheus) · `/healthz/liveness`는 안 닿는다. RDS(private subnet, 노드 SG만) · Secrets Manager · Slack 봇은 비노출.
- `compliance: regulated` 유지(브리프 "예"). 운영 승인: prod는 environment `prod` 사람 승인, yolo 경로에서 `compliance` 변경은 `config-guard`가 막는다.
- regulated가 요구하는 것 중 충족: prod 승인, CODEOWNERS, RDS 저장 암호화, 비밀번호 Secrets Manager, tfstate 암호화, ALB TLS 1.3. 미충족(배포 뒤): BE→RDS TLS(PR #51), RDS 백업 보존 1일 · 삭제 보호 없음, ALB 접근 로그 없음, NetworkPolicy 없음, test · prod DB 공유, 방명록 보존 정책 없음.
- 레포 밖이라 확인 못 한 것: `prod` environment reviewer 설정, RDS `rds.force_ssl` 실제 값, EKS 감사 로그 · KMS.

## 가정

- 브리프 "민감 데이터 예"는 방명록 자유 텍스트에 개인정보가 들어올 수 있다는 뜻(또는 보수적 답변)이며 사내 보관 요구가 아니다. 조직 정책으로 사내 보관이 필요하면 추천은 `onprem`으로 바뀐다.
- 환율 USD 1 = 1,341.486704 KRW(ECB 2026-10-09 기준환율). AWS 단가는 이번 실행에서 자격증명이 없어 실조회에 실패했고, 플랫폼의 2026-10-09 실조회 결과를 `reuse-prices`로 검증해 재사용했다(GCP는 라이브 조회 23/23 성공, 재사용값과 일치). AWS 변동 항목(NAT 처리량 · LCU · 로그 · 송신)은 측정값이 없어 미산정.
- 피크 동시 탭 30개 + 부하 생성기 3탭, Node 기동 RSS 60~90MiB(측정 아님). 하루 100명을 동시 접속 100탭으로 읽어도 약 270 req/s로 현재 구성 안이다.
- EKS 노드 3대는 팀 공용이며 이 앱의 증분은 ALB · RDS · 공인 IP만으로 본다(ADR-0014 수용량 가정).
- 템플릿 버전은 main의 워크플로가 이미 쓰는 v2.1.3에 맞춘다. 그 이상으로 올리는 것은 `template-update` PR의 몫.
