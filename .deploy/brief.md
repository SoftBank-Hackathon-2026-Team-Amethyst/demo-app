# 배포 브리프

사용자 답변으로 생성했습니다. 미정 값은 후속 분석에서 가정으로 구분합니다.

- 하루 예상 이용자: 100명 이하
- 월 인프라 예산 (KRW): 10만 원 이하
- 민감 데이터 취급: 예
- 선호 배포 대상: AWS
- 가용성 요구: 시연용

## 규제 분류

- compliance: `regulated`
- 근거: 사용자가 민감한 데이터를 저장하거나 처리한다고 답했습니다.
- 데이터 취급 여부 추가 확인: 불필요

## 기본값과 미정 항목

- 없음
- 규모·예산 미정은 제한 없음이나 0을 뜻하지 않습니다.
- 사용자 수와 예산은 선택한 범위를 유지합니다. 범위 상한을 정확한 답변으로 바꾸지 않습니다.
- 범위의 min/max는 포함 경계이며, max: null은 상한 미정입니다. 예산 무제한을 뜻하지 않습니다.
- `auto`는 대상 추천 요청, `unknown`은 가용성 미정입니다.

## 정규화된 답변

```json
{
  "expected_daily_users": {
    "min": 0,
    "max": 100
  },
  "monthly_budget": {
    "min": 0,
    "max": 100000,
    "currency": "KRW"
  },
  "handles_sensitive_data": "yes",
  "preferred_target": "aws",
  "availability": "demo"
}
```
