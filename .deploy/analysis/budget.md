# 예산 분석

## 예산 범위

0원 ~ 100,000원

기본 단가는 공개 종량제 USD 기준이며 세금·크레딧·약정·계정별 할인은 제외합니다.

## 후보별 예상 월 비용

| 대상 · 후보 | 구성 | 고정비 (USD 소계) | 변동비 (USD 소계) | 전체 (USD) | 앱 추가 (USD) | 전체 원화 | 예산 판정 | 조회/시도 시각 (UTC) |
|---|---|---|---|---|---|---|---|---|
| AWS · demo-aws | 가정 포함 | USD 306.023 | USD 25.55 | 확인된 소계 USD 331.573; 추가 비용 미정 | 확인된 소계 USD 92.045; 추가 비용 미정 | 미산정 | 예산 초과 (전체) | 2026-10-09T14:06:30Z |
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

- 입력: `567f8c7f2dd44206e5bc8149f7bf8e713a3d5a1f351f3cf2c90ea105c317f7f7`
- 단가: `ec48d6f741724235c7a32ed5cd7e30f3ccbdf2318731d17b8b292d95215f856c`
- 계산: `bfda09c9bb532fae02c0f49522d7cfd7d9a8cd3dd002e3cc578e9d0682164978`
- 자원 평가: `964048d05ad0ff994e911a414f49f0020b0525927d24f616f305341e45ad4847`

## 온프레미스 별도 운영 비용

클라우드 비용에 합산하지 않은 별도 값입니다. 전체 운영 예산은 별도로 확인해야 합니다.

- 전기: 미산정; 월 전기요금 입력 없음. 맥북 상시 가동 전력·요금 단가 미측정.
- 장비: 미산정; 기존 맥북 사용. 감가상각·교체 비용 입력 없음.
- 인건비: 미산정; 맥북 상시 가동·재부팅 복구·로컬 state 보관 등 운영 인건비 입력 없음.

## 가정

