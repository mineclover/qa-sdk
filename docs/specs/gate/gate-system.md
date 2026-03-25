---
def:
  id: gate-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [security, entry-point]
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
---
# Gate 시스템

## 목적 ^purpose

주소 공간의 물리적 유효성을 관리하여 encode/decode 가능 여부를 결정하는 시스템.
dim별 상태(active/inactive/open/reserved)를 자동 계산하고, 변경을 cascade 전파한다.

## 구성 ^overview

6개 정의로 구성: API 계약, 상태 모델, 계산 엔진, 운영 흐름, 기술적 제약, 테스트 시나리오.
모든 멤버에 security concern이 전파된다.
