# 예산 분석

분석일: 2026-10-10 (yolo 재검증, 기준 커밋 b8bc6d8)

같은 날 2차 분석(커밋 3b0caf7, 단가 조회 2026-10-09T14:06:30Z)이 있어 `git log 3b0caf7..HEAD`의 변경만 델타 재검증했다. 자원 구성이 바뀐 것은 **T31 green 미리보기**(Cognito User Pool + Secrets Manager 시크릿 1개 + oauth2-proxy)뿐이고, 서비스별 replicas · resources는 트래픽 분석과 같이 변경 없음(`changed_since_previous: false`). 아래 표 · 판정 · 조회 시각 · 미산정 사유는 도구(`price.py map → lookup → reuse-prices → calculate → report`)가 생성한 그대로이며, 사람이 쓴 설명은 맨 끝 "재검증 메모와 분석기 가정" 절에만 있다.

## 예산 범위

0원 ~ 100,000원

기본 단가는 공개 종량제 USD 기준이며 세금·크레딧·약정·계정별 할인은 제외합니다.

## 후보별 예상 월 비용

| 대상 · 후보 | 구성 | 고정비 (USD 소계) | 변동비 (USD 소계) | 전체 (USD) | 앱 추가 (USD) | 전체 원화 | 예산 판정 | 조회/시도 시각 (UTC) |
|---|---|---|---|---|---|---|---|---|
| AWS · demo-aws | 가정 포함 | USD 306.023 | USD 25.95 이상 (상한 미정) | 확인된 소계 USD 331.973 이상 (상한 미정); 추가 비용 미정 | 확인된 소계 USD 92.445 이상 (상한 미정); 추가 비용 미정 | 미산정 | 예산 초과 (전체) | 2026-10-09T14:06:30Z |
| GCP · demo-gcp | 가정 포함 | USD 306.6459268 | USD 3.65 이상 (상한 미정) | 확인된 소계 USD 310.2959268 이상 (상한 미정); 추가 비용 미정 | 미산정 | 미산정 | 예산 초과 (전체) | 2026-10-09T14:06:30Z |
| 온프레미스 · demo-onprem | 명시 | USD 0 | USD 0 | USD 0 | USD 0 | 0원 | 판정 미정 (전체) | 2026-10-09T14:06:30Z |

부분 결과의 소계는 전체 합계가 아닙니다. 상한과 미산정 항목을 함께 확인하세요.

## 환율 근거

- USD 1 = 1,341.486704원; 기준일 2026-10-09; 출처 ECB EXR daily reference rates 2026-10-09 (data-api.ecb.europa.eu EXR/D.KRW.EUR.SP00.A 1503.27 ÷ EXR/D.USD.EUR.SP00.A 1.1206), 2026-10-10 조회, 소수 6자리 반올림

## 예산 경고와 절감안

- demo-aws: 예산 초과: 알려진 비용 하한만으로도 예산 상한을 넘습니다.
  - 절감액 미산정: 별도 대안 견적이 없습니다. 노드·DB·NAT 등 큰 비용 항목의 대안을 검토하고, 가용성·규제 조건을 확인한 뒤 별도로 계산해야 합니다.
- demo-gcp: 예산 초과: 알려진 비용 하한만으로도 예산 상한을 넘습니다.
  - 절감액 미산정: 별도 대안 견적이 없습니다. 노드·DB·NAT 등 큰 비용 항목의 대안을 검토하고, 가용성·규제 조건을 확인한 뒤 별도로 계산해야 합니다.
- demo-onprem: 판정 미정: 예산·환율·미산정 비용·구성 조건을 확인해야 합니다.
  - 절감액 미산정: 별도 대안 견적이 없습니다. 노드·DB·NAT 등 큰 비용 항목의 대안을 검토하고, 가용성·규제 조건을 확인한 뒤 별도로 계산해야 합니다.

## 미산정 항목과 실패 사유

