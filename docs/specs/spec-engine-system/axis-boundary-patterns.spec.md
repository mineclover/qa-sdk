---
def:
  id: axis-boundary-patterns
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [entry-point]
  links:
    - target: axis-boundary-spec
      type: refines
---

# Axis 경계 적용 패턴

## 목적 ^purpose

api prefix 재설계, 서비스 계층 주소 표현, 미들웨어 자동 태깅처럼 axis 경계 기준이 실제 설계에 적용되는 패턴을 정리한다.

## 적용 사례

- api prefix 재설계는 계층 주소를 prefix_ref로 표현해 axis 남용을 줄이는 사례다.
- 서비스 계층 주소 표현은 구조적 트리를 axis 증가 없이 표현하는 경로를 보여준다.
- 미들웨어 자동 태깅은 경계 판단을 런타임 자동화와 연결할 때 필요한 보수적 원칙을 담는다.
