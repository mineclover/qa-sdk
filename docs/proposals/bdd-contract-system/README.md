---
def:
  id: bdd-contract-system-readme
  type: knowledge
  knowledge_kind: proposal
  lifecycle: draft
  owner_system: meta-semantic-system
  projection_plane: intent
status: draft
date: 2026-04-20
part_of: bdd-contract-system
role: index
supersedes: ai-dlc-dspy-harness-04-bdd-contract-model
superseded_by: -
sources:
  - docs/specs/bdd-system/bdd-contract-system.spec.md
  - docs/specs/bdd-system/bdd-contract-schema.spec.md
  - docs/specs/bdd-system/bdd-contract-cli.spec.md
  - docs/specs/bdd-system/bdd-contract-cli.rule.md
  - docs/specs/bdd-system/bdd-contract-system.todo.md
  - docs/specs/definition-catalog/docs-control-plane.cases.md
  - packages/core/src/types/bdd-contract.ts
  - packages/core/src/schema/bdd-contract.schema.ts
  - packages/core/src/bdd-contract/compile-scenario.ts
  - packages/cli/src/lib/docs-control-plane/bdd-contract-extract.ts
  - packages/cli/src/commands/docs.ts
  - skills/bdd-contract/SKILL.md
---

> **Historical proposal / orientation.** 정규 SSOT는 `docs/specs/bdd-system/`의 approved spec이며, 이 proposal은 설계 의도와 소비 경계만 보존한다.

# BDD Contract System — AI-DLC 행동 계약 체계

## 배경

BDD는 DSPy harness의 하위 기능이 아니라 AI-DLC의 상위 행동 계약 체계다. `Given / When / Then`은 사람이 읽는 형식이면서 동시에 `BddContract`, `BddTestUnit`, `BddImplementationUnit`, `ScenarioSpec`, `PipeGraph`로 이어지는 결정론적 계약이다.

## 현재 판정

이 제안은 전부 하나의 runtime 기능으로 승격된 상태가 아니다. 현재 안정화된 표면은 다음 네 기능으로 분리한다.

| 기능 | 현재 authority | 구현/검증 표면 |
|------|----------------|----------------|
| BDD IR와 schema | `bdd-contract-schema.spec` | `packages/core/src/types/bdd-contract.ts`, `packages/core/src/schema/bdd-contract.schema.ts` |
| contract compile preview | `bdd-contract-system.spec` | `packages/core/src/bdd-contract/compile-scenario.ts` |
| markdown projection/validation | `docs-control-plane` adapter | `packages/cli/src/lib/docs-control-plane/bdd-contract-extract.ts` |
| read-only CLI consumption | `bdd-contract-cli.spec`, `bdd-contract-cli.rule` | `packages/cli/src/commands/docs.ts`, `packages/cli/src/command-groups/docs.commands.ts` |

`test-plan`, `impl-plan`, `compile`은 read model/preview다. test file 또는 implementation file을 쓰는 기능은 아직 authority가 없으며 `bdd-contract-system.todo`의 deferred 범위로 남긴다.

대표 실제 usecase는 `docs-control-plane` family다. `docs/specs/definition-catalog/docs-control-plane.cases.md`의 BDD contracts를 `qa-sdk docs bdd list/validate/compile docs-control-plane --family-only --json`으로 읽어 CLI read model과 compile preview를 확인한다.

## 제안 요약

BDD를 독립 시스템으로 다루고, CLI와 adapter는 그 소비 표면으로 둔다.

1. **Core mental model**: Given/When/Then, contract id, test unit, implementation unit이 의미를 소유한다.
2. **Mechanical layer**: `.cases.md` / `.test.md`의 fenced `yaml bdd` block을 파싱해 `metadata.bdd`로 투영한다.
3. **Compile layer**: `BddContract → ScenarioSpec → PipeGraph`를 deterministic하게 만든다.
4. **Consumption surface**: `qa-sdk docs bdd ...`는 BDD를 조회/검증/컴파일/계획하는 첫 소비자다.
5. **AI/DSPy boundary**: LLM/DSPy는 BDD contract를 수정하지 못하며, 보조 생성/설명/최적화 후보만 제공한다.

## 구성 문서

| 문서 | 내용 |
|------|------|
| [00-design.md](./00-design.md) | BDD core model과 시스템 경계 |
| [01-mechanical-layer.md](./01-mechanical-layer.md) | 타입/스키마/parser/read-model 기계화 설계 |
| [02-cli-consumption.md](./02-cli-consumption.md) | `qa-sdk docs bdd` 소비 표면 |
| [03-implementation-status.md](./03-implementation-status.md) | 현재 구현 상태와 남은 작업 |

## 관계

- `ai-dlc-dspy-harness`는 본 제안을 `depends_on`하는 소비자다.
- `docs-control-plane`은 본 제안의 첫 read-model/CLI 소비 표면이다.
- `bdd-contract` skill은 본 제안의 authoring workflow 소비자다.
- approved spec과 source-backed test가 없는 확장 기능은 이 proposal에서 곧바로 구현 완료로 취급하지 않는다.
