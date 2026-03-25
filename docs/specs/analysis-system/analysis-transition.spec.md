---
def:
  id: analysis-transition
  scope: state
  aspect: domain_state
  depth: specification
  lifecycle: approved
  tags: [observability, tier-system]
  links:
    - target: analysis-prefix
      type: depends_on
---
# TransitionSpec — 상태 전이

## 목적 ^purpose

이벤트로 인해 엔티티의 상태가 어떻게 전이되는지를 정의하는 스펙. "이 이벤트로 무엇이 되었는가"에 대한 답.
