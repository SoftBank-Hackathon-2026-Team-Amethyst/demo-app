# infra/envs/onprem

맥북(k3d)을 온프레미스 대상으로 쓰는 Terraform 루트. 플랫폼 모듈을 `?ref=v1.x.y` 태그로 참조한다.
state는 이 맥북의 `terraform.tfstate`에만 있다(.gitignore). 다른 맥북에서 쓰려면 처음부터 새로 만든다.

만드는 것: k3d 클러스터, Argo Rollouts · External Secrets, 환경(test · prod)마다 네임스페이스 · Postgres · DB 접속 Secret · Cloudflare Quick Tunnel.

```bash
# 처음: provider가 클러스터 출력값을 쓰므로 클러스터를 먼저 만든다
terraform init
terraform apply -target=module.cluster
terraform apply

# 외부 주소 (Quick Tunnel, cloudflared 재시작 시 바뀜)
terraform output public_url_commands
```

앱 배포는 사람이 하지 않는다. `.github/workflows/deploy.yml`이 맥북의 self-hosted runner(라벨 `onprem`)에서
`yolo/*` push → test, `main` push → test → prod(승인)로 올린다.

손으로 `helm upgrade`할 때는 Helm 4에서 `--server-side=false --wait=legacy`가 필요하다.
없으면 두 번째 배포부터 Argo Rollouts와 Service selector 충돌로 실패하고, 기본 `--wait`는 Rollout 상태를 읽지 못한다.
