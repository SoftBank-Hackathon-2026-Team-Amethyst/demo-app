# AWS 환경

platform의 고정 태그 모듈로 팀 공용 인프라를 만든다.

- 서울 리전, AZ 2개, NAT 1개, EKS `one-tatchi`, `t3.medium` 노드 3대.
- RDS PostgreSQL 17(`db.t4g.micro`, 20GB, single AZ), ECR, 필수 애드온, CloudWatch·Grafana.
- T17: 중앙 Prometheus(7일·5Gi), EBS CSI·암호화 gp3, HTTPS remote-write 수신기와 AI 근거 로그 그룹.
- state 버킷·CI 역할·DNS 존은 기존 bootstrap 자원을 재사용한다.
- EKS 접근은 팀 관리자 SSO 역할과 CI deploy/plan 역할에 부여한다.

## 검증과 반영

platform의 `docs/aws-setup.md`대로 SSO 프로필을 준비한 뒤 이 디렉터리에서 실행한다. `<TF_STATE_BUCKET>`은 GitHub Variables의 값으로 바꾼다.

```bash
aws sso login --profile onetatchi
export AWS_PROFILE=onetatchi
terraform init -backend-config="bucket=<TF_STATE_BUCKET>"
terraform fmt -check
terraform validate
terraform plan
```

state key는 `demo-app/aws.tfstate`다. GitHub Actions가 PR에서 plan, **main 머지 시 apply**를 실행한다. 머지 전에 변경 목록과 비용을 확인하고, 로컬 apply를 동시에 실행하지 않는다.

T17 적용 전에 Actions secret `OBSERVABILITY_REMOTE_WRITE_PASSWORD`를 준비한다. apply 후 `observability_log_group` 출력값을 레포 변수 `OBSERVABILITY_LOG_GROUP`에 등록한다. 비밀번호는 Terraform에 넘기지 않는다. GCP 연결은 관리자 초기 설정 후 `gcp_monitoring`에 비밀값이 아닌 프로젝트·WIF provider·서비스 계정 식별자를 넘긴다. 자세한 절차는 platform의 `docs/observability.md`를 따른다.

보안 검사는 레포 루트에서 실행한다. 제외 경로는 다운로드된 외부 모듈의 미사용 예제이며, 참조한 Terraform 모듈은 검사한다. `.trivyignore`는 platform의 기존 EKS API·노드 egress 예외를 따른다.

```bash
trivy config --severity HIGH,CRITICAL --exit-code 1 \
  --skip-dirs '**/.terraform/**/examples' infra/envs/aws
```

## 생성 후 확인

```bash
terraform output
aws eks update-kubeconfig --profile onetatchi --region ap-northeast-2 --name one-tatchi
kubectl get nodes
kubectl get pods -A
kubectl get clustersecretstore cloud-secrets
helm list -A
```

노드 Ready, 애드온·SecretStore 정상, 클러스터 내부 DB 연결, Grafana·CloudWatch 수집을 확인한다. 후속 plan에서 의도하지 않은 변경이 없어야 한다. `database` 출력은 service-base 값에 연결하고 `secretName`을 추가한다.

이 루트는 팀 공용 개발 환경이다. RDS 삭제 보호는 꺼져 있고 최종 스냅샷은 기본으로 생략하므로, 데이터가 생긴 뒤 삭제 작업은 별도 검토한다. test/prod 앱 배포와 최종 HTTPS 연결은 별도 배포 작업에서 구성한다.
