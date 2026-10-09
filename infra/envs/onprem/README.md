# infra/envs/onprem (v2)

`v2.0.0`의 온프레미스 모듈을 사용하는 기기별 로컬 state 루트다.
Terraform 1.11 이상과 플랫폼 `scripts/onprem/onpremctl.py`가 필요하다.

[설치·운용·기존 state 이전·잠금 검증](https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform/blob/v2.0.0/scripts/onprem/README.md)을 따른다.

인증정보는 관리 도구가 ephemeral 입력으로 공급한다. 비밀번호나 관리자 개인키를 tfvars에 쓰지 않는다.
새 기기만 cluster → cluster_addons → 전체 apply 순서로 만든다.
기존 기기는 원본 state를 보존하고 **apply 전에** 암호화 백업과 `migrate-state`를 수행한다.
클러스터만 있고 state가 없으면 재생성하지 않는다.

화면 잠금 중에는 충전기·네트워크와 열린 덮개를 유지한다. 재부팅 후 로그인 한 번으로 기존 서비스가 시작된다.
터널 주소는 `onpremctl.py … status`로 확인한다. Quick Tunnel은 재시작 후 주소가 바뀔 수 있다.

T17의 로컬 Prometheus 수집을 유지한다. 중앙 전송은 기본값에서 꺼져 있다. `monitoring` namespace에 username/password Secret을 만든 뒤 `metrics_remote_write_url`, `metrics_remote_write_secret_name`, `metrics_dashboard_url`을 설정하면 AWS 중앙 Grafana에 표시된다. 비밀번호는 tfvars에 넣지 않는다. 수신 주소는 AWS 루트의 `observability_remote_write_url` 출력값이다. 기존 `t17-local` 검증 클러스터는 별도로 보존한다.
