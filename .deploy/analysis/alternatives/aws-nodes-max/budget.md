# 예산 분석 — 대안 시나리오: AWS 노드 5대 상시 (조건부 노드 상한)

분석일: 2026-10-11 (yolo 재검증, 기준 커밋 951feac)

본 견적(`../../budget.md`, 상시 3대)과 단가 · 가정이 같고 노드 그룹 quantity만 `node_count.max = 5`로 바꾼 입력이다. ASG 상한을 모두 쓴다고 가정한 **상한**이며 실제 조건부 노드 시간은 미측정이다. 아래는 도구 출력 그대로다.

## 예산 범위

0원 ~ 100,000원

기본 단가는 공개 종량제 USD 기준이며 세금·크레딧·약정·계정별 할인은 제외합니다.

## 후보별 예상 월 비용

| 대상 · 후보 | 구성 | 고정비 (USD 소계) | 변동비 (USD 소계) | 전체 (USD) | 앱 추가 (USD) | 전체 원화 | 예산 판정 | 조회/시도 시각 (UTC) |
|---|---|---|---|---|---|---|---|---|
| AWS · demo-aws | 가정 포함 | USD 369.166 | USD 18.65 이상 (상한 미정) | 확인된 소계 USD 387.816 이상 (상한 미정); 추가 비용 미정 | 확인된 소계 USD 68.72 이상 (상한 미정); 추가 비용 미정 | 미산정 | 예산 초과 (전체) | 2026-10-09T14:06:30Z |
| GCP · demo-gcp | 가정 포함 | USD 306.6459268 | USD 3.65 이상 (상한 미정) | 확인된 소계 USD 310.2959268 이상 (상한 미정); 추가 비용 미정 | 미산정 | 미산정 | 예산 초과 (전체) | 2026-10-09T14:06:30Z |
| 온프레미스 · demo-onprem | 명시 | USD 0 | USD 0 | USD 0 | USD 0 | 0원 | 판정 미정 (전체) | 2026-10-09T14:06:30Z |

부분 결과의 소계는 전체 합계가 아닙니다. 상한과 미산정 항목을 함께 확인하세요.

## 환율 근거

- USD 1 = 1,341.486704원; 기준일 2026-10-09; 출처 ECB EXR daily reference rates 2026-10-09 (data-api.ecb.europa.eu EXR/D.KRW.EUR.SP00.A 1503.27 ÷ EXR/D.USD.EUR.SP00.A 1.1206), 2026-10-11(KST) 재조회에서도 최신 관측이 2026-10-09(주말 미발표), 소수 6자리 반올림

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

- 입력: `acfc1451cd57a4d4f307ab4972c03b901445d6c431f329d6717c1779d6b89bd0`
- 단가: `da5c24b39a466748eb65e1dc150d5f4fa8ed230cde900fe25b0c7158713f54ff`
- 계산: `2f6cb81553b08f61eaf34d1118064d1d19e9e705614ab8db5b7704b5db36c8ac`
- 자원 평가: `79392fab48359c5040481af079d8e3dbbe1aca33b5afdea10cebf1c7e5cebee9`

## 온프레미스 별도 운영 비용

클라우드 비용에 합산하지 않은 별도 값입니다. 전체 운영 예산은 별도로 확인해야 합니다.

- 전기: 미산정; 월 전기요금 입력 없음. 맥북 상시 가동 전력·요금 단가 미측정.
- 장비: 미산정; 기존 맥북 사용. 감가상각·교체 비용 입력 없음.
- 인건비: 미산정; 맥북 상시 가동·재부팅 복구·로컬 state 보관·T33 AWS test DB 호스팅 등 운영 인건비 입력 없음.

## 가정

