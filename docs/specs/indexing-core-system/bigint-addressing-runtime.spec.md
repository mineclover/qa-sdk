---
def:
  id: bigint-addressing-runtime
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [tier-infra]
  links:
    - target: coord-foundation
      type: depends_on
    - target: bigint-addressing
      type: refines
---

# BigInt 주소 체계 - 런타임 계약

## 목적 ^purpose

shape product가 safe integer 범위를 넘을 때 NumberType 선택, BigInt API, layout protocol, index-meta 계약이 어떻게 바뀌는지 정리한다.

## 런타임 API

- `weighted-index`는 Number와 BigInt를 같은 연산 모델로 제공하되, 타입만 분기한다.
- layout protocol은 stride, capacity, decode 규칙을 BigInt에서도 동일하게 유지해야 한다.
- `index-meta`는 주소 해석과 직렬화 계층에서 BigInt 지원 여부를 명시적으로 드러내야 한다.

## 동등성 규칙

- Number/BigInt 동등성은 표현 타입이 달라도 같은 좌표 의미를 유지하는 데 목적이 있다.
- 비교, 직렬화, decode roundtrip에서 타입 승격이 주소 의미를 바꾸지 않아야 한다.
- 마이그레이션과 성능 전략은 `bigint-addressing-rollout`에서 별도로 다룬다.