- demo-aws / aws-nat-processed\_data: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-aws / aws-nat-processed\_data: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-aws / aws-alb-lcu\_hours: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-aws / aws-alb-lcu\_hours: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-aws / aws-registry-storage: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-aws / aws-registry-storage: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-aws / aws-observability-ingestion: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-aws / aws-observability-ingestion: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-aws / aws-observability-storage: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-aws / aws-observability-storage: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-aws / aws-egress-transfer: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-aws / aws-egress-transfer: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-aws / aws-metrics-metrics: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-aws / aws-metrics-metrics: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-aws / aws-secrets-storage: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-aws / aws-secrets-storage: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-aws / aws-secrets-access: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-aws / aws-secrets-access: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-aws / aws-audit-storage: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-aws / aws-audit-storage: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-aws / aws-audit-write\_requests: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-aws / aws-audit-write\_requests: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-aws / aws-audit-read\_requests: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-aws / aws-audit-read\_requests: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-aws / aws-nat-processed\_data: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-aws / aws-nat-processed\_data: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-aws / aws-alb-lcu\_hours: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-aws / aws-alb-lcu\_hours: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-aws / aws-registry-storage: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-aws / aws-registry-storage: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-aws / aws-observability-ingestion: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-aws / aws-observability-ingestion: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-aws / aws-observability-storage: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-aws / aws-observability-storage: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-aws / aws-egress-transfer: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-aws / aws-egress-transfer: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-aws / aws-metrics-metrics: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-aws / aws-metrics-metrics: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-aws / aws-secrets-storage: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-aws / aws-secrets-storage: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-aws / aws-secrets-access: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-aws / aws-secrets-access: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-aws / aws-audit-storage: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-aws / aws-audit-storage: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-aws / aws-audit-write\_requests: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-aws / aws-audit-write\_requests: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-aws / aws-audit-read\_requests: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-aws / aws-audit-read\_requests: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-gcp / gcp-cluster-cluster\_hours: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-gcp / gcp-nodes-cpu\_hours: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-gcp / gcp-nodes-memory\_hours: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-gcp / gcp-node-disks-storage: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-gcp / gcp-nat-gateway\_hours: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-gcp / gcp-nat-processed\_data: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-nat-processed\_data: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-gcp / gcp-ingress-test-load\_balancer\_hours: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-ingress-test-load\_balancer\_hours: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-gcp / gcp-ingress-test-processed\_data: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-ingress-test-processed\_data: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-gcp / gcp-ingress-test-outbound-data: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-ingress-test-outbound-data: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-gcp / gcp-ingress-prod-load\_balancer\_hours: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-ingress-prod-load\_balancer\_hours: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-gcp / gcp-ingress-prod-processed\_data: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-ingress-prod-processed\_data: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-gcp / gcp-ingress-prod-outbound-data: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-ingress-prod-outbound-data: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-gcp / gcp-db-instance\_hours: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-gcp / gcp-db-storage: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-gcp / gcp-registry-storage: 무료 구간의 적용 조건·기존 사용량 미확인; Catalog free tiers need explicit verified eligibility and account/project baseline
- demo-gcp / gcp-observability-ingestion: 무료 구간의 적용 조건·기존 사용량 미확인; Catalog free tiers need explicit verified eligibility and account/project baseline
- demo-gcp / gcp-observability-storage: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-observability-storage: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-gcp / gcp-egress-transfer: 계정·프로젝트의 기존 사용량 미정; Account/project tier baseline must be supplied explicitly
- demo-gcp / gcp-addresses-address\_hours: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-addresses-address\_hours: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-gcp / gcp-metrics-metrics: 계정·프로젝트의 기존 사용량 미정; Account/project tier baseline must be supplied explicitly
- demo-gcp / gcp-secrets-storage: 무료 구간의 적용 조건·기존 사용량 미확인; Catalog free tiers need explicit verified eligibility and account/project baseline
- demo-gcp / gcp-secrets-access: 무료 구간의 적용 조건·기존 사용량 미확인; Catalog free tiers need explicit verified eligibility and account/project baseline
- demo-gcp / gcp-audit-storage: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-audit-storage: 앱 추가 사용량 또는 상관관계 미정; Incremental usage or correlation with total usage is unresolved
- demo-gcp / 구성: 수용량·증설 검토 필요; Traffic or supplied cluster capacity is unknown; node quantity is not changed automatically
- demo-gcp / gcp-cluster-cluster\_hours: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-gcp / gcp-nodes-cpu\_hours: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-gcp / gcp-nodes-memory\_hours: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-gcp / gcp-node-disks-storage: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-gcp / gcp-nat-gateway\_hours: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-gcp / gcp-nat-processed\_data: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-nat-processed\_data: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-gcp / gcp-ingress-test-load\_balancer\_hours: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-ingress-test-load\_balancer\_hours: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-gcp / gcp-ingress-test-processed\_data: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-ingress-test-processed\_data: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-gcp / gcp-ingress-test-outbound-data: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-ingress-test-outbound-data: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-gcp / gcp-ingress-prod-load\_balancer\_hours: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-ingress-prod-load\_balancer\_hours: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-gcp / gcp-ingress-prod-processed\_data: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-ingress-prod-processed\_data: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-gcp / gcp-ingress-prod-outbound-data: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-ingress-prod-outbound-data: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-gcp / gcp-db-instance\_hours: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-gcp / gcp-db-storage: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-gcp / gcp-registry-storage: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-registry-storage: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-gcp / gcp-observability-ingestion: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-observability-ingestion: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-gcp / gcp-observability-storage: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-observability-storage: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-gcp / gcp-egress-transfer: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-egress-transfer: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-gcp / gcp-addresses-address\_hours: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-addresses-address\_hours: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-gcp / gcp-metrics-metrics: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-metrics-metrics: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-gcp / gcp-secrets-storage: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-secrets-storage: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-gcp / gcp-secrets-access: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-secrets-access: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-gcp / gcp-audit-storage: 월 사용량 또는 상한 미정; Monthly usage is unknown or unbounded
- demo-gcp / gcp-audit-storage: 앱 추가 사용량 또는 상관관계 미정; App addition usage is unknown or unbounded
- demo-onprem / 구성: 수용량·증설 검토 필요; Traffic or supplied cluster capacity is unknown; node quantity is not changed automatically
- demo-onprem / 구성: 온프레미스 운영 비용 미산정; Onprem power operating cost is not estimated
- demo-onprem / 구성: 온프레미스 운영 비용 미산정; Onprem hardware operating cost is not estimated
- demo-onprem / 구성: 온프레미스 운영 비용 미산정; Onprem labor operating cost is not estimated

