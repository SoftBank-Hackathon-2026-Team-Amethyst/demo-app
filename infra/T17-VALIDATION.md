# T17 사전 검증과 적용 순서

2026-10-09 기준. 중앙 Grafana 실제 배포·연결 완료 기록이 아니라 PR #40의 사전 검증이다.

## 최신 main 통합

- T4의 AWS/GCP/온프레미스 배포 대상 선택과 test-only 수동 배포, T8 yolo 자동 머지, T26 승인·알림 입력을 보존했다.
- PR #43의 경로 필터를 유지한다. 공통 인프라 워크플로만 바뀌면 PR에서는 양쪽 plan, main에서는 apply를 생략한다. #40은 AWS/GCP 루트가 모두 바뀌므로 머지 시 두 대상의 apply가 실행된다.
- 워크플로·모듈·차트 참조를 `v1.16.0`으로 맞췄다. 실제 AWS Slack 봇의 `1.16.0` 이미지와 팀원 허용 목록을 유지한다. `.deploy/config.yaml`의 `compliance: regulated`는 변경하지 않았다.
- GCP의 Grafana 연결은 `grafana_eks_oidc_issuer = ""`, AWS는 `gcp_monitoring = null`로 비활성 상태다. 권한 설정 이후 [GCP 안내](envs/gcp/README.md)의 순서로 별도 활성화한다.

## 통과한 검사

- BE: `pnpm test`, `pnpm lint`, `pnpm build`. 정상·500·404 요청은 계측하고 health/metrics·smoke·Kubernetes/AWS/GCP 상태 확인 요청은 제외한다. URL·쿼리 문자열을 라벨로 노출하지 않는다.
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
