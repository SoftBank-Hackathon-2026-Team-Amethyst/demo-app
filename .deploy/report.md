# 분석 보고서

생성: 2026-10-11, `/yolo-deploy` 실행(deploy-analyze, yolo 모드, 기준 origin/main 142633a). 2026-10-10~11 분석(b0d3df7)을 **부분 재사용**했다: 서비스 · 트래픽 · 예산 분석은 그 이후 변경이 서비스 수 · replicas · resources · 과금 자원을 바꾸지 않아 그대로(예산은 `infra/envs/aws`에 gcp 미리보기용 Route53 A 레코드 2개가 추가됐지만 레코드 단위 과금이 없고 인벤토리 대상이 아니다). 코드베이스 · 보안 분석은 T25 CPU 부하 API(#103 · #106) · T17 liveness 분리(#88) · T38 gcp 미리보기 · 템플릿 v2.17.0으로 환경변수 · 헬스체크 · 노출 범위가 바뀌어 다시 돌렸다. 상세는 `.deploy/analysis/*.md`, 브리프는 변경 없음.

## 추천

- **배포 대상: `aws`** (팀 공용 EKS `one-tatchi`, 서울 리전, RDS `db.t4g.micro`, ALB + HTTPS `onetatchi.soulee.dev`)
- 이유 한 줄: 브리프가 AWS를 선호하고, 민감 데이터 "예"에도 서비스 분석상 **사내 보관을 강제하는 데이터가 없다**(방명록 닉네임 · 자유 텍스트, 집계 숫자뿐). 국내 보관 요구까지는 서울 리전(`region == ap-northeast-2` validation)으로 충족한다. 클러스터 · RDS · CI 역할 · DNS가 이미 떠 있고 레포 변수 `DEPLOY_TARGET=aws`로 운영 중이다.
- 검토한 대안
  - `onprem`: 클라우드 비용 0원이지만 선호 대상이 아니고, 맥북 상시 가동과 재시작 때 바뀌는 Quick Tunnel 주소가 시연용 공개 주소로 불안정하다. state가 맥북에만 있다.
  - `gcp`: 구현체(T4)와 플랫폼 변수는 있으나 전체 비용이 AWS와 같은 자릿수(USD 310 이상)이고, 증분 · 무료 구간이 미산정이며 gcp green 미리보기(T38)는 아직 실측 전이다.
- 예산: **초과(over)**. 월 10만 원 이하(≈ USD 74.5) 대비 AWS 전체 루트 확인 소계 USD 308.248 이상, 앱 증분 USD 68.72 이상. 클라우드 후보 중 예산 안에 드는 것은 없다. 절감은 별도 견적이 없어 미산정이며, 검토 방향은 시연 시간 외 노드 축소 · ALB 묶기다(가용성 `demo`라 가능). 공개 CPU 부하 API가 HPA · Cluster Autoscaler를 밀어 올리면 상시 5대 시나리오(`analysis/alternatives/aws-nodes-max/`, USD 387.8)로 갈 수 있다.

<!-- pricing-summary:start -->
### 예상 월 비용

- 배포 후보: AWS (demo-aws)
- 구성: 가정이 포함된 구성
- 전체 자원 비용: 확인된 소계 USD 308.248 이상 (상한 미정); 추가 비용 미정
- 앱 추가 증분: 확인된 소계 USD 68.72 이상 (상한 미정); 추가 비용 미정
- 전체 원화: 미산정
- 앱 추가 원화: 미산정
- 예산 비교 범위: 전체 비용
- 예산 초과: 알려진 비용 하한만으로도 예산 상한을 넘습니다.
- 절감액 미산정: 기준 또는 대안의 비교 범위가 완전하지 않습니다.
- 단가 조회/시도 시각 (UTC): 2026-10-09T14:06:30Z
- 입력·단가·계산 근거: 9caf1d1126e8 / e5af155ffc38 / b30ada7b3ed1
- 환율: USD 1 = 1,341.486704원; 기준일 2026-10-09; 출처 ECB EXR daily reference rates 2026-10-09 (data-api.ecb.europa.eu EXR/D.KRW.EUR.SP00.A 1503.27 ÷ EXR/D.USD.EUR.SP00.A 1.1206), 2026-10-11(KST) 재조회에서도 최신 관측이 2026-10-09(주말 미발표), 소수 6자리 반올림
- 미산정·확인 필요 항목: 월 사용량 또는 상한 미정; 앱 추가 사용량 또는 상관관계 미정

<!-- pricing-summary:end -->

## 인프라 구성

| 서비스 | 런타임 | 포트 | 헬스체크 | 외부 노출 | replicas (공통 / aws / onprem) | 자원 요청 / 한도 | DB |
|---|---|---|---|---|---|---|---|
| `demo-app-be` | Node 22 · Fastify 5 (pnpm, 3단계 Dockerfile, UID 1000) | 8000 | readiness `/health`(DB 불통 503) · liveness **test만** `/healthz/liveness`(T17, `values-be.test.yaml`), prod는 아직 `/health` | 아니오 (FE nginx가 `/api`, `/health` 프록시) | 2 / **2 (HPA 2~6, CPU 70%)** / 1 | 100m · 128Mi / 256Mi | prod: RDS Postgres 17 · test: 맥북 k3d Postgres(T33 db_link, Tailscale). Secret `demo-app-db`, 마이그레이션 `db/init.sql` |
| `demo-app-fe` | Vite + React 19 → nginx-unprivileged (UID 101). 기동 시 `19-runtime-dns.sh`가 nginx 설정을 `/tmp`에 렌더(쓰기 경로 `/tmp`만) | 3000 | `/` | 예 (aws: ALB Ingress + HTTPS, onprem: Quick Tunnel) | 1 / **1** / 1 | 50m · 32Mi / 64Mi | 없음 |

- 네임스페이스 `test` · `prod`, Blue-Green(승격은 Slack 버튼 또는 AI 판단). 템플릿 v2.17.0, `check-artifacts.sh` 통과(직전 버전 불일치 12건 전부 해소).
- T25(#103): FE가 플랫폼이 네임스페이스마다 두는 `runtime-status:8080`을 `/api/runtime`으로 프록시해 파드 · CPU · 메모리 카드를 그린다. 그 서비스가 없어도 nginx 기동 · smoke에는 영향이 없고 카드만 "조회 불가". BE에는 `LOAD_TEST_ENABLED: "true"`(공통 값 파일 → test · prod)로 `POST /api/load/cpu`가 열린다.
- aws BE replica 2 + HPA라 장애 주입 · 메모리 폴백 · `/api/metrics` 버킷 · CPU 워커 큐가 파드 1/N에만 걸린다(트래픽 분석 "주의"). test · prod DB 공유는 T33으로 해소됐고 대신 test 데이터가 개인 기기에 있다.
- T31 · T38 미리보기: green은 `green(-yolo).onetatchi.soulee.dev`(aws) · `green(-yolo)-gcp.…`(gcp, 고정 IP + ManagedCertificate)에서 Identity Center SSO 뒤에만 열린다.

## 확장 계획

부하는 사용자 수보다 **열린 탭 수**에 비례한다(탭당 2.67 req/s). 청중 30탭 ≈ 80 req/s, 관리자 패널 부하 생성기 포함 **피크 약 260 req/s**. 현재 구성 한계 ≈ 800~1,000 req/s(동시 탭 300개). CPU 부하 API는 파드당 워커 1개 · 큐 8 · 2초 상한이라 요청 수보다 HPA 확장(2→6) · 노드 추가(3→5)로 번진다.

1. `LOG_LEVEL=warn` 유지
2. 파드 간 상태 공유(Redis 등) 없이는 시연 기능이 파드별로 갈린다 — 4번이 먼저
3. 노드 추가(예산 초과)
4. 파드 간 상태 공유 · SSE · `guestbook(created_at)` 인덱스

## 필요한 코드 수정

**배포에 필요한 수정: 없음.** 로컬 검사(2026-10-11): be install · lint · test · build 13초, fe install · lint · test · build 17초, docker build be(캐시) · fe 64초, `terraform fmt -check`(infra 변경은 origin/main 대비 없음 → init · validate 생략), `check-artifacts.sh` 통과. `fe/index.html` 수정 뒤 fe lint · test · build와 docker build fe를 다시 돌려 통과.

이번 yolo push가 바꾸는 것:
1. `fe/index.html`에 `<meta name="description">` 한 줄 추가(사용자 요청 "HTML 하나만 바꾸고 배포". `changes` 필터 `fe/**` 통과 → test 배포).
2. `.deploy/analysis/codebase.md` · `security.md` 델타 재검증, 이 보고서, 실행 기록 3개.

**권장(코드 아님, 다음 PR)**: smoke에 `GET /api/load/config` 추가, README 검사 명령에 FE `pnpm test`.

**사람 결정**
- a. **prod의 인증 없는 CPU 부하 API** `POST /api/load/cpu`: `LOAD_TEST_ENABLED`를 `values-be.test.yaml`로 옮기거나(CHAOS와 같은 규약) 시연 시간에만 켠다. 외부인이 curl 루프로 HPA · Cluster Autoscaler를 밀어 비용을 올릴 수 있다.
- b. prod liveness: `probe.livenessPath: /healthz/liveness`를 test 전용 파일에만 넣었다. RDS 불통 시 prod BE가 재시작 루프에 들 수 있다(platform 이슈 211과 같은 모양).
- c. `/api/runtime`이 파드 이름 · 버전 · 재시작 · CPU/메모리를 인증 없이 공개한다(비밀값 없음). 민감 데이터 브리프 기준 공개 범위 결정.
- d. 시연 기능이 파드별로 갈리는 문제(test replicas 1 고정 여부), 메모리 폴백 · 방명록 입력 검증(이월).

## 보안 · 규제

- test 배포를 막는 문제: **없음.** 비밀값 커밋 0, lockfile(be · fe) HIGH 0, IaC HIGH 0, Dockerfile HIGH 0, 파이프라인 secret · vuln · image · iac-scan 성공. `.trivyignore` 변경 없음.
- **prod 승격 전 결정 1건**: 위 사람 결정 a(공개 CPU 부하 API). 상태 · 데이터를 바꾸지 않고 입력이 enum이라 "인증 없는 관리 기능"으로 분류하지는 않았지만, 비용 증폭 경로라 승인자가 판단한다. 공통 값 파일의 시연 플래그를 막는 검사는 파이프라인에 없다(이번에 실제로 어긋남).
- 이전 "마이그레이션 Job vs NetworkPolicy" 추정은 실제로 발생했고 `infra/envs/aws/main.tf`의 job-name 라벨 허용으로 해소됐다.
- 노출 표 변화: `/api/runtime`(FE 경유, 인증 없음) · `/api/load/*`(FE 경유) 추가, gcp green 미리보기(SSO · HTTPS · 고정 IP) 추가, Cognito 콜백 +2. Grafana 익명 Viewer 공개, test 데이터의 개인 기기 보관, 쓰기 API 속도 제한 없음은 그대로.
- 관문: 승인은 `approve` job(environment `prod`), 배포 job은 `prod-auto`(main 전용). `approve`가 skipped인 경우는 `compliance: none`뿐이라 규제 관문 강도는 유지된다.
- `compliance: regulated` 유지. yolo 경로의 `compliance` · CODEOWNERS 변경은 `config-guard`가 막는다.

## 가정

- 브리프 "민감 데이터 예"는 방명록 자유 텍스트에 개인정보가 들어올 수 있다는 뜻이며 사내 보관 요구가 아니다. 조직 정책으로 사내 보관이 필요하면 추천은 `onprem`으로 바뀐다.
- 단가는 2026-10-09T14:06:30Z 플랫폼 실조회를 재사용했다(비용 재사용: 원 조회 시각 2026-10-09T14:06:30Z, 기준 커밋 b0d3df7). 환율 ECB 2026-10-09 1,341.486704. T38 gcp 고정 IP · ManagedCertificate는 gcp 대상 과금 자원이라 aws 견적에 미반영. Route53 A 레코드 2개는 레코드 단위 과금 없음.
- CPU 부하 API의 파드당 소모는 코드 읽기 기준 추정(워커 1코어 상한)이며 측정값이 아니다. HPA 추정치(CPU 70%, 260 req/s에서 test BE 4개)는 README T29 시나리오 기준.
- `values-*.test.yaml`은 test에만 병합되고, App Chart 2.17.0이 `podNamespaceEnv` · `probe.livenessPath`를 지원한다(차트 본문은 이 레포에 없음). `runtime-status`는 `demo-app-be`와 같은 네임스페이스에 플랫폼이 설치한다.
- `/api/runtime` 응답에 비밀값이 없다(RBAC 네임스페이스 한정). gcp 고정 IP · 호스트 · Pool ID는 공개 식별자다.
- 로컬 검사는 Node 24 · pnpm 10으로 돌렸다(파이프라인은 Node 22 추정). `.deploy/config.yaml`은 건드리지 않았다.