- demo-aws: 구성 스냅샷 기준: demo-app 커밋 951feac(origin/main, 브랜치 yolo/pipeline-v2-12, 2026-10-11 yolo 재검증)의 infra/envs/aws/\*.tf + gcp-monitoring.auto.tfvars. 참조 모듈은 .deploy/config.yaml infra\_versions.aws = v2.11.0(network·cluster·registry·database·cluster\_addons·observability)과 preview\_auth/aws·db\_link/tailscale v2.12.0. 과금 자원 변화는 git diff 6b48d77..951feac -- infra deploy와 모듈 본문(GitHub API, v1.16.0↔v2.11.0 diff)으로 확인했다. 라이브 state·실제 청구서·ELB/ASG API는 조회하지 않음(AWS SSO 토큰 만료, 자격증명 부재). 이 목록의 template\_version 필드(v1.16.2)는 GCP 후보의 module\_default 참조 태그이며 AWS 모듈 태그가 아니다.
- demo-aws: 전체 비용 = 이 루트가 만드는 모든 자원(VPC·NAT·EKS·노드·ALB·RDS·ECR·관측·T31 시크릿). 증분 = 팀 공용 EKS(one-tatchi)에 이 서비스만 추가할 때의 추가분: 서비스 이름이 붙은 자원(ALB 2개·RDS·ECR·ALB 공인 IP·preview 시크릿)은 전체로, 클러스터·NAT·관측 디스크·상시 노드 3대는 수용량 가정 안에서 0으로 둔다. T29 Cluster Autoscaler가 이 앱의 HPA·Blue-Green 파드 때문에 띄우는 조건부 노드(4~5대째)는 본 견적 항목에 없고 별도 '노드 5대 상시' 시나리오로 상한만 계산한다(증분 귀속 미확정).
- demo-aws: T29(#79, 모듈 v2.11.0): node\_count = {min 3, desired 3, max 5}(이전 max 3). cluster\_addons/aws v2.11.0이 Metrics Server(3.13.0)·Cluster Autoscaler(9.59.0, Pod Identity·IAM 역할·ASG 태그) Helm 릴리스를 추가한다. 이들은 AWS 과금 자원이 아니다(파드·IAM·태그만). 과금이 바뀌는 것은 EC2 노드 시간과 노드 루트 EBS뿐이다. 이 입력은 '노드 5대 상시' 상한 시나리오다: ASG max\_size 5 × 730h를 모두 쓴다고 가정해 조건부 노드(4~5대째) 비용의 상한을 같은 조회 단가로 계산한다. 실제 조건부 노드 시간은 Pending 파드 발생·Cluster Autoscaler 축소 지연에 좌우되며(트래픽 분석: 평상시·통상 배포·부하 시연은 3대, 4대째는 조건부·일시적) 측정하지 않았으므로 하한은 본 견적(3대)이고 이 시나리오가 상한이다.
- demo-aws: ALB 2개(이전 3개): observability/aws의 ingress\_group이 var.service(demo-app)에서 "${var.service}-prod"로 바뀌어(#62 T17) Grafana Ingress(group.order 10)와 central\_metrics 수신기 Ingress(metrics.tf ingressGroup = var.ingress\_group)가 prod 앱 ALB(demo-app-prod)를 공유한다. deploy.yml의 ingress-group은 demo-app-test / demo-app-prod 그대로. App Chart의 active·preview Ingress도 같은 group을 쓴다(2차 분석에서 확인). 따라서 공인 IPv4는 ALB 2 × AZ 2 + NAT 1 = 5개 × 730h = 3,650 주소-시간(증분 4개 × 730h = 2,920). 실제 ALB·주소 수는 ELB API로 확인하지 못했다.
- demo-aws: T33(#69 #81, db\_link/tailscale v2.12.0): AWS test 환경의 BE는 RDS 대신 온프레미스(맥북 k3d) Postgres를 Tailscale 통로로 쓴다. 루트가 만드는 것은 Helm 릴리스(tailscale-operator 1.102.4, tailscale-base service-base), ExternalName Service, NetworkPolicy, Secrets Manager 데이터 소스 2개(one-tatchi/tailscale-oauth, demo-app-db-onprem-test — 사람이 콘솔·CLI로 생성, 이 루트가 생성하지 않아 '이 루트가 만드는 자원' 범위 밖; 포함하면 secret\_month 하한이 +2가 된다)뿐이다. AWS 과금 자원은 추가되지 않지만, test BE의 모든 DB 쿼리가 NAT 게이트웨이와 인터넷 송신을 거쳐(WireGuard P2P 또는 DERP 중계) 맥북으로 가므로 aws-nat-processed\_data·aws-egress-transfer의 미측정 변동 사용량에 새 성분이 생겼다(트래픽 분석 test 피크 ≈ 200 q/s). RDS db.t4g.micro는 그대로 1대(prod 전용) → RDS 비용 변화 없음. Tailscale 플랜 비용은 외부 SaaS라 가격 계약·조회 프로필에 없어 미산정: 모듈 README는 '무료 tailnet은 사용자 3명·기기 100대, operator·프록시는 사용자 수를 쓰지 않는다'고 적었으나 실제 tailnet(tailb7ed7e.ts.net)의 플랜·기기 수는 확인하지 않았다.
- demo-aws: T17 GCP 모니터링 데이터 소스(#73, gcp-monitoring.auto.tfvars): Grafana가 EKS 단기 토큰을 GCP WIF로 교환해 Cloud Monitoring을 읽는다. AWS 쪽 추가 자원은 ConfigMap·projected volume뿐이고 과금 없음(STS 토큰 교환 무료). GCP 쪽은 공식 가격표(cloud.google.com/stackdriver/pricing, 2025-10-02 개정)에 'Monitoring read API calls: 반환된 시계열 수 기준 과금, 청구 계정당 월 첫 100만 시계열 무료'가 있어 과금 항목이 존재한다. 그러나 (1) 이 비용은 AWS 후보의 자원이 GCP 프로젝트(one-tatchi-gejkm)에 발생시키는 교차 공급자 비용이라 AWS 후보의 조회 프로필로 표현할 수 없고, (2) Grafana 대시보드·health 조회가 월에 반환하는 시계열 수를 측정하지 않았으며, (3) 무료 한도 적용 여부(같은 청구 계정의 기존 사용량)를 확인하지 않았으므로 미산정으로 남긴다. 공개 단가를 넣어 금액을 만들지 않는다.
- demo-aws: VPC CNI NetworkPolicy(enableNetworkPolicy, cluster/aws v2.11.0 T30·T33)·eks-pod-identity-agent·kube-proxy·coredns 애드온은 과금 항목이 없다. network/registry/database 모듈은 v1.16.0 ↔ v2.11.0 본문 diff가 없다(NAT 1·ECR 2·RDS 구성 동일).
- demo-aws: T31 preview\_auth/aws v2.12.0(이전 v2.2.1): 자원 집합 동일(aws\_cognito\_user\_pool 1, 호스팅 접두 도메인 1, SAML IdP 1, 앱 클라이언트 1, random\_password 1, aws\_secretsmanager\_secret 1 + version + policy). #82로 Cognito 콜백 호스트에 onprem 미리보기 호스트 2개가 추가됐을 뿐 과금 자원은 그대로다. Cognito User Pool(MAU 과금)은 가격 계약에 MAU 단위·Cognito 프로필이 없어 여전히 미산정이며 금액을 적지 않는다.
- demo-aws: 변동 사용량(NAT 처리량·LCU·로그·송신·ECR·시크릿 접근·감사 S3·커스텀 메트릭)은 측정값이 없어 미정으로 남김. CloudWatch 로그는 관측 모듈의 AI 근거 로그 그룹(/one-tatchi/deploy-evidence, 보존 14일)과 애드온 수집을 포함하며 LOG\_LEVEL=warn 유지. 예상 사용자 수로 바이트·로그량을 만들어 넣지 않음.
- demo-aws: Secrets Manager 시크릿 월 사용량 하한 1 = T31 preview 시크릿(이 루트가 생성, 서비스 이름 접두 → 증분에도 포함). 상한 미정: RDS 관리 마스터 암호의 과금 취급 미확인. 접근 요청 수(External Secrets 동기화: demo-app-db ×2 환경·slack-bot·preview·tailscale operator-oauth + PR plan refresh)는 미측정.
- demo-aws: 수용량 입력(HPA 최소 기준): 트래픽 분석(2026-10-11, changed\_since\_previous: true)의 최종값 BE replicas 2 + HPA 2~6(CPU 70%, 100m/128Mi), FE 1(50m/32Mi), oauth2-proxy 환경당 1(10m/32Mi, App Chart v2.2.1 확인값·v2.12.0 미재확인), tailscale operator + egress 프록시 2개(test 통로, 차트 1.102.4 기본 resources {} → 요청량 0, 파드 슬롯만). HPA 상한(6)·Blue-Green 배수 2의 최악 조합은 트래픽 분석 표를 따른다. 노드 루트 디스크 20GB·관측 PVC 5GB는 2026-10-09 플랫폼 검증의 동일 모듈 관측값 인용. Route53 존·CI 역할·state 버킷·RDS 백업·KMS·세금(VAT)·크레딧·할인은 범위 밖.
- demo-aws: Assumed input metrics\_disk\_usage: observability 모듈(central\_metrics Prometheus) PVC 5GB gp3가 2026-10-09 플랫폼 검증에서 관측됨. 이번 실행은 실측 아님.
- demo-aws: Assumed input node\_disk\_usage: modules/cluster/aws v2.11.0도 disk\_size를 지정하지 않음(aws\_eks\_node\_group 기본 20GiB). 같은 모듈 구성의 실제 노드 루트 디스크 20GB gp3가 2026-10-09 플랫폼 검증에서 관측됨. 이번 실행은 실측 아님.
- demo-aws: Assumed input public\_ipv4\_hours: ALB 2개 × AZ 2개(az\_count=2) + NAT EIP 1개 = 공인 IPv4 5개 × 730시간 = 3,650 주소-시간. 구성에서 유도한 가정이며 실제 주소 수·시간을 측정한 값이 아님.
- demo-aws: Assumed input public\_ipv4\_incremental\_hours: 서비스 전용 ALB 2개의 주소 4개 × 730시간. NAT 주소 1개는 팀 공용으로 간주.
- demo-aws: Resource assessment SHA-256: 79392fab48359c5040481af079d8e3dbbe1aca33b5afdea10cebf1c7e5cebee9
- demo-aws: Monthly-hours scenario: 730; resource usage is explicit. Public pre-tax prices exclude credits and negotiated discounts.
- demo-aws: SKU usage is pooled once; item costs use input-order marginal attribution. Item range extrema need not sum to aggregate range extrema.
- demo-aws: KRW conversion: 1341.486704 KRW/USD as of 2026-10-09; ECB EXR daily reference rates 2026-10-09 (data-api.ecb.europa.eu EXR/D.KRW.EUR.SP00.A 1503.27 ÷ EXR/D.USD.EUR.SP00.A 1.1206), 2026-10-11(KST) 재조회에서도 최신 관측이 2026-10-09(주말 미발표), 소수 6자리 반올림
- demo-gcp: 구성 스냅샷 기준: demo-app 커밋 951feac의 infra/envs/gcp/\*.tf + grafana.auto.tfvars와 참조 모듈 v1.16.2(.deploy/config.yaml infra\_versions.gcp). 6b48d77 이후 변경은 모듈 태그 v1.16.0 → v1.16.2, kubernetes provider·plan 계정 Secret 읽기 ClusterRole/Binding(RBAC, 과금 없음), grafana\_eks\_oidc\_issuer 입력뿐이다. 플랫폼 compare v1.16.0...v1.16.2는 observability 모듈만 바뀌었고(WIF pool·provider·서비스 계정·IAM member·google\_monitoring\_dashboard — 모두 무과금 자원) network/cluster/registry/database 본문은 같다. 루트가 노드·DB 규격을 지정하지 않아 모듈 기본값(e2-standard-2 3대, 30GB pd-standard, db-g1-small 20GB PD\_SSD ZONAL)을 사용.
- demo-gcp: GKE 노드 풀 autoscaling은 min=max=node\_count 기본 3이라(modules/cluster/gcp v1.16.2 main.tf) BE HPA 2~6이 노드 수를 바꾸지 않는다. 노드 CPU·메모리 시간은 e2-standard-2 사양(2 vCPU/8GiB) × 730시간 가정. 디스크는 프로비저닝 용량을 GiB-month로 모델링.
- demo-gcp: T17 GCP WIF(grafana-eks pool, eks-grafana provider, grafana-monitoring 서비스 계정, Monitoring Viewer)는 무과금이지만, AWS의 중앙 Grafana가 이 프로젝트(one-tatchi-gejkm)의 Cloud Monitoring을 읽을 때 공식 가격표(cloud.google.com/stackdriver/pricing, 2025-10-02 개정)의 'Monitoring read API calls — 반환 시계열 수 기준, 청구 계정당 월 첫 100만 시계열 무료' 항목이 발생한다. 반환 시계열 수 미측정·무료 한도 적용 여부 미확인·도구 프로필 부재로 미산정. 이 비용은 GCP 배포 여부와 무관하게 AWS 추천 구성에서도 발생한다.
- demo-gcp: 로드밸런서 전달 규칙 시간은 '최소 요금' SKU의 묶음 과금 모델 때문에 미정으로 둠(규칙 수 × 시간으로 곱하면 과대 계산). 변동 사용량·무료 구간 자격·프로젝트 기존 사용량은 미정.
- demo-gcp: 앱 추가 증분은 공용 여유(allocatable)를 확인하지 못해 전부 미산정. replicas는 공통 값 파일 BE 2(+HPA 2~6)·FE 1(deploy/gcp/values.yaml에 덮어쓰기 없음, 트래픽 분석 2026-10-11).
- demo-gcp: SKU는 2026-10-09 플랫폼 검증에서 공개 API로 확인한 서울 리전 선택자(v2beta Default 종량제). 약정·크레딧·세금 미반영. 이번 실행의 Catalog API 재조회는 ADC 인증 실패로 하지 못해 같은 조회 결과를 재사용.
- demo-gcp: T31 green 미리보기는 deploy/gcp/values.yaml previewAuth.enabled: false로 GCP에서 꺼져 있어 IdP 중계·시크릿·oauth2-proxy 자원이 추가되지 않음. T33 db\_link도 GCP 루트에는 없음.
- demo-gcp: Assumed input cpu\_usage: e2-standard-2 = 2 vCPU × 730시간. 머신 사양 기준 가정.
- demo-gcp: Assumed input disk\_usage: 프로비저닝 30GiB를 GiB-month로 모델링. 실제 과금량·자동 증설 미검증.
- demo-gcp: Assumed input ingress\_per\_env: blueGreen이면 환경당 active + preview Ingress 2개 → gce 클래스에서 전달 규칙 2개. 실제 전달 규칙 수 미확인.
- demo-gcp: Assumed input memory\_usage: e2-standard-2 = 8 GiB × 730시간. 머신 사양 기준 가정.
- demo-gcp: Assumed input nat\_ip\_hours: nat\_ip\_allocate\_option = AUTO\_ONLY → 최소 1개 × 730시간, 자동 추가 할당 상한 미정.
- demo-gcp: Assumed input sql\_disk\_usage: 초기 20GiB를 GiB-month로 모델링. disk\_autoresize 증가분은 미반영(트래픽 분석: 연간 수십 MB).
- demo-gcp: Resource assessment SHA-256: 79392fab48359c5040481af079d8e3dbbe1aca33b5afdea10cebf1c7e5cebee9
- demo-gcp: Monthly-hours scenario: 730; resource usage is explicit. Public pre-tax prices exclude credits and negotiated discounts.
- demo-gcp: SKU usage is pooled once; item costs use input-order marginal attribution. Item range extrema need not sum to aggregate range extrema.
- demo-gcp: KRW conversion: 1341.486704 KRW/USD as of 2026-10-09; ECB EXR daily reference rates 2026-10-09 (data-api.ecb.europa.eu EXR/D.KRW.EUR.SP00.A 1503.27 ÷ EXR/D.USD.EUR.SP00.A 1.1206), 2026-10-11(KST) 재조회에서도 최신 관측이 2026-10-09(주말 미발표), 소수 6자리 반올림
- demo-onprem: infra/envs/onprem/\*.tf(모듈 v2.12.0, 6b48d77 이후 v2.1.3 → v2.12.0, kubernetes\_version 입력 명시, green 미리보기 Named Tunnel 추가): 기존 맥북 k3d 클러스터, Cloudflare Quick Tunnel(환경별) + Named Tunnel(green, preview\_tunnel\_token\_secret이 있는 기본 기기만), GHCR, 환경별 클러스터 내 PostgreSQL. 클라우드 과금 항목 없음 → 클라우드 비용 0. Cloudflare Tunnel·GHCR은 외부 SaaS라 가격 계약에 없으며 현재 구성에서 유료 전환 조건이 생기지 않는 것으로 보고 항목에 넣지 않음(플랜 미확인).
- demo-onprem: 클라우드 0원은 전체 운영비 0원이 아님. 전기·장비·인건비는 사용자 입력이 없어 미산정. T33으로 이 맥북이 AWS test 환경의 DB(demo-app-db-test.tailb7ed7e.ts.net, publish 측은 이 레포 루트 밖)까지 맡게 되어 상시 가동·복구 의존이 커졌으나 비용 수치는 측정값이 없어 넣지 않음(맥북이 꺼지면 AWS test 승격이 실패한다는 운영 의존성은 트래픽·종합 분석 범위).
- demo-onprem: T31 green 미리보기가 onprem에서도 켜짐(#82): deploy/onprem/values.yaml이 previewAuth.remoteKey만 두고 values-fe.yaml의 enabled: true를 상속 → 환경당 oauth2-proxy 파드 1개(10m/32Mi). Cognito 콜백 호스트는 AWS 루트의 User Pool에 추가되며 onprem 쪽 과금 자원은 없음.
- demo-onprem: GHCR 비공개 저장소 초과분·Cloudflare 유료 전환 등은 현재 구성에서 발생하지 않는 것으로 보고 항목에 넣지 않음. 민감 데이터(regulated) 취급 시 개인 장비 보관 문제는 보안 분석 범위.
- demo-onprem: Existing onprem hardware has no cloud charge; power, hardware and labor are separate operating costs
- demo-onprem: Resource assessment SHA-256: 79392fab48359c5040481af079d8e3dbbe1aca33b5afdea10cebf1c7e5cebee9
- demo-onprem: Monthly-hours scenario: 730; resource usage is explicit. Public pre-tax prices exclude credits and negotiated discounts.
- demo-onprem: SKU usage is pooled once; item costs use input-order marginal attribution. Item range extrema need not sum to aggregate range extrema.
- demo-onprem: KRW conversion: 1341.486704 KRW/USD as of 2026-10-09; ECB EXR daily reference rates 2026-10-09 (data-api.ecb.europa.eu EXR/D.KRW.EUR.SP00.A 1503.27 ÷ EXR/D.USD.EUR.SP00.A 1.1206), 2026-10-11(KST) 재조회에서도 최신 관측이 2026-10-09(주말 미발표), 소수 6자리 반올림