## 가격 근거

| 후보 | 비용 항목 | SKU | 출처 | 단위 | 가격 적용 시점 |
|---|---|---|---|---|---|
| demo-aws | aws-cluster-cluster\_hours | 8HAE52ZNS3QC3Q8Q | https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API\_pricing\_GetProducts.html | hour | 2026-09-01T00:00:00Z |
| demo-aws | aws-nodes-instance\_hours | G5CAZXC4M5ENHEZN | https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API\_pricing\_GetProducts.html | hour | 2026-10-01T00:00:00Z |
| demo-aws | aws-node-disks-storage | MTK7D9SGKGYR3JD6 | https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API\_pricing\_GetProducts.html | gb\_month | 2026-10-01T00:00:00Z |
| demo-aws | aws-nat-gateway\_hours | P63FHTYZXQBC6HX5 | https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API\_pricing\_GetProducts.html | hour | 2026-10-01T00:00:00Z |
| demo-aws | aws-nat-processed\_data | HC3MBQKUG7PB4BYX | https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API\_pricing\_GetProducts.html | gb | 2026-10-01T00:00:00Z |
| demo-aws | aws-alb-load\_balancer\_hours | VUV9M7PZ543S2SC9 | https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API\_pricing\_GetProducts.html | hour | 2026-08-01T00:00:00Z |
| demo-aws | aws-alb-lcu\_hours | CX4ZBV2SE6F5HJV3 | https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API\_pricing\_GetProducts.html | lcu\_hour | 2026-08-01T00:00:00Z |
| demo-aws | aws-db-instance\_hours | ZBMXF2F4CYQ2FT96 | https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API\_pricing\_GetProducts.html | hour | 2026-10-01T00:00:00Z |
| demo-aws | aws-db-storage | 8TFTRRBWJSP95DQP | https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API\_pricing\_GetProducts.html | gb\_month | 2026-10-01T00:00:00Z |
| demo-aws | aws-registry-storage | FP58BXCX2RHZR3B2 | https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API\_pricing\_GetProducts.html | gb\_month | 2025-11-01T00:00:00Z |
| demo-aws | aws-observability-ingestion | 5P9Q77R2ADUJCNJ2 | https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API\_pricing\_GetProducts.html | gb | 2026-10-01T00:00:00Z |
| demo-aws | aws-observability-storage | E7V5NF3GN7MQKCB6 | https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API\_pricing\_GetProducts.html | gb\_month | 2026-10-01T00:00:00Z |
| demo-aws | aws-egress-transfer | 9AS8NERTGECRPGT7 | https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API\_pricing\_GetProducts.html | gb | 2026-06-01T00:00:00Z |
| demo-aws | aws-addresses-address\_hours | ZKBHEVDXYBRCKFQ8 | https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API\_pricing\_GetProducts.html | hour | 2026-09-01T00:00:00Z |
| demo-aws | aws-metrics-metrics | 92QAN7T7PQUAG6NQ | https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API\_pricing\_GetProducts.html | metric\_month | 2026-10-01T00:00:00Z |
| demo-aws | aws-secrets-storage | 8TY6BPQ52JVYCRQD | https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API\_pricing\_GetProducts.html | secret\_month | 2025-07-01T00:00:00Z |
| demo-aws | aws-secrets-access | 9779GVGYGTKZ2UJA | https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API\_pricing\_GetProducts.html | request | 2025-07-01T00:00:00Z |
| demo-aws | aws-audit-storage | 3JSN7K7UDDNCYCDM | https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API\_pricing\_GetProducts.html | gb\_month | 2026-09-01T00:00:00Z |
| demo-aws | aws-audit-write\_requests | D3S5DN86CFPGUM5G | https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API\_pricing\_GetProducts.html | request | 2026-09-01T00:00:00Z |
| demo-aws | aws-audit-read\_requests | 84G6KSFBGCU9CEC9 | https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API\_pricing\_GetProducts.html | request | 2026-09-01T00:00:00Z |
| demo-aws | aws-metrics-disk-storage | MTK7D9SGKGYR3JD6 | https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API\_pricing\_GetProducts.html | gb\_month | 2026-10-01T00:00:00Z |
| demo-gcp | gcp-cluster-cluster\_hours | B561-BFBD-1264 | https://docs.cloud.google.com/billing/docs/reference/pricing-api/rest/v2beta/skus.price/get | hour | 공급 API 미제공 (최신 단가 조회) |
| demo-gcp | gcp-nodes-cpu\_hours | 9304-94C4-2117 | https://docs.cloud.google.com/billing/docs/reference/pricing-api/rest/v2beta/skus.price/get | vcpu\_hour | 공급 API 미제공 (최신 단가 조회) |
| demo-gcp | gcp-nodes-memory\_hours | D715-4E57-BAFB | https://docs.cloud.google.com/billing/docs/reference/pricing-api/rest/v2beta/skus.price/get | gib\_hour | 공급 API 미제공 (최신 단가 조회) |
| demo-gcp | gcp-node-disks-storage | 0306-B164-A7B7 | https://docs.cloud.google.com/billing/docs/reference/pricing-api/rest/v2beta/skus.price/get | gib\_month | 공급 API 미제공 (최신 단가 조회) |
| demo-gcp | gcp-nat-gateway\_hours | 32E2-4EFC-EF9F | https://docs.cloud.google.com/billing/docs/reference/pricing-api/rest/v2beta/skus.price/get | hour | 공급 API 미제공 (최신 단가 조회) |
| demo-gcp | gcp-nat-processed\_data | 015F-5732-FFF0 | https://docs.cloud.google.com/billing/docs/reference/pricing-api/rest/v2beta/skus.price/get | gib | 공급 API 미제공 (최신 단가 조회) |
| demo-gcp | gcp-ingress-test-load\_balancer\_hours | DEE3-C42E-3E4D | https://docs.cloud.google.com/billing/docs/reference/pricing-api/rest/v2beta/skus.price/get | hour | 공급 API 미제공 (최신 단가 조회) |
| demo-gcp | gcp-ingress-test-processed\_data | 147E-ED36-67D1 | https://docs.cloud.google.com/billing/docs/reference/pricing-api/rest/v2beta/skus.price/get | gib | 공급 API 미제공 (최신 단가 조회) |
| demo-gcp | gcp-ingress-test-outbound-data | 3C98-FAA0-7935 | https://docs.cloud.google.com/billing/docs/reference/pricing-api/rest/v2beta/skus.price/get | gib | 공급 API 미제공 (최신 단가 조회) |
| demo-gcp | gcp-ingress-prod-load\_balancer\_hours | DEE3-C42E-3E4D | https://docs.cloud.google.com/billing/docs/reference/pricing-api/rest/v2beta/skus.price/get | hour | 공급 API 미제공 (최신 단가 조회) |
| demo-gcp | gcp-ingress-prod-processed\_data | 147E-ED36-67D1 | https://docs.cloud.google.com/billing/docs/reference/pricing-api/rest/v2beta/skus.price/get | gib | 공급 API 미제공 (최신 단가 조회) |
| demo-gcp | gcp-ingress-prod-outbound-data | 3C98-FAA0-7935 | https://docs.cloud.google.com/billing/docs/reference/pricing-api/rest/v2beta/skus.price/get | gib | 공급 API 미제공 (최신 단가 조회) |
| demo-gcp | gcp-db-instance\_hours | 28C7-7317-B255 | https://docs.cloud.google.com/billing/docs/reference/pricing-api/rest/v2beta/skus.price/get | hour | 공급 API 미제공 (최신 단가 조회) |
| demo-gcp | gcp-db-storage | B160-DAEA-03EE | https://docs.cloud.google.com/billing/docs/reference/pricing-api/rest/v2beta/skus.price/get | gib\_month | 공급 API 미제공 (최신 단가 조회) |
| demo-gcp | gcp-registry-storage | 8502-299A-ABAF | https://docs.cloud.google.com/billing/docs/reference/pricing-api/rest/v2beta/skus.price/get | gib\_month | 공급 API 미제공 (최신 단가 조회) |
| demo-gcp | gcp-observability-ingestion | 143F-A1B0-E0BE | https://docs.cloud.google.com/billing/docs/reference/pricing-api/rest/v2beta/skus.price/get | gib | 공급 API 미제공 (최신 단가 조회) |
| demo-gcp | gcp-observability-storage | F4AE-5A52-ACE3 | https://docs.cloud.google.com/billing/docs/reference/pricing-api/rest/v2beta/skus.price/get | gib\_month | 공급 API 미제공 (최신 단가 조회) |
| demo-gcp | gcp-egress-transfer | 70A1-9E75-5BB1 | https://docs.cloud.google.com/billing/docs/reference/pricing-api/rest/v2beta/skus.price/get | gib | 공급 API 미제공 (최신 단가 조회) |
| demo-gcp | gcp-addresses-address\_hours | 8515-9425-D2CE | https://docs.cloud.google.com/billing/docs/reference/pricing-api/rest/v2beta/skus.price/get | hour | 공급 API 미제공 (최신 단가 조회) |
| demo-gcp | gcp-metrics-metrics | A4E4-DF03-CDB6 | https://docs.cloud.google.com/billing/docs/reference/pricing-api/rest/v2beta/skus.price/get | sample | 공급 API 미제공 (최신 단가 조회) |
| demo-gcp | gcp-secrets-storage | 7756-ADEF-84F4 | https://docs.cloud.google.com/billing/docs/reference/pricing-api/rest/v2beta/skus.price/get | secret\_month | 공급 API 미제공 (최신 단가 조회) |
| demo-gcp | gcp-secrets-access | EBA7-264F-2D2C | https://docs.cloud.google.com/billing/docs/reference/pricing-api/rest/v2beta/skus.price/get | request | 공급 API 미제공 (최신 단가 조회) |
| demo-gcp | gcp-audit-storage | F4AE-5A52-ACE3 | https://docs.cloud.google.com/billing/docs/reference/pricing-api/rest/v2beta/skus.price/get | gib\_month | 공급 API 미제공 (최신 단가 조회) |

