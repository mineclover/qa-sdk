---
def:
  id: bdd-contract-system-03-implementation-status
  type: knowledge
  knowledge_kind: proposal
  lifecycle: draft
  owner_system: meta-semantic-system
  projection_plane: intent
status: draft
date: 2026-04-20
part_of: bdd-contract-system
role: implementation-status
supersedes: -
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
  - packages/core/src/schema/bdd-contract.schema.test.ts
  - packages/core/src/bdd-contract/compile-scenario.ts
  - packages/core/src/bdd-contract/compile-scenario.test.ts
  - packages/cli/src/lib/docs-control-plane/bdd-contract-extract.ts
  - packages/cli/src/lib/docs-control-plane/docs-control-plane.test.ts
  - packages/cli/src/commands/docs.ts
  - packages/cli/src/commands/docs.test.ts
---

# BDD Contract System — 구현 상태

## 목적 ^purpose

BDD contract system의 현재 구현 상태와 남은 작업을 추적한다.

## 현재 구현됨 ^overview

구현 상태는 기능별로 분리해서 판정한다.

| 기능 | 구현됨 | source-backed 근거 |
|------|--------|--------------------|
| Core BDD IR | yes | `BddContract`, `BddTestUnit`, `BddImplementationUnit`, `BddContractBlock` |
| Schema normalization/validation | yes | snake_case normalize, kind/mode enum, state-transition/error 필수조건 |
| Markdown extraction | yes | fenced `yaml bdd` block parser, `DocumentEnvelope.metadata.bdd` projection |
| BDD validation read model | yes | duplicate contract, missing unit, cross-owner warning, write failure-path warning |
| CLI read surface | yes | `qa-sdk docs bdd list/validate/units/compile/test-plan/impl-plan` |
| Compile preview | yes | `BddContract → ScenarioSpec`, `BddContract → PipeGraph` |
| Test scaffold write | no | `test-plan`은 skeleton preview만 제공 |
| Implementation planner export/write | no | `impl-plan`은 source target별 preview만 제공 |
| `def validate` hard integration | no | `docs bdd validate`가 Phase 1 진단 표면 |

현재 안정화된 사용 경로는 `.cases.md` / `.test.md`의 BDD block을 읽고, `docs bdd` CLI로 조회/검증/preview하는 것이다. 실제 test/source 파일 write 기능은 아직 구현 범위 밖이다.

## 검증 명령

```bash
corepack pnpm --filter @qa-sdk/core exec vitest run src/bdd-contract/compile-scenario.test.ts src/schema/bdd-contract.schema.test.ts
corepack pnpm --filter @qa-sdk/cli exec vitest run src/commands/docs.test.ts --testNamePattern "BDD|bdd"
corepack pnpm --filter @qa-sdk/cli exec vitest run src/lib/docs-control-plane/docs-control-plane.test.ts --testNamePattern "BDD|bdd"
node packages/cli/dist/index.js def validate
```

대표 CLI smoke:

```bash
node packages/cli/dist/index.js docs bdd list docs-control-plane --family-only --json
node packages/cli/dist/index.js docs bdd validate docs-control-plane --family-only --json
node packages/cli/dist/index.js docs bdd compile docs-control-plane --family-only --format both --json
```

## 남은 작업

- `def validate` warning integration: Phase 1에서는 `docs bdd validate`가 source-backed 진단 표면이다.
- test scaffold write option: 현재는 `test-plan` preview만 있다.
- implementation planner → PRD/JSON 변환: 현재는 `impl-plan` preview만 있다.
- dependency-contract cross-owner exception policy: 현재 cross-owner implementation unit은 warning이다.
- 전체 repo typecheck 오류 정리: BDD targeted tests와 별도 안정화 항목이다.
