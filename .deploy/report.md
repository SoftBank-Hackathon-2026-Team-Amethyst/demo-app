# 분석 보고서

생성: 2026-10-10, `/yolo-deploy` 실행(deploy-analyze, yolo 모드). 같은 날 오전 `/janto-deploy` 2차 분석(PR #52, 커밋 3b0caf7)을 origin/main b8bc6d8 기준으로 **재검증**한 결과다. 상세는 `.deploy/analysis/*.md`, 브리프는 `.deploy/brief.md`(변경 없음: 100명 이하 · 10만 원 이하 · 민감 데이터 예 · AWS · 시연용).
3b0caf7 이후 main 변경: FE 다국어(#54) · p95 클라이언트 측정(#56) · Dockerfile `--platform=$BUILDPLATFORM`(#57) · `APP_VERSION v2.0.0`(#55) · 템플릿 v2.1.4→v2.2.1 워크플로(#53, #60) · T31 승인자용 green 미리보기 Cognito 중계(#59, #60). 서비스 수 · 포트 · 헬스체크 · DB · replicas · resources는 바뀌지 않았다.

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
- 전체 자원 비용: 확인된 소계 USD 331.973 이상 (상한 미정); 추가 비용 미정
- 앱 추가 증분: 확인된 소계 USD 92.445 이상 (상한 미정); 추가 비용 미정
- 전체 원화: 미산정
- 앱 추가 원화: 미산정
- 예산 비교 범위: 전체 비용
- 예산 초과: 알려진 비용 하한만으로도 예산 상한을 넘습니다.
- 절감액 미산정: 별도 대안 견적이 없습니다. 노드·DB·NAT 등 큰 비용 항목의 대안을 검토하고, 가용성·규제 조건을 확인한 뒤 별도로 계산해야 합니다.
- 단가 조회/시도 시각 (UTC): 2026-10-09T14:06:30Z
- 입력·단가·계산 근거: 00227ddb65f7 / 63c47700855d / 6fa44854ff15
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
- T31 미리보기(aws만): 릴리스마다 oauth2-proxy Deployment 1개(10m/32Mi)가 FE 옆에 추가되고 green은 `green(-yolo).onetatchi.soulee.dev`에서 Identity Center SSO 뒤에만 열린다. promote-judge smoke는 `svc/<release>-preview`에 port-forward로 직접 붙으므로 SSO가 smoke를 가로채지 않는다(ADR 0015).
- 템플릿 버전 표기가 어긋나 있다: `.deploy/config.yaml template_version: v2.1.4` ↔ 워크플로 `@v2.2.1` · `chart-version 2.2.1`(#60), `slack-notify-preview.yml` 액션 `@v2.1.3`, `infra/envs/onprem` `?ref=v2.1.3`, `infra/envs/aws` `preview_auth` 모듈 `?ref=v2.2.1` ↔ `infra_versions.aws v1.16.0`. `check-artifacts.sh`가 12건 실패한다. 파이프라인 동작에는 영향이 없고(`config-guard`는 형식만 본다, #60 검사 통과), 바로잡는 것은 `config.yaml`(CODEOWNERS)을 v2.2.1로 올리는 사람 PR 또는 `template-update` PR의 몫이다. **yolo 경로에서는 고치지 않는다.**

## 확장 계획

부하는 사용자 수보다 **열린 탭 수**에 비례한다(탭당 2.67 req/s: `/api/info` · `/api/metrics` 1초 폴링 + votes · guestbook 3초). 청중 30탭 ≈ 80 req/s, 관리자 패널 부하 생성기(60 RPS × 3탭) 포함 **피크 약 260 req/s**, DB는 3초 TTL 캐시 덕에 약 210 q/s. 현재 구성 한계 ≈ 800~1,000 req/s(동시 탭 300개).

1. `LOG_LEVEL=warn`(요청당 2줄 × 260 req/s → CloudWatch 비용 · CPU)
2. aws `replicas: 2` — 상태 공유(Redis 등) 없이는 시연 기능이 깨지므로 4번이 먼저
3. 노드 추가(예산 초과)
4. 파드 간 상태 공유 · SSE · `guestbook(created_at)` 인덱스

## 필요한 코드 수정

**배포에 필요한 수정: 없음.** 2차 분석의 항목 1~5(RDS TLS `PGSSL`, 산출물 정합, smoke 추가, `LOG_LEVEL` · `healthcheckPath`, 미사용 `dev` 제거 · `apk upgrade`)와 사람 결정 6-a(`CHAOS_ENABLED` 게이트) · 6-b(`/health` 503) · 6-c(guestbook 시드 멱등)는 PR #51 · #52로 모두 main에 반영됐다. 로컬 검사: be `lint` · `test` 8/8 · `build`, fe `lint` · `build`, 이미지 빌드 2개, `terraform validate`(aws) 통과.

이번 yolo push가 바꾸는 것(산출물 단계):
1. `deploy/values-be.yaml` `APP_VERSION: v2.0.0 → v2.0.1`. 배포 테스트 목적의 표식이다. `deploy.yml`의 `changes` 필터(`be/** fe/** db/** deploy/values-*.yaml deploy/aws/**`)는 main 대비 변경이 있어야 test job을 돌리므로, 분석 문서만 바꾼 push는 test 배포가 일어나지 않는다. `/api/info`의 `version`으로 새 파드가 떴는지 확인한다(`v2` 접두는 유지되므로 테마는 바뀌지 않는다).

남은 권장(동작 변경 없음, 다음 PR): Dockerfile 교차 아키텍처 빌드 전제 주석, README의 `PG_URL` · 환경변수 표 정리, `slack-notify-preview.yml` · onprem `?ref` 버전 정합(config.yaml 결정과 함께).

**사람 결정(prod 승격 전)**
- a. `deploy/values-be.yaml`의 `CHAOS_ENABLED: "true"`가 test · prod 공통이라 **prod에서도 무인증 `POST /api/chaos`가 열린다.** 플랫폼 `deploy.yml@v2.2.1`에는 환경별 값 파일 입력이 없으므로, prod job의 `services`가 `CHAOS_ENABLED: "false"`인 별도 값 파일을 가리키게 하거나 시연 뒤 공통 값을 끈다. `compliance: regulated`라 prod는 사람 승인 단계에서 걸린다.
- b. `/health` 503이 readiness와 liveness에 같이 걸린다(App Chart가 같은 `probe.path`). RDS 장애 시 파드 재시작 루프가 된다. liveness를 `/healthz/liveness`로 분리하려면 차트 입력이 필요하다(플랫폼 결정).
- c. CORS `origin: true`, 쓰기 API 속도 제한 없음, 방명록 보존 정책 없음(규제 측면, 2차 분석 6-d 그대로).

## 보안 · 규제

- test 배포를 막는 문제: **없음.** prod 승격 전 조치 1건: prod `CHAOS_ENABLED`(위 a). 커밋된 비밀값 없음, trivy fs HIGH 이상 0건(be · fe lockfile), 커밋된 IaC HIGH 0건, `.trivyignore` 변경 없음.
- 해결됨(2차 분석 대비): BE→RDS TLS, DB 장애를 숨기던 `/health`, FE `dev` 패키지, 무인증 `:8080` green 미리보기(차트 v2.2.1은 active Ingress만 렌더하고 green은 SSO 뒤).
- 노출: 인터넷에서 ALB HTTPS → FE만 Ingress. FE가 `/api/*` · `/health`를 프록시해 BE의 info · metrics · votes · guestbook · chaos(GET 항상, POST는 게이트)가 외부에서 닿는다. `/metrics`(Prometheus) · `/healthz/liveness`는 안 닿는다. green 미리보기는 Identity Center 앱 할당 하나에 의존한다(oauth2-proxy `emailDomains: ["*"]`, MFA 없음). `deploy/values-fe.yaml`의 Cognito issuer URL · Secrets Manager ARN은 식별자이지 비밀값이 아니다.
- 새로 본 것: oauth2-proxy 이미지(`quay.io/oauth2-proxy/oauth2-proxy:v7.15.4`)는 파이프라인 `image-scan`(be · fe) 밖이라 취약점이 검사되지 않는다. Cognito 앱 클라이언트 시크릿이 tfstate에 남고 PR plan 역할이 읽을 수 있다(플랫폼 모듈 결정).
- `compliance: regulated` 유지. 운영 승인: prod는 environment `prod` 사람 승인, yolo 경로의 `compliance` · CODEOWNERS 변경은 `config-guard`가 막는다. yolo 승격 뒤 자동 PR이 main에 머지되더라도 prod는 승인 없이 올라가지 않는다.
- 미충족(배포 뒤 과제): RDS 백업 보존 1일 · 삭제 보호 없음, ALB 접근 로그 없음, NetworkPolicy 없음, test · prod DB 공유, 방명록 보존 정책 없음.

## 가정

- 브리프 "민감 데이터 예"는 방명록 자유 텍스트에 개인정보가 들어올 수 있다는 뜻(또는 보수적 답변)이며 사내 보관 요구가 아니다. 조직 정책으로 사내 보관이 필요하면 추천은 `onprem`으로 바뀐다.
- 환율 USD 1 = 1,341.486704 KRW(ECB 2026-10-09 기준환율). AWS 단가는 이번 실행에서 자격증명이 없어 실조회에 실패했고, 플랫폼의 2026-10-09 실조회 결과를 `reuse-prices`로 검증해 재사용했다(GCP는 라이브 조회 23/23 성공, 재사용값과 일치). AWS 변동 항목(NAT 처리량 · LCU · 로그 · 송신)은 측정값이 없어 미산정.
- 피크 동시 탭 30개 + 부하 생성기 3탭, Node 기동 RSS 60~90MiB(측정 아님). 하루 100명을 동시 접속 100탭으로 읽어도 약 270 req/s로 현재 구성 안이다.
- EKS 노드 3대는 팀 공용이며 이 앱의 증분은 ALB · RDS · 공인 IP만으로 본다(ADR-0014 수용량 가정).
- AWS 단가 조회는 이번에도 자격증명이 없어 실패했고(GCP도 이번엔 실패), 플랫폼 2026-10-09T14:06:30Z 실조회 결과를 `reuse-prices`로 검증해 재사용했다. T31로 추가된 Secrets Manager 비밀 1개(USD 0.40/월, 도구 조회값)만 반영해 전체 USD 331.973 · 증분 USD 92.445 이상이 됐고 판정 `over`는 그대로다. Cognito User Pool은 가격 계약에 MAU 단위가 없어 미산정(승인자 수 명 수준이라 무료 구간일 가능성이 높지만 금액을 적지 않는다).
- oauth2-proxy의 자원(10m/32Mi, 환경당 1개)과 ALB 수(preview Ingress가 같은 `group.name`을 써 ALB 3개 유지)는 App Chart v2.2.1 본문을 GitHub API로 읽어 확인했다. 플랫폼 `deploy.yml`이 Helm `--wait`로 oauth2-proxy 파드까지 기다리는지는 확인하지 않았다(ExternalSecret 미해결 시 릴리스 timeout 가능성).
- 템플릿 버전 표기 불일치(config v2.1.4 ↔ 워크플로 v2.2.1)는 사람이 바로잡는다. 이 실행은 `.deploy/config.yaml`을 건드리지 않는다.
