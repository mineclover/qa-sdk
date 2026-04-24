---
def:
  id: bdd-contract-system-00-design
  type: knowledge
  knowledge_kind: proposal
  lifecycle: draft
  owner_system: meta-semantic-system
  projection_plane: intent
status: draft
date: 2026-04-20
part_of: bdd-contract-system
role: overview
supersedes: ai-dlc-dspy-harness-04-bdd-contract-model
superseded_by: -
---

# BDD Contract System — 설계 개요

## 목적 ^purpose

AI-DLC에서 BDD를 단순 테스트 설명이 아니라 **행동 계약의 주권 계층**으로 정의한다. 목표는 사람이 작성하는 `Given / When / Then`을 도구가 검증 가능한 `BddContract`로 정규화하고, 같은 contract id에서 test unit과 implementation unit을 함께 도출하는 것이다.

## 구성 ^overview

BDD core는 의미를 소유하고, CLI/service surface는 이를 소비한다.

```
BDD Contract Core
  ├─ Given / When / Then
  ├─ BddContract
  ├─ BddTestUnit
  └─ BddImplementationUnit
        ↓ consumed by
Docs Control Plane
  ├─ metadata.bdd
  └─ qa-sdk docs bdd ...
        ↓ compiles to
ScenarioSpec / PipeGraph
        ↓ verifies through
test files / quality gates
```

---

## 1. 핵심 원칙 ^defines

### 1.1 BDD core가 의미를 소유한다

CLI나 adapter가 BDD의 의미를 소유하지 않는다. CLI는 BDD를 읽고, 검증하고, 컴파일하고, 계획하는 소비자다.

### 1.2 Contract id가 연결 키다

`bdd_contract.id`는 test unit과 implementation unit을 연결하는 primary key다.

```text
bdd_contract.id
  ├─ test_unit.contract
  └─ implementation_unit.contract
```

### 1.3 테스트 단위와 구현 단위는 함께 도출된다

테스트만 contract에 묶고 구현은 임의로 만들면 AI agent가 계층을 무너뜨릴 수 있다. 따라서 BDD는 test unit과 implementation unit을 동시에 만든다.

### 1.4 Compile은 deterministic이어야 한다

`BddContract → ScenarioSpec → PipeGraph`는 LLM/DSPy 없이 수행된다. DSPy는 BDD contract의 작성 보조, lint 설명, test prompt 최적화 후보로만 참여한다.

---

## 2. BDD 정규형

```yaml
bdd_contract:
  id: approval-request.pending.approve.approved.v1
  owner_system: approval-system
  contract_kind: state-transition
  mode: write
  given:
    state_component: approval-request-state
    state: PENDING
    predicates: [request.exists, approver.has_permission]
  when:
    actor: approver
    operation: approval-system.approve
    event_key: approval.approve.requested
  then:
    state: APPROVED
    emits: [approval.approved]
    egress:
      - axis: approval_request.status
        value: APPROVED

test_unit:
  id: TU-approval-approve-success
  contract: approval-request.pending.approve.approved.v1
  level: integration
  assertions: [then.state, then.emits, then.egress]

implementation_unit:
  id: IU-approval-approve-operation
  contract: approval-request.pending.approve.approved.v1
  unit_kind: operation
  owned_by: approval-system
  source_target: packages/approval/src/approval-system.ts
```

---

## 3. 기존 체계와의 관계

| 체계 | 관계 |
|------|------|
| definition-catalog | `.cases.md` / `.test.md` 문서를 보존한다. Phase 1 hard validation은 하지 않는다 |
| docs-control-plane | BDD block을 read model로 소비하고 `metadata.bdd`를 만든다 |
| ScenarioSpec | BDD contract의 deterministic compile target |
| PipeGraph | ScenarioSpec 이후 실행 의미론 target |
| work-domain | 후속 단계에서 BDD test/implementation quality gate를 소비 |
| ai-dlc-dspy-harness | BDD를 상위 계약으로 의존한다 |

---

## 4. 비목표

- BDD block을 frontmatter로 올리지 않는다.
- Phase 1에서 문서를 자동 수정하지 않는다.
- Phase 1에서 `def validate` hard error로 연결하지 않는다.
- LLM/DSPy가 compile truth가 되지 않는다.
