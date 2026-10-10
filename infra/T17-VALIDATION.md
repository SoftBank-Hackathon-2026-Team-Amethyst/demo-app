# T17 GCP 인증 후속 검증 — 2026-10-10

- 앱 #73과 AWS apply [38047330479](https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/demo-app/actions/runs/38047330479)은 성공했지만 Cloud Monitoring의 실제 health에서 ADC 누락이 확인됐다.
- 실제 Grafana deployment의 `gcp-token`이 `projected` 대신 `emptyDir`로 렌더링됐고, Grafana 13.2.3 플러그인 프로세스는 ADC 환경변수를 기본 상속하지 않는다.
- 플랫폼 [#203](https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform/pull/203), v1 호환 [#204](https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform/pull/204)로 `extraContainerVolumes`와 `plugins.forward_host_env_vars=stackdriver`를 적용했다. 양쪽 전체 CI 통과. Terraform test 5개씩 통과, 실제 chart13.2.7 렌더링으로 단기 토큰·read-only mount·ADC·플러그인 설정을 검사했다.
- AWS 인프라 참조를 v1.16.3으로 갱신한다. network/cluster/registry/database/cluster_addons는 v1.16.1 대비 코드 변경 없음. 실제 plan은 중앙 Grafana Helm update만 포함하는지 확인한다. 장기 GCP 키나 IAM 확대는 없다.
- secondary 실제 검증 [38047517925](https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/demo-app/actions/runs/38047517925)은 main208c12a / onprem-secondary / test / verify-observability=true로 시작했다. 해당 검증과 cleanup이 끝나기 전 중앙 Grafana 반영을 시작하지 않는다.

---

# T17 사전 검증과 적용 순서

## 2026-10-10 20:04 KST — GCP WIF 적용 성공

이 절이 아래 이전 기록보다 우선한다. 제어된 트래픽·AI 원본 비교 실측은 아직 미완료다.

- 앱 #72(v2.7.0 자동 갱신), #71(GCP v1.16.2 및 수정 연결)이 모두 병합됐다. #71은 CODEOWNER 승인 후 main `3af31ec`로 병합됐으며 앱 test/prod 배포는 실행되지 않았다.
- [infra apply 38046968776](https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/demo-app/actions/runs/38046968776)에서 GCP WIF 자원 3개 생성, 변경·삭제 0개로 성공했다. 기존 Grafana 서비스 계정·Monitoring Viewer member와 Helm 릴리스는 유지됐다.
- 위 실행의 실제 `grafana_gcp_monitoring` 출력으로 AWS `gcp-monitoring.auto.tfvars`를 구성했다. 공개 프로젝트·provider·서비스 계정 식별자만 포함하며 EKS 단기 토큰 교환을 사용한다. 장기 키나 비밀번호를 추가하지 않는다. AWS plan 검토·적용 후 Cloud Monitoring 실제 쿼리까지 확인해야 한다.
- secondary v2.7.0 [plan 38047008159](https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/demo-app/actions/runs/38047008159)은 관측 Helm update 하나만 허용하고 성공했다. [apply 38047096594](https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/demo-app/actions/runs/38047096594)도 성공했다. 중앙 Prometheus의 `count by (target,cluster) (up)`에서 AWS `one-tatchi` 10개와 onprem `onetouch-hyeongrae` 7개 시계열을 함께 확인했다.
- AWS DB tailnet peer가 Online으로 복구된 것은 확인했다. active BE 정상화와 기존 green 정리 허용은 별도 확인이 필요하다.

## 2026-10-10 19:40 KST 재개 — 현재 상태

이 절이 아래 이전 사전 기록보다 우선한다. 실측 완료 기록은 아직 없다.

- 앱 PR #62가 병합되어 main `fa501c9`의 infra run [38043939894](https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/demo-app/actions/runs/38043939894)에서 AWS 적용이 성공했다. 공개 `https://onetatchi.soulee.dev/grafana/api/health`가 `200 application/json`, database `ok`, Grafana `13.2.3`을 반환한다. CloudWatch·Prometheus 데이터 소스를 확인했다.
- 같은 run의 GCP 적용은 Workload Identity Pool 표시 이름이 32자를 넘어 실패했다. Grafana 서비스 계정과 Monitoring Viewer member는 생성된 상태다. v1.16.2 호환 패치로 GCP 참조만 갱신해 기존 state에서 재개한다. AWS v1.16.1 및 서비스·봇 버전은 보존한다.
- platform PR #192의 FE·BE private preview 검사와 전송 오류 구분을 포함하는 v2.7.0을 소비한다. 기존 클라우드 기반 모듈은 v1이며, v2 전용 preview_auth와 db_link만 앱 버전을 따른다. DB 링크 구현은 기존 v2.5.1과 동일하다.
- secondary plan [38045333705](https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/demo-app/actions/runs/38045333705)은 `module.observability.helm_release.metrics` update 하나만 허용하고 성공했다. apply [38045469899](https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/demo-app/actions/runs/38045469899)는 저장 plan의 ephemeral 인증 재주입 누락으로 실패했다. 플랫폼 PR #197에서 수정했으며 v2.7.0으로 재시도한다. 중앙 수신은 별도로 확인한다.
- AWS test에 다른 실행의 green(BE `864f777c66` Degraded, FE `5466c9d7fc` Paused)이 남아 있다. 현재 active BE `5b84dd7b9`도 DB 연결 timeout으로 CrashLoopBackOff다. active 복구와 기존 green 정리 권한 확인 전에는 T17 실측을 시작하지 않는다.

## 2026-10-10 연결 구현 — 적용·실측은 아직 미완료

기준 main: app `b8bc6d8`, platform `43a2d4a`. APP_VERSION v2·FE 브라우저 p95·T31 SSO preview·T29 HPA 변경을 통합했으며 기존 앱/온프레미스 v2와 AWS/GCP v1의 분리 고정을 유지한다.
이 변경은 플랫폼 `v2.3.0`과 AWS 호환 패치 `v1.16.1`의 **발행 이후** PR CI와 적용을 진행한다.
플랫폼 PR #172와 v1 PR #173은 전체 CI 통과 후 병합됐다. [v2.3.0 release](https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform/actions/runs/38038263844)와 [v1.16.1 release](https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform/actions/runs/38038263591)의 chart·다중 아키텍처 이미지 발행이 모두 성공했다. 실제 앱/인프라 적용은 이 PR의 plan 검토 후 진행한다.

- EKS 콘솔에서 `one-tatchi`의 issuer를 실제 확인해 GCP `grafana.auto.tfvars`에 반영했다.
  `https://oidc.eks.ap-northeast-2.amazonaws.com/id/DC33A5AD79B3A60D07F7CCD1FAC56014`는 공개 식별자다.
- AWS 관측은 운영 앱의 `demo-app-prod` ALB 그룹과 HTTPS host를 사용한다. 새 `dashboard_url` 출력으로 실제 대시보드 주소를 제공한다.
- GCP CI는 `verify-helm-state`로 동일 identity의 기존 Helm 조회를 먼저 검사한다. 기존 Helm 생성 5개와 WIF 신규 자원 5개는 주소로 구분한다. 합계만 보고 승인하지 않는다.
- `onprem-observability`는 main 수동 실행만 허용한다. `secondary`의 실제 클러스터는 `onetouch-hyeongrae`, 기존 state root는 `.one-tatchi-t27/infra`다. `plan` 후 `apply`를 순서대로 실행한다. apply 실행도 전체 plan을 검사하며, 관측 Helm update/no-op만 포함된 해당 저장 plan을 적용한다. DB·클러스터 변경이나 state 변경은 중단한다.
- GCP 적용 후 출력된 `grafana_gcp_monitoring`은 아직 AWS에 넣지 않았다. 생성 성공을 확인한 뒤 별도 PR에서 연결한다. provider 식별자를 추측해 선입력하지 않는다.

### 적용 순서

1. 플랫폼 PR의 CI를 통과시킨다. HTTPS 모듈과 GCP 리소스 서비스 필터 수정만 v1.16.0에 backport한 `v1.16.1`, 새 workflow를 포함한 v2 `v2.3.0`을 발행한다. v1 backport는 v1.16.0 기준으로 별도 검증하며 v2 main에 병합하지 않는다. 기존 고정 태그는 수정하지 않는다.
2. 이 앱 PR의 plan을 검토한다. AWS는 관측 Ingress/Grafana/receiver 변경만 의도하며, Slack 봇 다운그레이드·pending 작업이나 DB/클러스터 변경이 있으면 해당 apply를 진행하지 않는다.
3. GCP 기존 Helm 조회가 성공하고 WIF 신뢰 대상이 `system:serviceaccount:monitoring:grafana`인지 확인한 뒤 main 파이프라인으로 적용한다. plan 계정이 조회하지 못하면 실제 오류에 필요한 최소 권한을 별도 검토한다.
4. GCP 실제 출력을 AWS `gcp_monitoring`에 연결하는 후속 PR을 적용한다. `OBSERVABILITY_LOG_GROUP`과 remote-write 출력도 실제 값으로 대조한다.
5. 중앙 HTTPS receiver가 준비되면 `onprem-observability(profile=secondary, mode=plan)`을 검토하고 `mode=apply`를 실행한다. 기존 Secret 비밀번호는 GitHub Secret과 같은 값으로 주입한다.
6. 아래 수동 실측을 AWS → onprem-secondary → GCP 순서로 실행한다. test의 새 green만 검사하고 정리한다. prod는 조회만 한다.
7. 동일 run/attempt/SHA의 AI artifact와 Grafana 원본 근거를 대조한다. 쿼리·관찰 창·실행 링크를 아래에 기록한 뒤 T17 이슈를 체크한다.

### 2026-10-10 재개 세션의 확인 결과

- GitHub HTTPS·Git CLI, AWS SSO/STS와 EKS 조회가 정상이다. 두 온프레미스 runner는 online이다.
- Python 84개, Terraform fmt, app/observability/grafana-wif Helm lint, private preview 12개·preview-auth 회귀와 deploy-provision 산출물 회귀가 통과했다.
- AWS 관측 모듈은 v1/v2 모두 init/validate와 Terraform test 5개씩 통과했다. 이전 세션의 provider socket 제한은 현재 재현되지 않았다.
- 앱 AWS/GCP 루트는 위 고정 태그로 init/validate가 통과했다. 앱 actionlint가 통과했다. 플랫폼은 기존 create-github-app-token v3의 client-id/app-id 메타데이터 불일치가 4개 사용처(8개 진단)에 남아 있다. 플랫폼 PR #172와 v1 PR #173에서 전체 Linux CI(terraform/charts/scripts/iac-scan/nginxlog-exporter/slack-bot)가 통과했다.
- AWS slack-bot Helm revision 6은 deployed, 실제 봇 이미지는 1.16.0이며 Healthy다. 과거 pending-upgrade는 해결됐다.
- 공개 `/grafana/api/health`는 여전히 `200 text/html` 앱 SPA다. EKS 내부 Grafana/collector/receiver 파드는 Running이다. HTTPS 경로 적용 후 JSON을 다시 확인한다.
- EKS 내부 Grafana 13.2.3 JSON health가 정상이며 CloudWatch/Prometheus 데이터 소스를 확인했다. `count by (target,cluster) (up)`은 AWS `one-tatchi`의 11개 시계열을 반환했다. GCP 데이터 소스는 아직 없고 온프레미스 시계열도 확인되지 않았다.
- AWS test BE/FE에 다른 배포의 Paused green이 있다. 이를 변경하지 않고 T17 실측은 기존 blue와 prod가 Healthy인 상태에서만 실행한다.
- cloud apply, secondary remote-write, 실제 세 대상 지표/AI 원본 대조는 아직 미완료다.

### 로컬 구현 위치

- platform: `../one-tatchi-platform-t17`, `feat/t17-live-integration`. HTTPS 모듈, Helm 조회 검사, 기존 온프레미스 관측 설정 workflow.
- AWS 호환 패치: `../one-tatchi-platform-t17-v1`, `release/t17-v1.16.1`. AWS HTTPS 모듈·GCP 리소스 필터·검사·changelog만 변경하며 다른 v1 모듈/차트/봇은 유지.
- app: 이 작업 트리 `demo-app-t17`, `feat/t17-live-integration`. 고정 버전·GCP issuer·workflow 입력 연결.

플랫폼 PR #172와 v1 PR #173의 CI·릴리스를 확인한다. 두 릴리스 성공을 확인했으며 앱 PR의 plan을 자원별로 검토한 뒤 보호 규칙에 따라 병합한다.

### 수동 실측 실행과 완료 증거

2026-10-10 마지막 실제 조회에서 `/grafana/api/health`는 Grafana JSON 대신 prod 앱 SPA를
반환했다. PR #40 적용 run `37919444319`는 AWS 실패/GCP 성공이며 당시 WIF는 비활성이었다.
이후 run `38023785045`는 changes만 실행했으므로 인프라 적용 성공 증거가 아니다.
이 항목은 배포 후 재조회해야 한다. T17 #12는 마지막 조회 기준 Open / In progress / 0 of 3.

중앙 Grafana 연결·WIF·remote-write 적용 후, 기존 test blue와 prod가 모두 Healthy인 각 대상에서:

```bash
gh workflow run deploy.yml --repo SoftBank-Hackathon-2026-Team-Amethyst/demo-app \
  --ref main -f target=aws -f environment=test -F verify-observability=true
```

해당 실행이 정리까지 끝난 후 target을 `onprem-secondary`, `gcp`로 바꿔 차례로 실행한다.
기본값은 false다. true일 때 main 수동 test만 허용하고 prod job은 실행하지 않는다.
검증에 새 green이 필요해 run marker를 넣으며 migration hook/자동 승격과 test SSO preview는 끈다.
test SSO preview는 다음 정상 배포에서 정규 values로 복원된다. prod preview는 변경하지 않는다.
HPA가 선택한 green 파드를 교체하면 검증은 실패하고 이번 green을 정리한다.
선택한 green 파드에서 정상 BE/FE 20회씩, BE 100% 오류 5회, 300ms 지연 10회를 보낸다.
warm-up은 별도 기록하며 AI smoke는 runtime 카운터에서 제외된다. FE API는 active BE를
호출하므로 FE에는 정적 `/` 요청만 보낸다. 원본 누적 counter·histogram과 실제 Grafana 쿼리,
동일 run/attempt/SHA/관찰 창의 AI 원본을 대조하고 이번 green만 abort한다.

실행별 `t17-observability-<target>-<run>-<attempt>`와 `promote-judgment-test` artifact를 보존한다.
`verify-result.json` 및 `cleanup-result.json`이 passed여야 하며, 실제 Grafana에서 같은 시간/서비스/run
필터로 AWS+onprem 동시 표시, GCP 연결, AI 실행 링크를 확인한다. 다음 표는 실제 실행 후에만 채운다.

| 대상 | run/attempt · SHA | 실측/AI 비교 | green 정리 · blue/prod 확인 | Grafana 화면 |
| --- | --- | --- | --- | --- |
| AWS | 미실행 | 미확인 | 미확인 | 미확인 |
| onprem-secondary | 미실행 | 미확인 | 미확인 | 미확인 |
| GCP | 미실행 | 미확인 | 미확인 | 미확인 |

runner 강제 종료 시 cleanup이 보장되지 않으므로 실행을 임의 취소하지 않는다. 복구가 필요하면
artifact의 baseline/marker와 현재 active hash를 대조한 후 그 실행의 test green만 abort한다.
구체적인 검사·복구 계약은 플랫폼 `docs/observability.md`의 실제 배포 검증 모드를 따른다.

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