## 근거 파일의 해시

- 입력: `00227ddb65f787eb0a968329d876f36d7f646627fd96fc5f3030a4cbf29f86fd`
- 단가: `63c47700855dafc04c8b039701ba69c2382791a19c53a4a6a14520812d3c8b1c`
- 계산: `6fa44854ff15ca7bbb9c1650262d7100171ff6705feabbfc8ebe3b8f03c74c48`
- 자원 평가: `db626d4a1dd55a557c84b0a7a40260e7831ffa15c0992d77eff4617a547de8ea`

## 온프레미스 별도 운영 비용

클라우드 비용에 합산하지 않은 별도 값입니다. 전체 운영 예산은 별도로 확인해야 합니다.

- 전기: 미산정; 월 전기요금 입력 없음. 맥북 상시 가동 전력·요금 단가 미측정.
- 장비: 미산정; 기존 맥북 사용. 감가상각·교체 비용 입력 없음.
- 인건비: 미산정; 맥북 상시 가동·재부팅 복구·로컬 state 보관 등 운영 인건비 입력 없음.

## 가정

- demo-aws: 구성 스냅샷 기준: demo-app 커밋 b8bc6d8(origin/main, 2026-10-10 yolo 재검증)의 infra/envs/aws/\*.tf와 참조 모듈 v1.16.0 + T31 preview\_auth/aws v2.2.1. 38090d8 이후 infra/envs/aws 변경은 T31(module.preview\_auth 추가, readable\_secret\_arns에 preview 시크릿 추가)뿐이며 노드·NAT·RDS·ECR·ALB 값은 그대로다(git diff 38090d8..b8bc6d8). 라이브 state·실제 청구서는 조회하지 않음(AWS 자격증명 부재).
- demo-aws: 전체 비용 = 이 루트가 만드는 모든 자원(VPC·NAT·EKS·노드·ALB·RDS·ECR·관측). 증분 = 팀 공용 EKS(one-tatchi)에 이 서비스만 추가할 때의 추가분으로, 서비스 이름이 붙은 자원(ALB 3개·RDS·ECR·ALB 공인 IP)만 전체로 계산하고 클러스터·노드·NAT·관측 디스크는 수용량 가정 안에서 0으로 둠.
- demo-aws: 변동 사용량(NAT 처리량·LCU·로그·송신·ECR·시크릿·감사 S3·커스텀 메트릭)은 측정값이 없어 미정으로 남김. 예상 사용자 수로 바이트·로그량을 만들어 넣지 않음.
- demo-aws: 공인 IPv4 7개 × 730시간은 구성(ALB 3 × AZ 2 + NAT 1)에서 유도한 가정. 노드 루트 디스크 20GB·관측 PVC 5GB는 2026-10-09 플랫폼 검증의 동일 모듈 관측값을 인용.
- demo-aws: 수용량 검사 값(노드당 1900m/3072Mi/17 파드, 예약 1000m/2048Mi/25 파드)은 ADR-0014 데모 가정을 그대로 사용한 것이며 실측 allocatable이 아님. 트래픽 분석의 파드 슬롯 추정(시스템 20~25개)과 같은 범위.
- demo-aws: ALB 3개는 deploy.yml ingress-group(demo-app-test, demo-app-prod)과 observability ingress\_group(demo-app)에서 유도. App Chart v2.2.1의 active Ingress와 T31 preview Ingress(charts/app/templates/preview-auth.yaml)는 같은 app.ingressAnnotations 헬퍼 (alb.ingress.kubernetes.io/group.name = ingress.group)를 쓰므로 환경 ALB를 공유한다(GitHub API로 v2.2.1 템플릿 확인). preview-host 추가로 ALB가 늘지 않음.
- demo-aws: Route53 존·CI 역할·state 버킷(bootstrap 관리), RDS 백업 스토리지, KMS, 세금(VAT)은 이 목록 밖. 온디맨드 공개 단가이며 크레딧·할인 미반영.
- demo-aws: T31 green 미리보기(커밋 c668ed2·b8bc6d8): infra/envs/aws/main.tf module.preview\_auth = one-tatchi-platform modules/preview\_auth/aws?ref=v2.2.1. 모듈 본문(GitHub API로 확인)이 만드는 자원: aws\_cognito\_user\_pool 1, aws\_cognito\_user\_pool\_domain(호스팅 접두 도메인, 사용자 지정 도메인 아님) 1, aws\_cognito\_identity\_provider(SAML, Identity Center) 1, aws\_cognito\_user\_pool\_client 1, random\_password 1, aws\_secretsmanager\_secret 1(demo-app-preview-oauth2-proxy) + secret\_version 1 + secret\_policy 1. 이 중 과금 대상은 Cognito User Pool(MAU 과금)과 Secrets Manager 시크릿 1개다.
- demo-aws: Cognito User Pool은 비용 항목으로 넣지 못함(미산정): 가격 도구 계약(price-format.md)에 MAU 단위가 없고 AWS 조회 프로필(pricing\_aws.PROFILES)에 Cognito가 없어 lookup·calculate가 처리할 수 없다. 무료 구간 적용 여부·월 MAU(승인자 1~2명이 승격 전 green을 여는 경로, 트래픽 분석)는 도구가 조회하지 않았으므로 금액을 적지 않는다. 계약에 MAU 단위와 Cognito 프로필을 추가한 뒤 재조회해야 한다.
- demo-aws: Secrets Manager 시크릿 월 사용량 하한 1 = T31 preview 시크릿(이 루트가 생성, 서비스 이름 접두 → 증분에도 포함). 상한 미정: RDS 관리 마스터 암호의 과금 취급 미확인. 기존 one-tatchi/slack-bot 시크릿은 이 루트가 생성하지 않아 전체 범위 밖. 접근 요청 수(External Secrets 동기화·PR plan refresh GetSecretValue)는 미측정.
- demo-aws: T31 oauth2-proxy는 App Chart v2.2.1 preview-auth.yaml의 환경당 Deployment 1개(replicas 1, 차트 기본 requests 10m/32Mi, limits 64Mi)이며 Blue-Green 배수 없이 상시 1개다. 수용량 검사 workloads에 포함했고 노드 수는 바꾸지 않는다. deploy/values-fe.yaml previewAuth.enabled: true는 AWS에서만 유효(gcp·onprem values는 false).
- demo-aws: Assumed input metrics\_disk\_usage: observability 모듈(central\_metrics Prometheus) PVC 5GB gp3가 2026-10-09 플랫폼 검증에서 관측됨. 이번 실행은 실측 아님.
- demo-aws: Assumed input node\_disk\_usage: modules/cluster/aws v1.16.0은 disk\_size를 지정하지 않음(aws\_eks\_node\_group 기본 20GiB). 같은 모듈 v1.16.0 구성의 실제 노드 루트 디스크 20GB gp3가 2026-10-09 플랫폼 검증에서 관측됨. 이번 실행은 실측 아님.
- demo-aws: Assumed input public\_ipv4\_hours: ALB 3개 × AZ 2개(az\_count=2) + NAT EIP 1개 = 공인 IPv4 7개 × 730시간 = 5,110 주소-시간. 구성에서 유도한 가정이며 실제 주소 수·시간을 측정한 값이 아님.
- demo-aws: Assumed input public\_ipv4\_incremental\_hours: 서비스 전용 ALB 3개의 주소 6개 × 730시간. NAT 주소 1개는 팀 공용으로 간주.
- demo-aws: Resource assessment SHA-256: db626d4a1dd55a557c84b0a7a40260e7831ffa15c0992d77eff4617a547de8ea
- demo-aws: Monthly-hours scenario: 730; resource usage is explicit. Public pre-tax prices exclude credits and negotiated discounts.
- demo-aws: SKU usage is pooled once; item costs use input-order marginal attribution. Item range extrema need not sum to aggregate range extrema.
- demo-aws: KRW conversion: 1341.486704 KRW/USD as of 2026-10-09; ECB EXR daily reference rates 2026-10-09 (data-api.ecb.europa.eu EXR/D.KRW.EUR.SP00.A 1503.27 ÷ EXR/D.USD.EUR.SP00.A 1.1206), 2026-10-10 조회, 소수 6자리 반올림
- demo-gcp: 구성 스냅샷 기준: demo-app 커밋 b8bc6d8의 infra/envs/gcp/\*.tf(38090d8 이후 변경 없음)와 참조 모듈 v1.16.0. 루트가 노드·DB 규격을 지정하지 않아 모듈 기본값(e2-standard-2 3대, 30GB pd-standard, db-g1-small 20GB PD\_SSD ZONAL)을 사용.
- demo-gcp: GKE 노드 CPU·메모리 시간은 e2-standard-2 사양(2 vCPU/8GiB) × 730시간 가정. 디스크는 프로비저닝 용량을 GiB-month로 모델링.
- demo-gcp: 로드밸런서 전달 규칙 시간은 '최소 요금' SKU의 묶음 과금 모델 때문에 미정으로 둠(규칙 수 × 시간으로 곱하면 과대 계산). 변동 사용량·무료 구간 자격·프로젝트 기존 사용량은 미정.
- demo-gcp: 앱 추가 증분은 공용 여유(allocatable)를 확인하지 못해 전부 미산정. replicas는 차트 기본 2(deploy/gcp/values.yaml에 replicas 없음, 트래픽 분석 default: 2).
- demo-gcp: SKU는 2026-10-09 플랫폼 검증에서 공개 API로 확인한 서울 리전 선택자(v2beta Default 종량제). 약정·크레딧·세금 미반영.
- demo-gcp: T31 green 미리보기는 deploy/gcp/values.yaml previewAuth.enabled: false로 GCP에서 꺼져 있어 IdP 중계·시크릿·oauth2-proxy 자원이 추가되지 않음.
- demo-gcp: Assumed input cpu\_usage: e2-standard-2 = 2 vCPU × 730시간. 머신 사양 기준 가정.
- demo-gcp: Assumed input disk\_usage: 프로비저닝 30GiB를 GiB-month로 모델링. 실제 과금량·자동 증설 미검증.
- demo-gcp: Assumed input ingress\_per\_env: blueGreen이면 환경당 active + preview Ingress 2개 → gce 클래스에서 전달 규칙 2개. 실제 전달 규칙 수 미확인.
- demo-gcp: Assumed input memory\_usage: e2-standard-2 = 8 GiB × 730시간. 머신 사양 기준 가정.
- demo-gcp: Assumed input nat\_ip\_hours: nat\_ip\_allocate\_option = AUTO\_ONLY → 최소 1개 × 730시간, 자동 추가 할당 상한 미정.
- demo-gcp: Assumed input sql\_disk\_usage: 초기 20GiB를 GiB-month로 모델링. disk\_autoresize 증가분은 미반영(트래픽 분석: 연간 수십 MB).
- demo-gcp: Resource assessment SHA-256: db626d4a1dd55a557c84b0a7a40260e7831ffa15c0992d77eff4617a547de8ea
- demo-gcp: Monthly-hours scenario: 730; resource usage is explicit. Public pre-tax prices exclude credits and negotiated discounts.
- demo-gcp: SKU usage is pooled once; item costs use input-order marginal attribution. Item range extrema need not sum to aggregate range extrema.
- demo-gcp: KRW conversion: 1341.486704 KRW/USD as of 2026-10-09; ECB EXR daily reference rates 2026-10-09 (data-api.ecb.europa.eu EXR/D.KRW.EUR.SP00.A 1503.27 ÷ EXR/D.USD.EUR.SP00.A 1.1206), 2026-10-10 조회, 소수 6자리 반올림
- demo-onprem: infra/envs/onprem/\*.tf(모듈 v2.1.3, 38090d8 이후 v2.1.2→v2.1.3 참조 태그만 변경): 기존 맥북 k3d 클러스터, Cloudflare Quick Tunnel, GHCR, 환경별 클러스터 내 PostgreSQL. 클라우드 과금 항목 없음 → 클라우드 비용 0.
- demo-onprem: 클라우드 0원은 전체 운영비 0원이 아님. 전기·장비·인건비는 사용자 입력이 없어 미산정(이전 분석의 20~30W 상시 가동 → 월 3,000~5,000원 전기요금 어림은 측정값이 아니라 여기에 넣지 않음).
- demo-onprem: GHCR 비공개 저장소 초과분·Cloudflare 유료 전환 등은 현재 구성에서 발생하지 않는 것으로 보고 항목에 넣지 않음. 민감 데이터(regulated) 취급 시 개인 장비 보관 문제는 보안 분석 범위.
- demo-onprem: T31 green 미리보기는 deploy/onprem/values.yaml previewAuth.enabled: false로 온프레미스에서 꺼져 있어 추가 자원 없음.
- demo-onprem: Existing onprem hardware has no cloud charge; power, hardware and labor are separate operating costs
- demo-onprem: Resource assessment SHA-256: db626d4a1dd55a557c84b0a7a40260e7831ffa15c0992d77eff4617a547de8ea
- demo-onprem: Monthly-hours scenario: 730; resource usage is explicit. Public pre-tax prices exclude credits and negotiated discounts.
- demo-onprem: SKU usage is pooled once; item costs use input-order marginal attribution. Item range extrema need not sum to aggregate range extrema.
- demo-onprem: KRW conversion: 1341.486704 KRW/USD as of 2026-10-09; ECB EXR daily reference rates 2026-10-09 (data-api.ecb.europa.eu EXR/D.KRW.EUR.SP00.A 1503.27 ÷ EXR/D.USD.EUR.SP00.A 1.1206), 2026-10-10 조회, 소수 6자리 반올림

