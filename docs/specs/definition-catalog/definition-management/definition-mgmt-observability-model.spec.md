---
def:
  id: definition-mgmt-observability-model
  type: design
  tier: system
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: flow
  aspect: mgmt_flow
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [observability, decision]
  links:
    - target: definition-mgmt-feedback-loop
      type: contains
    - target: definition-mgmt-state-tracking
      type: contains
    - target: definition-mgmt-verification-loop
      type: contains
    - target: harness-architecture
      type: depends_on
    - target: definition-mgmt-observability-planes
      type: contains
    - target: definition-mgmt-reachable-path-registry
      type: contains
sources:
  - packages/definition-catalog/src/observe.ts
  - packages/definition-catalog/src/harness-state-model.ts
  - packages/definition-catalog/src/cross-loop-bridge.ts
  - packages/definition-catalog/src/quality-report.test.ts
---
# Definition Management — Observability Model

## 목적 ^purpose

definition 관리에서 무엇을 관찰하고 어떤 좌표로 남길지의 기본 틀을 고정한다. 핵심 평면 정의와 reachable path registry를 분리해, 대시보드/이벤트/prefix 추가가 의미 계층을 흔들지 않도록 한다.

## 구성 ^overview

- `definition-mgmt-observability-planes`
  Definition, State, Decision, Verification 네 평면과 제어 루프 심볼을 정의한다.
- `definition-mgmt-reachable-path-registry`
  family-local path id, reachable path registry, path lifecycle FSM, family별 branch point를 정의한다.

## 원칙

- 추가 시각화나 audit surface는 새 의미 계층을 만들지 않고 기존 평면의 projection이어야 한다.
- path id는 전체 곱공간 주소가 아니라 family별 reachable path의 sparse registry여야 한다.
