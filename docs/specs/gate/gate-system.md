---
def:
  id: gate-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  svc: gate-service
  tags: [security, entry-point, tier-infra]
  links:
    - target: gate-api
      type: contains
    - target: gate-state-model
      type: contains
    - target: gate-engine-func
      type: contains
    - target: gate-flow
      type: contains
    - target: gate-constraint
      type: contains
    - target: gate-scenario
      type: contains
    - target: gate-engine-group
      type: contains
---

# Gate 시스템

## 목적 ^purpose

주소 공간의 물리적 유효성을 관리하여 encode/decode 가능 여부를 결정하는 시스템.
dim별 상태(active/inactive/open/reserved)를 자동 계산하고, 변경을 cascade 전파한다.

## 구성 ^overview

overview: 총 6개 멤버.
- `gate-api`: RPC 엔드포인트 명세.
- `gate-state-model`: 주소 공간의 4가지 상태(active, inactive, open, reserved)와 전이 규칙을 정의한다.
- `gate-engine-func`: 주소 상태를 자동으로 계산하고, 변경을 전파하고, 질의에 gate 필터를 적용하는 엔진.
- `gate-flow`: encode, 상태변경, query 3개 경로에서 gate 상태가 어떤 순서로 확인되고 전파되는지를 정의한다.
- `gate-constraint`: gate 시스템에 부과되는 기술적 불변 조건과 보안/성능 제약을 정의한다.
- `gate-scenario`: gate 시스템의 핵심 경로를 검증하는 시나리오와 기대 결과를 정의한다.
모든 멤버에 security concern이 전파된다.
