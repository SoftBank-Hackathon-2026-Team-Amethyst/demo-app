# 분석 보고서

생성: 2026-10-11, `/yolo-deploy` 실행(deploy-analyze, yolo 모드, 기준 origin/main 951feac). 2026-10-10 분석(6b48d77)을 **부분 재사용**했다: 코드베이스 · 서비스 분석은 `be/ fe/ db/` 변경이 없어 그대로, 트래픽 · 보안 · 예산은 PR #79(T29 HPA) · #81(T33 db_link) · #74(T35) · T17 · T31 변경으로 다시 돌렸다. 상세는 `.deploy/analysis/*.md`, 브리프는 변경 없음.

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
| `demo-app-be` | Node 22 · Fastify 5.12 (pnpm, 3단계 Dockerfile, UID 1000) | 8000 | `/health`, `/healthz/liveness` | 아니오 (FE nginx가 `/api`, `/health` 프록시) | 2 / **2 (HPA 2~6, CPU 70%)** / 1 | 100m · 128Mi / 256Mi | prod: RDS Postgres 17 · test: 맥북 k3d Postgres(T33 db_link, Tailscale). Secret `demo-app-db`, 마이그레이션 `db/init.sql` |
| `demo-app-fe` | Vite + React 19 → nginx-unprivileged (UID 101) | 3000 | `/` | 예 (aws: ALB Ingress + HTTPS, onprem: Quick Tunnel) | 1 / **1** / 1 | 50m · 32Mi / 64Mi | 없음 |

