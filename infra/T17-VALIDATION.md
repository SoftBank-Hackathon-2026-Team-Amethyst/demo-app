# T17 사전 검증과 적용 순서

## 2026-10-10 연결 구현 — 적용·실측은 아직 미완료

기준 main: `88dcbfe` (#52, #53, #54 포함). 최신 다국어 UI·v2.1.4 변경을 통합했으며 기존 앱/온프레미스 v2와 AWS/GCP v1의 분리 고정을 유지한다.
이 변경은 플랫폼 `v2.2.0`과 AWS 호환 패치 `v1.16.1`의 **발행 이후** PR CI와 적용을 진행한다.
아래 태그는 이 문서를 작성한 시점에는 아직 발행하지 않았으며, 참조 변경만으로 배포 완료를 뜻하지 않는다.

- EKS 콘솔에서 `one-tatchi`의 issuer를 실제 확인해 GCP `grafana.auto.tfvars`에 반영했다.
  `https://oidc.eks.ap-northeast-2.amazonaws.com/id/DC33A5AD79B3A60D07F7CCD1FAC56014`는 공개 식별자다.
- AWS 관측은 운영 앱의 `demo-app-prod` ALB 그룹과 HTTPS host를 사용한다. 새 `dashboard_url` 출력으로 실제 대시보드 주소를 제공한다.
- GCP CI는 `verify-helm-state`로 동일 identity의 기존 Helm 조회를 먼저 검사한다. 기존 Helm 생성 5개와 WIF 신규 자원 5개는 주소로 구분한다. 합계만 보고 승인하지 않는다.
- `onprem-observability`는 main 수동 실행만 허용한다. `secondary`의 실제 클러스터는 `onetouch-hyeongrae`, 기존 state root는 `.one-tatchi-t27/infra`다. `plan` 후 `apply`를 순서대로 실행한다. apply 실행도 전체 plan을 검사하며, 관측 Helm update/no-op만 포함된 해당 저장 plan을 적용한다. DB·클러스터 변경이나 state 변경은 중단한다.
- GCP 적용 후 출력된 `grafana_gcp_monitoring`은 아직 AWS에 넣지 않았다. 생성 성공을 확인한 뒤 별도 PR에서 연결한다. provider 식별자를 추측해 선입력하지 않는다.

### 적용 순서

1. 플랫폼 PR의 CI를 통과시킨다. HTTPS 모듈 수정만 v1.16.0에 backport한 `v1.16.1`, 새 workflow를 포함한 v2 `v2.2.0`을 발행한다. v1 backport는 v1.16.0 기준으로 별도 검증하며 v2 main에 병합하지 않는다. 기존 고정 태그는 수정하지 않는다.
2. 이 앱 PR의 plan을 검토한다. AWS는 관측 Ingress/Grafana/receiver 변경만 의도하며, Slack 봇 다운그레이드·pending 작업이나 DB/클러스터 변경이 있으면 해당 apply를 진행하지 않는다.
3. GCP 기존 Helm 조회가 성공하고 WIF 신뢰 대상이 `system:serviceaccount:monitoring:grafana`인지 확인한 뒤 main 파이프라인으로 적용한다. plan 계정이 조회하지 못하면 실제 오류에 필요한 최소 권한을 별도 검토한다.
4. GCP 실제 출력을 AWS `gcp_monitoring`에 연결하는 후속 PR을 적용한다. `OBSERVABILITY_LOG_GROUP`과 remote-write 출력도 실제 값으로 대조한다.
5. 중앙 HTTPS receiver가 준비되면 `onprem-observability(profile=secondary, mode=plan)`을 검토하고 `mode=apply`를 실행한다. 기존 Secret 비밀번호는 GitHub Secret과 같은 값으로 주입한다.
6. test에만 소량 정상/오류 요청을 보낸 뒤 요청 수·오류율·p95·CPU/메모리와 세 대상의 실제 시계열을 조회한다. prod는 조회만 한다. 장애 설정은 원래 값으로 복구한다.
7. 동일 run/attempt/SHA의 AI artifact와 Grafana 원본 근거를 대조한다. 쿼리·관찰 창·실행 링크를 아래에 기록한 뒤 T17 이슈를 체크한다.

### 현재 검증과 남은 환경 제한

- Python 50개 통과: 온프레미스 37개(새 관측 보호 조건 10개 포함), Helm 조회 5개, 기존 AI evidence 게시 8개.
- Terraform fmt, 변경 workflow actionlint, 관측 Helm lint, 앱 산출물 정합 검사 통과.
- Terraform provider 캐시로 offline init은 성공했으나 validate/test는 provider socket `bind: operation not permitted`로 실행 불가. 원격 CI에서 확인해야 한다.
- 전체 scripts suite는 macOS BSD sed와 기존 GNU sed 전용 스크립트의 차이로 첫 fixture에서 중단했다. 새 Python 검사는 개별 실행했다.
- 로컬 Docker socket 연결은 `operation not permitted`, CLI GitHub/AWS 연결은 DNS/endpoint 오류다. AWS 브라우저 SSO는 정상이며 issuer를 조회했다.
- Git CLI의 `git ls-remote`도 `Could not resolve host: github.com`으로 실패했다. GitHub 웹에는 platform의 `feat/t17-live-integration` 브랜치만 만들었으며 코드 커밋·PR·태그 발행은 하지 않았다. 웹 게시 시도는 중단했고 이후 push는 Git CLI로 진행한다.
- cloud apply, remote-write 전송 성공, 실제 지표/AI 근거 대조는 아직 완료하지 않았다. T17 완료 체크의 근거로 이 사전 검사를 사용하지 않는다.

### 로컬 구현 위치

- platform: `../one-tatchi-platform-t17`, `feat/t17-live-integration`. HTTPS 모듈, Helm 조회 검사, 기존 온프레미스 관측 설정 workflow.
- AWS 호환 패치: `../one-tatchi-platform-t17-v1`, `release/t17-v1.16.1`. v1.16.0 대비 관측 모듈 4개 파일만 변경.
- app: 이 작업 트리 `demo-app-t17`, `feat/t17-live-integration`. 고정 버전·GCP issuer·workflow 입력 연결.

네트워크가 복구되면 platform 브랜치를 먼저 push하고 PR CI를 확인한다. 앱은 아직 없는 릴리스 태그를 참조하므로 두 릴리스의 성공을 확인한 뒤 게시·plan한다. 태그 발행 전 앱 main에 병합하지 않는다.

---

2026-10-09 기준. 중앙 Grafana 실제 배포·연결 완료 기록이 아니라 PR #40의 사전 검증이다.

## 최신 main 통합

- T4의 AWS/GCP/온프레미스 배포 대상 선택과 test-only 수동 배포, T8 yolo 자동 머지, T26 승인·알림 입력을 보존했다.
- 작업 중 추가로 머지된 PR #44의 대시보드·장애 주입 기능도 보존했다. 앱 대시보드 `/api/metrics`와 Prometheus `/metrics`를 함께 등록하고, Prometheus 수집 요청은 대시보드 요청 수와 장애 주입에서 제외한다.
- PR #43의 경로 필터를 유지한다. 공통 인프라 워크플로만 바뀌면 PR에서는 양쪽 plan, main에서는 apply를 생략한다. #40은 AWS/GCP 루트가 모두 바뀌므로 머지 시 두 대상의 apply가 실행된다.
- 워크플로·모듈·차트 참조를 `v1.16.0`으로 맞췄다. 실제 AWS Slack 봇의 `1.16.0` 이미지와 팀원 허용 목록을 유지한다. `.deploy/config.yaml`의 `compliance: regulated`는 변경하지 않았다.
- GCP의 Grafana 연결은 `grafana_eks_oidc_issuer = ""`, AWS는 `gcp_monitoring = null`로 비활성 상태다. 권한 설정 이후 [GCP 안내](envs/gcp/README.md)의 순서로 별도 활성화한다.

## 통과한 검사

- BE: `pnpm test`, `pnpm lint`, `pnpm build`. 정상·500·404 요청은 계측하고 health/metrics·smoke·Kubernetes/AWS/GCP 상태 확인 요청은 제외한다. URL·쿼리 문자열을 라벨로 노출하지 않는다.
- BE 통합 테스트는 별도 로컬 프로세스에서 실제 진입 파일을 실행한다. 앱 대시보드 조회, 수집 요청의 카운터 제외, 100% 에러 주입 시 앱 500과 Prometheus의 500 집계, 10초 지연 주입 중 두 지표 주소의 정상 응답, 장애 초기화 후 복구를 확인한다. 개발자 `.env`나 실제 DB를 사용하지 않는다.
- FE: `pnpm lint`, `pnpm build`. 격리된 NGINX에 일반 요청·smoke·kube-probe·ELB-HealthChecker·GoogleHC를 각각 10회씩 전송했다. 50회 모두 HTTP 200이며 계측용 syslog는 일반 요청에 해당하는 10건만 생성됐다. 검증 컨테이너는 제거했다.
- AWS/GCP/온프레미스 루트: Terraform 1.16.5로 고정 태그 `init -backend=false`·`validate`, `terraform fmt -check -recursive infra` 통과. GCP lockfile에는 공식 배포본의 macOS ARM64 체크섬만 추가했으며 provider 버전은 유지했다.
- `actionlint`와 `git diff --check` 통과.
- [통합 커밋 950dc18의 infra CI](https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/demo-app/actions/runs/37905852380): AWS/GCP plan 통과. AWS는 `5 add / 5 change / 0 destroy`, GCP는 아래 조사 항목과 같이 기존 Helm 5개를 신규 생성으로 표시한다. WIF 생성은 없다.
- 최종 커밋의 CI 결과와 적용 전 확인 사항은 [PR #40](https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/demo-app/pull/40)에 기록한다.

이전 맥북 `t17-local` 검증에서는 BE/FE 각각 일반·smoke·probe 10회씩 전송해 카운터가 10만 증가했고, 로컬 Prometheus/Grafana에서 HTTP·CPU·메모리 지표를 확인했다. DB는 memory fallback을 사용했으므로 DB 또는 클라우드 통합 검증으로 간주하지 않는다.

## 적용 전에 남은 확인

### AWS Slack 봇의 Helm 상태

조회 시점에 `slack-bot` revision 4는 `pending-upgrade` / `Preparing upgrade` 상태였다. 파드는 `1/1 Running`이고 Rollout은 Healthy다. 앱 가용성과 Helm 작업 완료는 별개이며, 현재 상태에서는 다음 `helm upgrade`가 진행 중 작업 오류로 막힐 수 있다. 기존 작업의 실행 여부를 확인하고 담당자가 승인된 운영 절차로 정리한 뒤 새 plan을 검토한다. 이 검증에서는 release Secret 삭제, rollback, 클라우드 apply를 하지 않았다. 자동 머지는 이 확인이 끝날 때까지 꺼 둔다.

### GCP plan의 기존 Helm 리소스 표시

[PR #43의 plan](https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/demo-app/actions/runs/37903787451)과 #40의 새 plan 모두 service-base(test/prod), argo-rollouts, external-secrets, platform-config를 기존 ID로 refresh한 뒤 `5 add`로 표시한다. T4 main apply는 같은 backend에서 `0 add / 2 change / 0 destroy`로 성공했다. 따라서 plan의 `5 add`를 실제 리소스 부재의 증거로 사용하지 않는다.

원인은 아직 확정하지 못했다. 현재 코드의 plan 계정은 `roles/viewer`이며, Helm은 Kubernetes Secret을 조회해 release를 찾는다. Helm provider 3.3.0은 존재 조회가 실패할 때 오류 진단을 추가하기 전에 리소스를 없어진 것으로 처리하는 경로가 있어 인증·권한·접속 오류가 생성 계획으로 나타날 수 있다. 근거: [provider Read](https://github.com/hashicorp/terraform-provider-helm/blob/v3.3.0/helm/resource_helm_release.go#L974), [Helm Secret 조회](https://github.com/helm/helm/blob/v3.18.6/pkg/storage/driver/secrets.go#L105).

같은 CI plan 계정으로 아래 권한과 release 메타데이터 조회를 확인해야 한다. 이 맥북에는 해당 서비스 계정의 CLI 인증이 없어 실행하지 않았다. 관리자 계정으로 통과한 결과는 plan 계정 검증을 대신하지 않는다.

```bash
kubectl auth can-i list secrets -n default
kubectl auth can-i list secrets -n argo-rollouts
kubectl auth can-i list secrets -n external-secrets
helm status demo-app-base-test -n default
helm status argo-rollouts -n argo-rollouts
helm status external-secrets -n external-secrets
```

원인을 확인하기 위해 프로젝트 전체 Secret 읽기나 관리자 역할을 plan 계정에 추가하지 않는다. 오류를 무시하거나 state에서 리소스를 삭제하는 우회도 하지 않는다.

## 승인·적용 이후 검증

1. 위 적용 전 확인과 다른 CODEOWNER의 승인을 마친 뒤 #40을 머지한다.
2. AWS 중앙 수집기 준비 후 `observability_log_group` 출력을 레포 변수 `OBSERVABILITY_LOG_GROUP`에 설정한다.
3. 맥북에서 HTTPS remote-write를 연결하고 AWS·온프레미스의 실제 시계열을 중앙 Grafana에서 함께 확인한다.
4. GCP 관리자 최초 권한 설정 → GCP WIF 적용 → AWS 데이터 소스 설정 → 계측 버전의 GCP 앱 배포·실제 조회 순서로 검증한다.
5. AI artifact의 실행/attempt/SHA·관찰 창·수치와 대시보드를 대조하고, 실제 승격 결과는 Actions에서 별도로 확인한다. 실제 검증이 끝난 항목만 플랫폼 T17 이슈에서 체크한다.
