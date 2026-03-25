---
def:
  id: axis-boundary-criteria
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  tags: [entry-point]
  links:
    - target: axis-boundary-spec
      type: refines
---

# Axis 경계 판단 기준

## 목적 ^purpose

무엇이 axis이고 무엇이 아닌지 판단하는 기준, 분류표, 재설계 판단선을 분리해 좌표 모델의 핵심 경계를 정리한다.

## 판단 기준

- axis는 유한하고 안정적인 선택지를 가져야 하며 행동/의사결정에 실제 영향을 줘야 한다.
- 분류표는 candidate 속성이 axis, data, 상태값 중 어디에 속하는지 빠르게 판단하는 기준선이다.
- 재설계가 필요한 경우는 axis 추가보다 prefix 재조정이 더 적합한지 함께 봐야 한다.
