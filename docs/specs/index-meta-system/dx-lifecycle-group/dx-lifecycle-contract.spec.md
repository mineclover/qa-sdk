---
def:
  tier: component
  id: dx-lifecycle-contract
  address: def_document:v2:136322
  scope: flow
  aspect: user_scenario
  depth: specification
  lifecycle: approved
  layer: operation
  svc: index-meta
  tags: [contract, runtime, versioning]
  links:
    - target: resolver-spec
      type: refines
    - target: dx-lifecycle-group
      type: refines
---

# Index Meta DX - 출력 계약

## 목적 ^purpose

index-meta DX에서 와이어 포맷, 타입 추론, 제약 조건이 어떤 출력 계약을 만들어야 하는지 정리한다.

## 출력 표면

- 와이어 포맷은 브라우저, 서비스, 저장소가 같은 주소 의미를 공유하도록 만드는 공통 표면이다.
- 타입 추론은 사람이 prefix와 entry 이름만 알면 충분하도록 메타데이터 세부 구조를 숨겨야 한다.
- resolver 단계에서 생성된 번들과 타입 정보는 같은 registry snapshot을 기준으로 해야 drift가 없다.

## 제약

- DX 계약은 "쉽다"보다 "헷갈리지 않는다"를 우선한다.
- codegen 산출물, runtime decode, wire payload가 서로 다른 version이나 naming 규칙을 쓰면 안 된다.
- 도구 흐름은 `dx-lifecycle-tooling`, 소비 번들 규칙은 `resolver-spec`을 전제로 한다.
