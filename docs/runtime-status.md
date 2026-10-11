# Pod 카드의 Kubernetes API 전환

Pod 카드는 `/api/runtime`에서 BE 목록과 CPU·working-set 메모리를 받는다.
`/api/info`의 응답 기록과 `/api/metrics`의 기존 트래픽 차트는 유지한다.
트래픽 차트의 응답 샘플 TTL은 Pod 존재 여부 판단에 쓰지 않는다.

## 머지·적용 순서

이 PR은 **플랫폼 Runtime Status PR의 머지·릴리스에 의존한다.** 현재 존재하는 v2.14.0 태그는
새 조회 서비스 설치를 지원하지 않는다. 아직 없는 태그나 플랫폼 브랜치를 참조하도록 바꾸지 않는다.

1. 플랫폼 Runtime Status PR을 머지하고 새 태그의 이미지·Chart 발행을 완료한다.
2. 기존 template-update PR(또는 플랫폼의 `scripts/bump-template-version.sh`)로 이 브랜치의
   `.deploy/config.yaml`, 재사용 워크플로와 App Chart 버전을 실제 릴리스 태그로 올린다.
   AWS/GCP `infra_versions` 고정은 유지한다. 이 작업을 완료하기 전 앱 PR을 머지하지 않는다.
3. `.deploy/config.yaml`의 `runtime_status_values`를 새 배포 워크플로가 읽어 namespace별
   조회 서비스를 먼저 설치한다. `deploy/values-fe.yaml`의 `podNamespaceEnv: true`로
   FE에 자신의 namespace를 전달한다.
4. AWS·GCP·온프레미스의 test에서 Pod 2개 유지, HPA 스케일 변경, Blue·Green 전환,
   Metrics API 장애와 목록 조회 실패를 확인한 뒤 prod에 적용한다.

이 PR을 열 때는 배포·릴리스·머지를 수행하지 않는다.

## 화면 기준

- Pod 존재 여부는 성공한 Kubernetes 목록 조회 결과로 결정한다. UID를 카드 키로 사용한다.
- CPU는 millicores, 메모리는 MiB다. CPU에 100% 상한을 적용하지 않는다.
- CPU request와 실제 memory limit을 표시하고, memory limit이 없으면 막대를 그리지 않는다.
- 메트릭 없음과 사용량 0을 구분한다. 오래된 목록·메트릭은 지연 표시와 수집 시각을 보여 준다.
- Ready/전체 수와 Active/Preview/Inactive, Pending·Terminating·재시작 횟수를 표시한다.
- 영어·일본어·한국어를 지원한다.

nginx는 Pod의 DNS resolver와 Downward API의 namespace로 조회 서비스를 찾는다.
조회 서비스 DNS는 요청 시 해석하므로 서비스 장애가 FE 시작 실패로 이어지지 않는다.
생성한 nginx 설정은 읽기 전용 루트 대신 `/tmp`에 둔다.

## 로컬 개발·검증

FE 개발 서버는 `VITE_RUNTIME_API_URL`(기본 `http://localhost:8080`)을 별도 프록시한다.
클러스터 조회 서비스를 로컬 8080으로 port-forward하거나 API 계약과 같은 로컬 fixture를 사용한다.
조회 서비스가 없으면 카드에 조회 불가를 표시한다. 프로세스 CPU/RSS로 대체하지 않는다.

```sh
cd fe
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm build
```

PR의 추가 nginx 검사는 읽기 전용 컨테이너와 `/tmp` tmpfs에서 설정을 렌더링·검증한다.
