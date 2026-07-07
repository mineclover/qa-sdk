---
def:
  id: tier-redesign-examples-readme
  type: knowledge
  knowledge_kind: proposal
  lifecycle: draft
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: layout
  depth: overview
  links:
    - target: tier-redesign-readme
      type: depends_on
    - target: tier-redesign-examples-deterministic-label-record
      type: refs
    - target: tier-redesign-examples-deterministic-label-record-state
      type: refs
    - target: tier-redesign-examples-deterministic-label-system
      type: refs
    - target: tier-redesign-examples-approval-request-state
      type: refs
    - target: tier-redesign-examples-approval-system
      type: refs
    - target: tier-redesign-examples-docs-control-plane-layout
      type: refs
status: draft
date: 2026-04-18
part_of: tier-redesign
role: examples-index
sources:
  - docs/proposals/tier-redesign/README.md
  - docs/proposals/tier-redesign/03-decisions.md
  - docs/proposals/tier-redesign/tiers/component.md
  - docs/proposals/tier-redesign/tiers/system.md
  - docs/proposals/tier-redesign/rules/state-machine-delegation.md
  - docs/proposals/tier-redesign/rules/system-independence.md
  - docs/proposals/tier-redesign/examples/deterministic-label-record.md
  - docs/proposals/tier-redesign/examples/deterministic-label-record-state.md
  - docs/proposals/tier-redesign/examples/deterministic-label-system.md
  - docs/proposals/tier-redesign/examples/approval-request-state.md
  - docs/proposals/tier-redesign/examples/approval-system.md
  - docs/specs/definition-catalog/docs-control-plane.spec.md
  - docs/specs/definition-catalog/deterministic-label-stability-boundary.memo.md
  - packages/deterministic-label-registry/src/index.ts
  - packages/deterministic-label-registry/src/inventory.ts
  - packages/deterministic-label-registry/src/records.ts
---

# STC Pilot Examples

STC tier 패턴을 실제 문서로 적용한 Pilot 초안들. Phase 3 Pilot 검증 전에 작성되어 schema 실효성을 사전 점검.

본 디렉토리는 `docs/proposals/tier-redesign/` 격리 영역 — **`def sync` / `def validate` 스캔 대상 아님** (상위 [proposals README](../README.md) 규칙 상속). 따라서 가상 참조(`depends_on: notification-system` 등, 실존 target 없음)가 **broken-link error로 잡히지 않음**. tier 필드 공식 지원 전까지 격리 유지.

> **D-17 Pivot 반영 (2026-04-18)**: FSM tier 제거. 이전에 있던 `deterministic-label-record-fsm.md` Pilot은 삭제됨. 상태 관리는 System의 `lifecycle_ref`로 State Component + meta-semantic 참조.

## 현재 증거 경계

예시는 두 성격으로 나뉜다.

- `deterministic-label-*` 예시는 실제 `packages/deterministic-label-registry`와
  `docs-control-plane` 정규 스펙을 배경으로 한 read-only projection pilot이다. 단 현행 패키지는
  `docs/specs/definition-catalog/deterministic-label-stability-boundary.memo.md`의 결정에 따라
  FSM readiness, `currentState`, transition dry-run을 제거한 **stateless projection**이다.
- `approval-*` 예시는 qa-sdk에 실재하지 않는 write-mode virtual pilot이다. `approval-system`,
  `approval-pipe`, `notification-system`, `audit-log-system`은 검증 가능한 구현 surface가 아니라
  D-17/D-18 패턴을 미리 검토하기 위한 proposal-local 예시다.

## 예시 목록

| 파일 | Tier | Sub-type / mode | 역할 |
|------|------|---------|------|
| [deterministic-label-record.md](./deterministic-label-record.md) | Component | **data-shape** (D-18) | 현행 `DeterministicLabelRecord` field shape + Component 참조 패턴 |
| [deterministic-label-record-state.md](./deterministic-label-record-state.md) | Component | state-enum (D-18) | historical/readiness state pilot. 현행 code enum은 제거됨 |
| [deterministic-label-system.md](./deterministic-label-system.md) | System | stateless read-only projection | `buildDeterministicLabelInventory()` 중심의 현행 projection boundary |
| [approval-request-state.md](./approval-request-state.md) | Component | state-enum (D-18) | **Write-mode** 도메인 상태 (4 states) — 가상 Pilot |
| [approval-system.md](./approval-system.md) | System | **write-mode** | `lifecycle_ref: pipe_refs=[3개]` 패턴 + meta-semantic 위임 + compensate — 가상 Pilot |
| [docs-control-plane-layout.md](./docs-control-plane-layout.md) | Layout | — | 5 Systems 참조 + heading mirror 패턴 |

## 상호 관계

### Read-only 경로

```
docs-control-plane-layout (Layout)
  refs:
    ├── deterministic-label-system (System)
    │     current implementation:
    │       stateless read-only projection
    │       buildDeterministicLabelInventory()                  ← current API
    │     historical/STC pilot:
    │       deterministic-label-record-state                    ← removed from current code
    ├── doc-envelope-system
    ├── ontology-pack-validate-system
    ├── docs-graph-system
    └── prd-completion-sync-system
```

### Write-mode 경로 (가상 Pilot)

```
approval-system (System)
  lifecycle_ref:
    state_component: approval-request-state                    ← Component, state-enum
    pipe_refs:
      - meta-semantic/.../approval-pipe#approve-transition    ← 가상 pipe (Phase 1.B 작성)
      - meta-semantic/.../approval-pipe#reject-transition
      - meta-semantic/.../approval-pipe#cancel-transition
    read_only_projection: false
  depends_on:
    - notification-system  (가상)
    - audit-log-system     (가상)
```

두 예시가 서로를 참조하는 실제 STC 구조 증명:
- Layout → System (refs)
- System → Component State (lifecycle_ref)
- System → meta-semantic pipe (lifecycle_ref, read-only면 빈 배열)

## 미작성된 Pilot

- ~~Component State Pilot~~ — **D-18로 작성됨** ([deterministic-label-record-state.md](./deterministic-label-record-state.md), [approval-request-state.md](./approval-request-state.md))
- ~~Write-mode System Pilot~~ — **가상으로 작성됨** ([approval-system.md](./approval-system.md), 긴장 3 부분 해소). 실증은 실제 write-mode controller + meta-semantic pipe 문서 작성 시점에 완성
- ~~data-shape Component Pilot~~ — **작성됨** ([deterministic-label-record.md](./deterministic-label-record.md)). 5th review polish 반영 — state-enum 외 sub-type 1종 실증
- **실제 meta-semantic pipe Pilot**: `approval-pipe.spec.md` 등 approval-system이 참조하는 가상 경로를 실제 meta-semantic 문서로 작성 (Phase 1.B)
- **evidence-shape Component Pilot**: guard 결과 같은 evidence 형상 — 필요 시 추가 (data-shape의 `*EvidenceRef` 참조 target)
- **data-facet-role Component Pilot**: 생산/소비/정의 등 역할별 Component — 필요 시 추가

## 각 예시의 Pilot 관찰 섹션

각 예시 말미에 "Pilot 관찰" 섹션이 있다. Pilot 실행 중 발견한 schema 긴장점 / 개선 여지를 여기에 수집 → Phase 3 Pilot 검증 대상.

## 수락(accepted) 후 처리

본 예시들은 Pilot 단계에서만 유효. STC 제안이 수락되면:

1. 실제 정규 spec으로 전환 또는 참조 예시로 `docs/specs/**`에 이동
2. 본 파일들은 `superseded_by: <정규 spec 경로>` 표기 + 본문 수정 금지 (역사 기록)