- demo-aws: 구성 스냅샷 기준: demo-app 커밋 38090d8의 infra/envs/aws/\*.tf와 참조 모듈 v1.16.0. 라이브 state·실제 청구서는 조회하지 않음(AWS 자격증명 부재).
- demo-aws: 전체 비용 = 이 루트가 만드는 모든 자원(VPC·NAT·EKS·노드·ALB·RDS·ECR·관측). 증분 = 팀 공용 EKS(one-tatchi)에 이 서비스만 추가할 때의 추가분으로, 서비스 이름이 붙은 자원(ALB 3개·RDS·ECR·ALB 공인 IP)만 전체로 계산하고 클러스터·노드·NAT·관측 디스크는 수용량 가정 안에서 0으로 둠.
- demo-aws: 변동 사용량(NAT 처리량·LCU·로그·송신·ECR·시크릿·감사 S3·커스텀 메트릭)은 측정값이 없어 미정으로 남김. 예상 사용자 수로 바이트·로그량을 만들어 넣지 않음.
- demo-aws: 공인 IPv4 7개 × 730시간은 구성(ALB 3 × AZ 2 + NAT 1)에서 유도한 가정. 노드 루트 디스크 20GB·관측 PVC 5GB는 2026-10-09 플랫폼 검증의 동일 모듈 관측값을 인용.
- demo-aws: 수용량 검사 값(노드당 1900m/3072Mi/17 파드, 예약 1000m/2048Mi/25 파드)은 ADR-0014 데모 가정을 그대로 사용한 것이며 실측 allocatable이 아님. 트래픽 분석의 파드 슬롯 추정(시스템 20~25개)과 같은 범위.
- demo-aws: ALB 3개는 deploy.yml ingress-group(demo-app-test, demo-app-prod)과 observability ingress\_group(demo-app)에서 유도. 차트의 preview Ingress는 같은 group을 공유.
- demo-aws: Route53 존·CI 역할·state 버킷(bootstrap 관리), RDS 백업 스토리지, KMS, 세금(VAT)은 이 목록 밖. 온디맨드 공개 단가이며 크레딧·할인 미반영.
- demo-aws: Assumed input metrics\_disk\_usage: observability 모듈(central\_metrics Prometheus) PVC 5GB gp3가 2026-10-09 플랫폼 검증에서 관측됨. 이번 실행은 실측 아님.
- demo-aws: Assumed input node\_disk\_usage: modules/cluster/aws v1.16.0은 disk\_size를 지정하지 않음(aws\_eks\_node\_group 기본 20GiB). 같은 모듈 v1.16.0 구성의 실제 노드 루트 디스크 20GB gp3가 2026-10-09 플랫폼 검증에서 관측됨. 이번 실행은 실측 아님.
- demo-aws: Assumed input public\_ipv4\_hours: ALB 3개 × AZ 2개(az\_count=2) + NAT EIP 1개 = 공인 IPv4 7개 × 730시간 = 5,110 주소-시간. 구성에서 유도한 가정이며 실제 주소 수·시간을 측정한 값이 아님.
- demo-aws: Assumed input public\_ipv4\_incremental\_hours: 서비스 전용 ALB 3개의 주소 6개 × 730시간. NAT 주소 1개는 팀 공용으로 간주.
- demo-aws: Resource assessment SHA-256: 964048d05ad0ff994e911a414f49f0020b0525927d24f616f305341e45ad4847
- demo-aws: Monthly-hours scenario: 730; resource usage is explicit. Public pre-tax prices exclude credits and negotiated discounts.
- demo-aws: SKU usage is pooled once; item costs use input-order marginal attribution. Item range extrema need not sum to aggregate range extrema.
- demo-aws: KRW conversion: 1341.486704 KRW/USD as of 2026-10-09; ECB EXR daily reference rates 2026-10-09 (data-api.ecb.europa.eu EXR/D.KRW.EUR.SP00.A 1503.27 ÷ EXR/D.USD.EUR.SP00.A 1.1206), 2026-10-10 조회, 소수 6자리 반올림
- demo-gcp: 구성 스냅샷 기준: demo-app 커밋 38090d8의 infra/envs/gcp/\*.tf와 참조 모듈 v1.16.0. 루트가 노드·DB 규격을 지정하지 않아 모듈 기본값(e2-standard-2 3대, 30GB pd-standard, db-g1-small 20GB PD\_SSD ZONAL)을 사용.
- demo-gcp: GKE 노드 CPU·메모리 시간은 e2-standard-2 사양(2 vCPU/8GiB) × 730시간 가정. 디스크는 프로비저닝 용량을 GiB-month로 모델링.
- demo-gcp: 로드밸런서 전달 규칙 시간은 '최소 요금' SKU의 묶음 과금 모델 때문에 미정으로 둠(규칙 수 × 시간으로 곱하면 과대 계산). 변동 사용량·무료 구간 자격·프로젝트 기존 사용량은 미정.
- demo-gcp: 앱 추가 증분은 공용 여유(allocatable)를 확인하지 못해 전부 미산정. replicas는 차트 기본 2(deploy/gcp/values.yaml에 replicas 없음, 트래픽 분석 default: 2).
- demo-gcp: SKU는 2026-10-09 플랫폼 검증에서 공개 API로 확인한 서울 리전 선택자(v2beta Default 종량제). 약정·크레딧·세금 미반영.
- demo-gcp: Assumed input cpu\_usage: e2-standard-2 = 2 vCPU × 730시간. 머신 사양 기준 가정.
- demo-gcp: Assumed input disk\_usage: 프로비저닝 30GiB를 GiB-month로 모델링. 실제 과금량·자동 증설 미검증.
- demo-gcp: Assumed input ingress\_per\_env: blueGreen이면 환경당 active + preview Ingress 2개 → gce 클래스에서 전달 규칙 2개. 실제 전달 규칙 수 미확인.
- demo-gcp: Assumed input memory\_usage: e2-standard-2 = 8 GiB × 730시간. 머신 사양 기준 가정.
- demo-gcp: Assumed input nat\_ip\_hours: nat\_ip\_allocate\_option = AUTO\_ONLY → 최소 1개 × 730시간, 자동 추가 할당 상한 미정.
- demo-gcp: Assumed input sql\_disk\_usage: 초기 20GiB를 GiB-month로 모델링. disk\_autoresize 증가분은 미반영(트래픽 분석: 연간 수십 MB).
- demo-gcp: Resource assessment SHA-256: 964048d05ad0ff994e911a414f49f0020b0525927d24f616f305341e45ad4847
- demo-gcp: Monthly-hours scenario: 730; resource usage is explicit. Public pre-tax prices exclude credits and negotiated discounts.
- demo-gcp: SKU usage is pooled once; item costs use input-order marginal attribution. Item range extrema need not sum to aggregate range extrema.
- demo-gcp: KRW conversion: 1341.486704 KRW/USD as of 2026-10-09; ECB EXR daily reference rates 2026-10-09 (data-api.ecb.europa.eu EXR/D.KRW.EUR.SP00.A 1503.27 ÷ EXR/D.USD.EUR.SP00.A 1.1206), 2026-10-10 조회, 소수 6자리 반올림
- demo-onprem: infra/envs/onprem/\*.tf(모듈 v2.1.2): 기존 맥북 k3d 클러스터, Cloudflare Quick Tunnel, GHCR, 환경별 클러스터 내 PostgreSQL. 클라우드 과금 항목 없음 → 클라우드 비용 0.
- demo-onprem: 클라우드 0원은 전체 운영비 0원이 아님. 전기·장비·인건비는 사용자 입력이 없어 미산정(이전 분석의 20~30W 상시 가동 → 월 3,000~5,000원 전기요금 어림은 측정값이 아니라 여기에 넣지 않음).
- demo-onprem: GHCR 비공개 저장소 초과분·Cloudflare 유료 전환 등은 현재 구성에서 발생하지 않는 것으로 보고 항목에 넣지 않음. 민감 데이터(regulated) 취급 시 개인 장비 보관 문제는 보안 분석 범위.
- demo-onprem: Existing onprem hardware has no cloud charge; power, hardware and labor are separate operating costs
- demo-onprem: Resource assessment SHA-256: 964048d05ad0ff994e911a414f49f0020b0525927d24f616f305341e45ad4847
- demo-onprem: Monthly-hours scenario: 730; resource usage is explicit. Public pre-tax prices exclude credits and negotiated discounts.
- demo-onprem: SKU usage is pooled once; item costs use input-order marginal attribution. Item range extrema need not sum to aggregate range extrema.
- demo-onprem: KRW conversion: 1341.486704 KRW/USD as of 2026-10-09; ECB EXR daily reference rates 2026-10-09 (data-api.ecb.europa.eu EXR/D.KRW.EUR.SP00.A 1503.27 ÷ EXR/D.USD.EUR.SP00.A 1.1206), 2026-10-10 조회, 소수 6자리 반올림
