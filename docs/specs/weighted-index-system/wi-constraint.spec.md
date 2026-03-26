---
def:
  id: wi-constraint
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [tier-infra]
  links:
    - target: wi-api
      type: constrains
    - target: wi-codec
      type: constrains
    - target: partial-binder-spec
      type: constrains
    - target: range-query-spec
      type: constrains
---
# Weighted-Index 제약

## 목적 ^purpose

WeightedIndex 좌표 인코딩의 안전성을 보장하기 위한 검증 규칙, 용량 한계, 에러 경계를 정의한다.

## 검증 규칙 ^constraint

- shape의 모든 요소 > 0
- coord는 1-based (0이면 에러)
- coord[i] ≤ shape[i]
- address < size (총 주소 공간)
- totalSpace ≤ Number.MAX_SAFE_INTEGER (초과 시 BigInt 사용)
- capacity ≥ nextPowerOf2(entries.length × 2) (headroom 확보)
