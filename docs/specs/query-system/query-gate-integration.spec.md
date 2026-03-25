---
def:
  id: query-gate-integration
  scope: flow
  aspect: relation
  depth: specification
  lifecycle: approved
  links:
    - target: gate-api
      type: depends_on
    - target: query-api
      type: refines
---
# Query-Gate 통합

## 목적 ^purpose

질의 결과에 gate 상태를 합성하는 통합 경로. gateMode(fail-open/fail-closed)와 withGate 플래그로 gate 필터 적용 여부를 제어한다.
