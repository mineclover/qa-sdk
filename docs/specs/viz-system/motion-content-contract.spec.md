---
def:
  id: motion-content-contract
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  tags: [tier-frontend]
  links:
    - target: motion-content-glossary
      type: refines
---

# Motion Content 계약

## 목적 ^purpose

motion-content 계열 패키지의 용어집, 책임 경계, 런타임 비목표를 분리해 선언형 모션 편집 스택의 계약을 정리한다.

## 패키지 경계

- 개념층은 Remotion식 모델을 참고하지만 런타임은 GSAP 기반 실행으로 한정한다.
- 패키지 책임 경계는 편집기 셸, 코어 모델, 런타임 실행기를 분리하는 방향을 따른다.
- Done definition과 비목표를 함께 적어 기능 확장이 런타임 범위를 침범하지 않게 한다.
