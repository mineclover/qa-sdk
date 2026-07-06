---
def:
  id: bdd-contract-system-todo
  type: knowledge
  knowledge_kind: proposal
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [testing, contract]
  links:
    - target: bdd-contract-system
      type: traces_to
    - target: bdd-contract-schema
      type: traces_to
    - target: bdd-contract-cli
      type: traces_to
sources:
  - docs/specs/bdd-system/bdd-contract-system.spec.md
  - docs/specs/bdd-system/bdd-contract-cli.spec.md
  - docs/specs/bdd-system/bdd-contract-cli.rule.md
  - docs/specs/definition-catalog/docs-control-plane.cases.md
  - packages/cli/src/commands/docs.ts
  - packages/cli/src/commands/docs.test.ts
  - packages/cli/src/lib/docs-control-plane/bdd-contract-extract.ts
  - packages/cli/src/lib/docs-control-plane/docs-control-plane.test.ts
---

# BDD Contract System — TODO

## 목적 ^purpose

BDD Contract System의 구현 완료 항목과 남은 실행 작업을 추적한다. 현재 Phase 1은 read-only 기계화와 compile preview가 구현됐고, write/scaffold/gate integration은 후속으로 남겨둔다.

## 구현 항목

구현된 사실은 `bdd-contract-system.spec`, `bdd-contract-schema.spec`, `bdd-contract-cli.spec`가 소유한다. 이 TODO는 남은 실행 작업만 유지한다.

## 현재 분리 판정

| 범위 | 판정 | 추적 위치 |
|------|------|-----------|
| BDD block parser/schema/metadata | implemented | `bdd-contract-schema.spec`, `bdd-contract-system.spec` |
| `docs bdd` read-only CLI | implemented | `bdd-contract-cli.spec`, `bdd-contract-cli.rule` |
| ScenarioSpec/PipeGraph compile preview | implemented | `bdd-contract-system.spec` |
| command smoke example capture | actionable | 이 TODO |
| authoring examples | actionable | 이 TODO |
| write/scaffold/gate integration | deferred | 이 TODO |

따라서 이 문서는 완료된 기능을 다시 소유하지 않는다. 남은 항목은 CLI smoke output, authoring examples, 정책 결정, write/gate 통합 후보만 추적한다.

현재 smoke 대상은 `docs-control-plane` family다. 명령 실행 자체는 검증에 사용하되, full output 예시를 spec/guide에 고정하는 작업은 아래 Actionable 항목으로 남긴다.

### Actionable — 실행 가능

- [ ] BDD command docs smoke
  - [ ] `qa-sdk docs bdd list docs-control-plane --family-only --json` output example capture
  - [ ] `qa-sdk docs bdd validate docs-control-plane --family-only --json` output example capture
  - [ ] `qa-sdk docs bdd compile docs-control-plane --family-only --format both --json` output example capture
  - [ ] captured examples를 `bdd-contract-cli.spec.md` 또는 guide에 반영

- [ ] BDD authoring examples
  - [ ] 최소 `.cases.md` example
  - [ ] `.cases.md` contract + `.test.md` units cross-file example
  - [ ] validation-failure example
  - [ ] dependency-contract example

- [ ] Dependency-contract ownership policy
  - [ ] adapter 구현 시 `implementation_unit.owned_by != owner_system` 예외 허용 여부 결정
  - [ ] 허용 시 `links.provider` 또는 `contract_kind: dependency-contract` 조건으로 제한
  - [ ] `bdd-contract-extract.ts` validation에 정책 반영

### Deferred — 조건부 대기

- [ ] `def validate` integration
  - [ ] Phase 1은 `docs bdd validate`가 BDD 진단 표면
  - [ ] `def validate`에는 먼저 warning-only로 통합
  - [ ] hard error 전환은 accepted spec 이후 별도 결정

- [ ] Test scaffold write option
  - [ ] `docs bdd test-plan`은 read-only preview
  - [ ] 실제 파일 쓰기는 `--write`가 아니라 별도 명령/PRD에서 시작
  - [ ] test file overwrite/merge 정책 필요

- [ ] Implementation planner export
  - [ ] `docs bdd impl-plan` 결과를 PRD markdown 또는 ralph JSON으로 변환
  - [ ] source target별 작업 묶음과 owner boundary 검토

- [ ] Quality gate integration
  - [ ] BDD contract coverage gate
  - [ ] test unit coverage gate
  - [ ] implementation unit ownership gate

- [ ] Full typecheck recovery
  - [ ] 현재 BDD targeted tests는 통과
  - [ ] repo 전체 `@qa-sdk/core` / `@qa-sdk/cli` typecheck는 기존 unrelated 오류 정리 필요

### Parking Lot — 후보 보관

- [ ] Top-level `qa-sdk bdd`
  - [ ] BDD가 독립 runtime/package로 승격될 때만 검토

- [ ] `qa-sdk spec` integration
  - [ ] ScenarioSpec/PipeGraph compile이 안정화된 뒤 검토

- [ ] DSPy-assisted BDD authoring
  - [ ] LLM/DSPy는 candidate 생성만 가능
  - [ ] approved BDD contract 자동 수정은 금지
