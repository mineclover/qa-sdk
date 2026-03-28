---
def:
  id: bigint-addressing-rollout
  address: def_document:v1:2673
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [tier-infra]
  links:
    - target: bigint-addressing-runtime
      type: depends_on
    - target: bigint-addressing
      type: refines
---

# BigInt 주소 체계 - 전환과 성능

## 목적 ^purpose

BigInt 주소 체계를 언제 도입하고 어떤 단계로 이전하며 어떤 성능 비용을 감수해야 하는지 운영 관점에서 정리한다.

## 전환 경로

- 전환은 safe integer 한계 경고 -> dual support -> BigInt 기본값의 순서로 진행하는 것이 안전하다.
- 저장 포맷과 와이어 포맷은 mixed mode를 버틸 수 있어야 하며, decode는 두 표현을 모두 읽어야 한다.
- 기존 Number 주소를 일괄 폐기하기보다, 큰 shape부터 점진적으로 승격하는 방식이 권장된다.

## 성능 특성

- BigInt는 연산 비용이 더 크므로, truly large space가 아닌 경우에는 Number를 유지하는 편이 낫다.
- 병목은 산술 그 자체보다 직렬화/역직렬화와 캐시 미스에서 크게 나타난다.
- 따라서 레이아웃 계산은 BigInt를 허용하되, 잦은 조회는 가능한 한 precompute된 뷰를 사용한다.