## 재검증 메모와 분석기 가정 (도구 출력 밖)

### 3b0caf7 → b8bc6d8에서 바뀐 것

| 변경 | 과금 영향 | 반영 |
|---|---|---|
| T31 `infra/envs/aws/main.tf` `module.preview_auth` = platform `modules/preview_auth/aws?ref=v2.2.1` (#59, #60) | 모듈 본문(GitHub API로 확인)이 만드는 자원: `aws_cognito_user_pool` 1, 호스팅 접두 도메인 1, SAML IdP(Identity Center) 1, 앱 클라이언트 1, `random_password` 1, `aws_secretsmanager_secret` 1(`demo-app-preview-oauth2-proxy`) + 버전 + 리소스 정책. **새 과금 자원은 Cognito User Pool(MAU 과금)과 Secrets Manager 시크릿 1개** | 시크릿은 `aws-secrets-storage` 사용량 하한 1로 반영. Cognito는 아래 사유로 미산정 |
| `deploy/values-fe.yaml` `previewAuth.enabled: true`, deploy.yml `preview-host` | App Chart v2.2.1 `preview-auth.yaml`: 환경당 oauth2-proxy Deployment 1개(차트 기본 10m/32Mi, limits 64Mi) + preview Ingress. preview Ingress는 active Ingress와 같은 `app.ingressAnnotations` 헬퍼(`alb.ingress.kubernetes.io/group.name = ingress.group`)를 쓰므로 환경 ALB를 공유 → **ALB 3개 유지**, 새 ALB 없음 | 수용량 workloads에 oauth2-proxy 추가(수요 600m/640Mi/8슬롯 → 620m/704Mi/10슬롯, 공급 4700m/7168Mi/26슬롯 안). 노드 수 변경 없음 |
| `deploy/gcp/values.yaml`, `deploy/onprem/values.yaml` `previewAuth.enabled: false` | GCP · 온프레미스에는 T31 자원이 생기지 않음 | 가정에만 기록 |
| `infra/envs/onprem/main.tf` 모듈 v2.1.2 → v2.1.3 | 참조 태그만 변경, 클라우드 과금 항목 없음 | 가정 문구 갱신 |
| `LOG_LEVEL: warn`, i18n, p95, Dockerfile, 템플릿 v2.2.1 | 로그 수집량은 줄지만 측정값이 없어 `aws-observability-ingestion`은 그대로 미정(0으로 바꾸지 않음) | 변경 없음 |

### 숫자가 달라진 이유

- 전체 확인 소계 USD 331.573 → **331.973 이상(상한 미정)**, 증분 92.045 → **92.445 이상(상한 미정)**. 차이 USD 0.40은 `aws-secrets-storage`의 사용량 하한을 null → 1 secret_month로 바꾼 결과이며 단가(SKU 8TY6BPQ52JVYCRQD, secret_month당 USD 0.40, 2026-10-09T14:06:30Z 조회, 가격 적용 2025-07-01)는 도구가 조회한 값 그대로다. 상한이 미정이 된 것은 RDS 관리 마스터 암호의 과금 취급을 확인하지 못해 월 시크릿 수 상한을 두지 않았기 때문이다.
- 예산 판정은 그대로 **over**(알려진 하한만으로 10만 원 상한 초과). GCP · 온프레미스 판정도 변경 없음.
- 절감액은 그대로 미산정(별도 대안 견적 없음). 검토 방향은 이전과 같다: 시연 시간 외 노드 축소, ALB 묶기, RDS test/prod 공유 유지. replicas 축소로 노드 절감액을 만들지 않는다.

### 단가 조회 경로

- 2026-10-10T08:32:36Z 실조회(`lookup` → `prices-live.json`)는 AWS 21건 · GCP 23건 모두 `authentication_failed`(이전 실행에서는 GCP 23건 성공). 공개 가격으로 대체하지 않았다.
- 가격 선택 조건(resource_id · 종류 · 과금 차원 · 단위 · attributes)이 2026-10-09 플랫폼 검증 입력(`demo-live-validation-20261009`)과 모두 같아 `reuse-prices`로 그 조회 결과를 재사용했다(`price-reuse.json`: 원본 입력 86a903f9…, 원본 단가 ece27a06…, 조회 시각 2026-10-09T14:06:30Z 보존, API 요청 없음). 바뀐 것은 사용량 · 가정뿐이라 재사용 조건을 충족한다.
- Cognito를 비용 항목으로 추가했다면 새 항목이라 `reuse-prices`가 거부하고 새 조회가 필요한데, 그 조회는 인증 실패로 모든 AWS 단가를 잃는다. 또한 현재 계약에는 MAU 단위 자체가 없어 항목으로 표현할 수 없다(아래 가정).

### 가정 (추정이 들어간 항목만)

- **Cognito User Pool 비용 미산정**: 가격 계약(`price-format.md`)의 단위 목록에 MAU가 없고 AWS 조회 프로필(`pricing_aws.PROFILES`)에 Cognito가 없어 lookup · calculate가 처리할 수 없다. 무료 구간 적용 여부 · 월 MAU는 도구가 조회하지 않았으므로 **금액을 적지 않는다**. 트래픽 분석의 추정(승인자 1~2명이 승격 전 green을 여는 경로)은 사용자 수 가정일 뿐 과금 산정이 아니다. 계약에 MAU 단위와 Cognito 프로필을 추가한 뒤 AWS 자격증명으로 재조회해야 전체 견적에 들어간다.
- **Secrets Manager 시크릿 수 1 이상**: T31 preview 시크릿 1개는 모듈 본문에서 확인한 사실이다. RDS 관리 마스터 암호(모듈 `database/aws`)의 과금 취급은 미확인이라 상한을 두지 않았고, 기존 `one-tatchi/slack-bot` 시크릿은 이 루트가 생성하지 않아 전체 범위 밖으로 둔 것은 이전 분석의 범위 정의를 따른다. 접근 요청 수(External Secrets 동기화 3개 + PR plan refresh `GetSecretValue`)는 미측정이라 `aws-secrets-access`는 그대로 미정.
- **Cognito 호스팅 접두 도메인 · SAML IdP · 앱 클라이언트 · `random_password`**: User Pool 밖의 별도 과금 자원이 아니라고 보고 항목을 만들지 않았다(사용자 지정 도메인 · ACM · CloudFront 없음). 이 판단은 모듈 본문 기준이며 가격을 주장하는 것이 아니다.
- **oauth2-proxy 자원 10m/32Mi, 환경당 1개, Blue-Green 배수 1**: App Chart v2.2.1 `values.yaml` 기본값과 `preview-auth.yaml`(Deployment `replicas: 1`)에서 읽었다. `deploy/values-fe.yaml`은 `resources`를 덮어쓰지 않는다. 노드 수용량 검사 입력일 뿐 노드 수 · 비용에는 영향이 없다.
- **ALB 3개 유지**: v2.2.1 템플릿의 group.name 공유를 확인했지만 실제 ALB 수는 ELB API로 조회하지 못했다(AWS 자격증명 부재). preview 호스트가 같은 ALB의 리스너 규칙 · 인증서로 추가된다는 전제다.
- 그 밖의 가정(노드 디스크 20GB, 관측 PVC 5GB, 공인 IPv4 7개, 수용량 ADR-0014 값, 환율 ECB 2026-10-09)은 2차 분석과 같고 위 "가정" 절에 도구가 그대로 적었다.
