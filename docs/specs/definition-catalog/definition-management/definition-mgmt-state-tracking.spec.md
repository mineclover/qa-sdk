---
def:
  id: definition-mgmt-state-tracking
  type: design
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: state
  aspect: system_state
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [testing]
  links:
    - target: definition-management
      type: refines
    - target: definition-state-model
      type: depends_on
    - target: definition-harness
      type: depends_on
    - target: definition-quality-gates
      type: depends_on
sources:
  - packages/definition-catalog/src/harness-machines.ts
  - packages/definition-catalog/src/harness-state-model.ts
  - packages/definition-catalog/src/harness-tracker.ts
  - packages/definition-catalog/src/harness-machines.test.ts
  - packages/definition-catalog/src/harness-guards.test.ts
---

# Definition Management — 상태 추적

## 목적 ^purpose

definition 문서와 관련 시스템 상태를 하네스/게이트 기반으로 추적하는 방법을 정리한다. 문서 lifecycle, 구현 상태, 동기화 상태, version/address 상태를 한 흐름으로 읽게 한다.

## 구성 ^overview

- 11개 상태 머신
- 품질 게이트 추적
- 하네스와 게이트의 역할 분리

## 11개 상태 머신

| 머신 | 추적 대상 | prefix |
|------|----------|--------|
| doc-lifecycle | draft → review → approved | harness_transition |
| spec-impl | designed → implementing → verified | harness_transition |
| convention-compliance | unverified → compliant | harness_transition |
| db-sync | out-of-sync → synced | harness_transition |
| address-state | open → active → inactive | harness_transition |
| version-lifecycle | draft → released → active | harness_transition |
| + 5개 시스템 머신 | service, event, metric, flow, policy | harness_transition |

## 품질 게이트 (gate-tracker)

| 관측 | prefix | 추적 |
|------|--------|------|
| 게이트 전이 | gate_execution | kind × scope × state |
| 번들 완성도 | bundle_observation | bundle_state |
| guard 검증 | harness_guard | machine × state × verdict |

## 역할 분리 ^constraint

- 상태 머신의 정의는 `definition-state-model`이 소유한다.
- 상태 머신의 적용과 의존 관계는 `definition-harness`가 소유한다.
- 게이트 결과의 실행 증거는 quality gate/quality ledger가 소유한다.