- 네임스페이스 `test` · `prod`, Blue-Green(승격은 Slack 버튼). aws는 RDS 하나를 두 환경이 공유(test smoke의 쓰기가 prod 화면에 보이므로 INSERT smoke는 넣지 않는다).
- T29(#79)로 AWS BE가 `replicas: 2` + HPA(2~6)가 됐고 노드는 t3.medium 3~5대(Cluster Autoscaler). 장애 주입 상태 · 메모리 폴백은 파드별 메모리라 파드 ≥ 2에서 주입이 1/N에만 걸린다(트래픽 분석 "주의"). test 전용으로 되돌리려면 `values-be.test.yaml`에 replicas 1을 두는 것이 선택지다(사람 결정).
- test · prod DB 공유는 T33으로 해소됐다(test는 맥북 Postgres). 대신 test 데이터가 개인 기기에 있다.
- T31 미리보기(aws만): 릴리스마다 oauth2-proxy Deployment 1개(10m/32Mi)가 FE 옆에 추가되고 green은 `green(-yolo).onetatchi.soulee.dev`에서 Identity Center SSO 뒤에만 열린다. promote-judge smoke는 `svc/<release>-preview`에 port-forward로 직접 붙으므로 SSO가 smoke를 가로채지 않는다(ADR 0015).
- 템플릿 버전 표기가 어긋나 있다: `.deploy/config.yaml template_version: v2.1.4` ↔ 워크플로 `@v2.2.1` · `chart-version 2.2.1`(#60), `slack-notify-preview.yml` 액션 `@v2.1.3`, `infra/envs/onprem` `?ref=v2.1.3`, `infra/envs/aws` `preview_auth` 모듈 `?ref=v2.2.1` ↔ `infra_versions.aws v1.16.0`. `check-artifacts.sh`가 12건 실패한다. 파이프라인 동작에는 영향이 없고(`config-guard`는 형식만 본다, #60 검사 통과), 바로잡는 것은 `config.yaml`(CODEOWNERS)을 v2.2.1로 올리는 사람 PR 또는 `template-update` PR의 몫이다. **yolo 경로에서는 고치지 않는다.**

## 확장 계획

부하는 사용자 수보다 **열린 탭 수**에 비례한다(탭당 2.67 req/s: `/api/info` · `/api/metrics` 1초 폴링 + votes · guestbook 3초). 청중 30탭 ≈ 80 req/s, 관리자 패널 부하 생성기(60 RPS × 3탭) 포함 **피크 약 260 req/s**, DB는 3초 TTL 캐시 덕에 약 210 q/s. 현재 구성 한계 ≈ 800~1,000 req/s(동시 탭 300개).

1. `LOG_LEVEL=warn`(요청당 2줄 × 260 req/s → CloudWatch 비용 · CPU)
2. aws `replicas: 2` — 상태 공유(Redis 등) 없이는 시연 기능이 깨지므로 4번이 먼저
3. 노드 추가(예산 초과)
4. 파드 간 상태 공유 · SSE · `guestbook(created_at)` 인덱스

## 필요한 코드 수정

**배포에 필요한 수정: 없음.** `be/ fe/ db/` 코드는 2026-10-10 분석 이후 변경이 없다. 로컬 검사: be lint · test 8/8 · build, fe lint · build, 이미지 빌드 2개, `terraform fmt`(infra 변경은 origin/main 대비 없음 → init · validate 생략) 통과.

이번 yolo push가 바꾸는 것:
1. `deploy/values-be.yaml` `APP_VERSION: v2.0.1 → v2.0.2`. 템플릿 v2.12.0 파이프라인(승인 approve job 분리 · helm 2단계 · yolo PR push 검사 재사용) 첫 실측용 표식. `changes` 필터 통과용이기도 하다.
2. `.deploy/plan.yaml`: be `replicas aws: 2` + autoscaling, fe `default: 1`, `nodes.aws`(3~5, autoscaler) — 값 파일 현실에 맞춤.

**사람 결정**
- a. 시연 기능(장애 주입 · 메트릭 · 폴백)이 파드별로 갈리는 문제: test를 `values-be.test.yaml`로 replicas 1에 고정할지, HPA를 유지할지.
- b. [추정, 검증 필요] T33 NetworkPolicy(`infra/envs/aws/main.tf` `allow_from`: test `app.kubernetes.io/name=demo-app-be` 파드만)가 App Chart 마이그레이션 Job 파드(라벨 없음)를 막아 test 배포가 pre-upgrade hook에서 실패할 수 있다. 이번 배포가 검증이다. 실패하면 `allow_from`에 Job 라벨 추가(infra, 사람 PR).
- c. `/health` 503이 liveness에 걸려 DB 통로 단절 시 재시작 루프(platform 이슈 211, v2.13.0 `probe.livenessPath`로 수정 중, PR #87 · #89).

## 보안 · 규제

- test 배포를 막는 문제: **없음.** prod 승격 전 조치: **없음**(이전 1건 `POST /api/chaos`는 T35로 해소 — `CHAOS_ENABLED`는 `values-be.test.yaml`에만 있고 prod에는 키가 없다). 비밀값 커밋 0, lockfile HIGH 0, IaC HIGH 0, `.trivyignore` 변경 없음.
- 템플릿 v2.12.0 관문: 승인은 `approve` job(environment `prod`)이 받고 배포 job은 `prod-auto`(main 전용)로 돈다. `approve`가 skipped인 경우는 `compliance: none`뿐이라 규제 관문 강도는 유지된다. 감사 기록이 두 environment로 나뉜다.
- 새로 본 것: Grafana가 익명 Viewer로 `onetatchi.soulee.dev/grafana`(prod ALB)에 공개돼 CloudWatch · Prometheus · GCP Monitoring 데이터 소스를 가진다(Explore 가능 여부 확인 필요). prod 장애 주입 차단은 값 파일 위치 규약에만 기대고 `deploy/values-*.yaml`은 CODEOWNERS 밖이다.
- T33: AWS test BE가 tailnet(WireGuard + Postgres TLS)으로 맥북 Postgres를 쓴다. VPC CNI NetworkPolicy가 처음 켜졌다. T31 `previewAuth.routes`로 green 미리보기의 `/api/`가 green BE로 간다. T17 GCP 접근은 WIF(서비스 계정 키 없음), 커밋된 `*.auto.tfvars`는 식별자뿐.
- `compliance: regulated` 유지. yolo 경로의 `compliance` · CODEOWNERS 변경은 `config-guard`가 막는다.

## 가정

- 브리프 "민감 데이터 예"는 방명록 자유 텍스트에 개인정보가 들어올 수 있다는 뜻이며 사내 보관 요구가 아니다. 조직 정책으로 사내 보관이 필요하면 추천은 `onprem`으로 바뀐다.
- 단가는 2026-10-09T14:06:30Z 플랫폼 실조회를 `reuse-prices`로 재사용했다(이번 live 조회는 AWS · GCP 모두 인증 실패). 환율 ECB 2026-10-09 1,341.486704. T17 #62로 Grafana · remote-write Ingress가 prod ALB를 공유해 ALB 3 → 2개(−USD 23.725). Cluster Autoscaler의 4~5대째 노드는 조건부라 본 견적은 상시 3대이고, 5대 상시 시나리오(+USD 79.568)는 `analysis/alternatives/aws-nodes-max/`에 따로 뒀다. Cognito MAU · GCP Monitoring read API · Tailscale 플랜은 미산정.
- HPA 추정치(CPU 70%, 부하 생성기 260 req/s에서 test BE 4개)는 README T29 시나리오 기준이며 측정값이 아니다. 파드 슬롯 계산은 t3.medium 17개/노드.
- T33 NetworkPolicy가 마이그레이션 Job을 막는지는 확인하지 못했다(정책 적용 뒤 test 배포가 아직 없음). 이번 배포 결과로 판단한다.
- `.deploy/config.yaml`은 건드리지 않았다. 템플릿 v2.12.0은 bump PR #84로 이미 main에 있다.
