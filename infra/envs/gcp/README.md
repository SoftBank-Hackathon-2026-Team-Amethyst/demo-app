# GCP 환경과 중앙 Grafana 연결

GCP 배포는 기존 GCS state(`demo-app/gcp`)와 plan/deploy 서비스 계정을 유지한다. 앱 루트는 플랫폼 `v1.16.2` 모듈과 기존 `1.16.0` service-base 차트를 참조하며, PR에서 plan, main 머지 시 apply한다.

## 권한 설정 전

`grafana_eks_oidc_issuer`의 기본값은 빈 문자열이다. 이 상태에서는 기존 GCP 관측만 유지하며 Grafana용 WIF pool, provider, 서비스 계정과 IAM 바인딩을 생성하지 않는다. AWS의 `gcp_monitoring`도 `null`로 두므로 AWS·온프레미스 연결을 먼저 검증할 수 있다.

## 권한 설정 후 연결 순서

2026-10-10: deploy 계정의 WIF 관리 역할과 EKS 콘솔의 실제 issuer를 확인했고,
`grafana.auto.tfvars`에 issuer를 설정했다. 아직 WIF 생성/Cloud Monitoring 조회가 완료됐다는 뜻은 아니다.
CI의 `verify-helm-state`가 기존 release 조회에 실패하면 원인을 해결한 뒤 적용한다.
공개 식별자는 저장소에 둘 수 있지만 서비스 계정 private key는 생성하지 않는다.

1. GCP 관리자가 플랫폼의 [최초 권한 설정](https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform/blob/v1.16.2/bootstrap/gcp/README.md#t17-중앙-grafana-최초-연결-권한)을 적용한다. T4 배포 권한과 별도이며, 앱 파이프라인에서 자신의 IAM 권한을 늘리지 않는다.
2. AWS에서 실제 issuer를 조회한다. 아래 명령은 조회만 수행한다.

   ```bash
   aws eks describe-cluster --profile onetatchi --region ap-northeast-2 \
     --name one-tatchi --query 'cluster.identity.oidc.issuer' --output text
   ```

3. 조회한 값을 이 루트의 `grafana.auto.tfvars`에 `grafana_eks_oidc_issuer = "https://oidc.eks.…/id/…"`로 추가하는 후속 PR을 올린다. issuer는 공개 식별자다. PR의 생성 목록과 신뢰 대상(`system:serviceaccount:monitoring:grafana`)을 검토하고 main 파이프라인으로 적용한다. 로컬 apply는 실행하지 않는다.
4. GCP 적용이 끝나면 같은 backend에 연결해 `terraform output -json grafana_gcp_monitoring`을 조회한다. 반환된 프로젝트·provider·서비스 계정 식별자를 AWS 루트의 `grafana.auto.tfvars`에 `gcp_monitoring = { ... }`로 추가하는 별도 PR을 올린다. GCP와 AWS를 한 번에 활성화하면 생성 순서가 보장되지 않으므로 나누어 적용한다.
5. AWS 적용 후 Grafana의 GCP 데이터 소스에서 실제 CPU·메모리·앱 HTTP 시계열을 조회한다. 데이터 소스 생성 성공만으로 검증을 완료하지 않는다. 앱 HTTP 지표는 계측 코드가 포함된 버전의 GCP 앱 배포도 필요하다.

서비스 계정 private key나 비밀번호는 tfvars에 넣지 않는다. Grafana는 EKS 단기 토큰과 Monitoring Viewer 권한을 사용한다. 상세 검증은 플랫폼의 [관측 안내](https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform/blob/v1.16.2/docs/observability.md)를 따른다.
