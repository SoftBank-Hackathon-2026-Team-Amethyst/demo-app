# infra/envs/onprem

맥북(k3d)을 온프레미스 대상으로 쓰는 Terraform 루트. 플랫폼 모듈을 `?ref=v1.x.y` 태그로 참조한다.
state는 이 맥북의 `terraform.tfstate`에만 있다(.gitignore). 다른 맥북에서 쓰려면 처음부터 새로 만든다.

```bash
# 처음: provider가 클러스터 출력값을 쓰므로 클러스터를 먼저 만든다
terraform init
terraform apply -target=module.cluster
terraform apply

# 앱 배포 (App Chart는 GHCR OCI)
C=oci://ghcr.io/softbank-hackathon-2026-team-amethyst/charts
helm upgrade --install demo-app-base $C/service-base --version 1.1.0 -f deploy/onprem/service-base.yaml
helm upgrade --install demo-app-be $C/app --version 1.1.0 -n test --server-side=false --wait=legacy \
  -f deploy/values-be.yaml -f deploy/onprem/values.yaml --set image.tag=<tag> --set-file migration.sql=db/init.sql
helm upgrade --install demo-app-fe $C/app --version 1.1.0 -n test --server-side=false --wait=legacy \
  -f deploy/values-fe.yaml -f deploy/onprem/values.yaml --set image.tag=<tag>

# 외부 주소 (Quick Tunnel, cloudflared 재시작 시 바뀜)
kubectl -n cloudflared logs deploy/cloudflared | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1
```

Helm 4에서 `--server-side=false`가 없으면 두 번째 배포부터 Argo Rollouts와 Service selector 충돌로 실패하고,
기본 `--wait`는 Rollout 상태를 읽지 못해 실패한다.
