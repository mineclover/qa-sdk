---
def:
  id: bdd-contract-system-02-cli-consumption
  type: knowledge
  knowledge_kind: proposal
  lifecycle: draft
  owner_system: meta-semantic-system
  projection_plane: intent
status: draft
date: 2026-04-20
part_of: bdd-contract-system
role: cli-consumption
supersedes: ai-dlc-dspy-harness-06-bdd-cli-impact
superseded_by: -
sources:
  - docs/specs/bdd-system/bdd-contract-cli.spec.md
  - docs/specs/bdd-system/bdd-contract-cli.rule.md
  - docs/specs/definition-catalog/docs-control-plane.cases.md
  - packages/cli/src/command-groups/docs.commands.ts
  - packages/cli/src/commands/docs.ts
  - packages/cli/src/commands/docs.test.ts
  - packages/cli/src/lib/docs-control-plane/bdd-contract-extract.ts
---

# BDD CLI Consumption — `qa-sdk docs bdd`

## 목적 ^purpose

BDD core contract를 소비하는 첫 CLI 표면을 정의한다. Phase 1은 새 top-level `qa-sdk bdd`가 아니라 기존 `qa-sdk docs` 아래에 BDD read model을 노출한다.

## 구성 ^overview

현재 source-backed CLI는 `qa-sdk docs bdd` 아래에만 있다. top-level `qa-sdk bdd`는 아직 없다.

```bash
qa-sdk docs bdd list <target> [--family-only] [--json]
qa-sdk docs bdd validate <target> [--family-only] [--json]
qa-sdk docs bdd units <target> [--family-only] [--json]
qa-sdk docs bdd compile <target> [--format scenario|pipe|both] [--family-only] [--json]
qa-sdk docs bdd test-plan <target> [--family-only] [--json]
qa-sdk docs bdd impl-plan <target> [--family-only] [--json]
```

---

## 1. Interface Decision

기존 인터페이스 확장:

- `qa-sdk docs status --json` may include optional `bdd` summary.
- `qa-sdk docs collect --json` may include BDD metadata via document metadata.
- `qa-sdk docs bdd ...` provides BDD-specific read views.

보류:

- top-level `qa-sdk bdd`
- `qa-sdk spec` integration
- `qa-sdk def validate` hard errors

---

## 2. 기능 경계

| 기능 | 명령 | authority |
|------|------|-----------|
| contract inventory | `list` | BDD block의 `bdd_contract.id` |
| validation read model | `validate` | parser/schema/family validation diagnostics |
| unit grouping | `units` | `test_unit.contract`, `implementation_unit.contract` join |
| deterministic compile preview | `compile` | `@qa-sdk/core` compile layer |
| test candidate preview | `test-plan` | existing `test_unit` metadata |
| implementation candidate preview | `impl-plan` | existing `implementation_unit` metadata |

`test-plan`과 `impl-plan`은 파일을 생성하지 않는다. 이 출력은 구현을 쪼개기 위한 read-only 후보이며, write authority는 별도 PRD/command가 생기기 전까지 없다.

---

## 3. 구현 증거

- command inventory는 `packages/cli/src/command-groups/docs.commands.ts`의 `docs.bdd.*` descriptor가 소유한다.
- execution path는 `packages/cli/src/commands/docs.ts`의 `cmdBdd()`가 `list`, `validate`, `units`, `compile`, `test-plan`, `impl-plan`을 분기한다.
- schema/parser/family validation은 `packages/cli/src/lib/docs-control-plane/bdd-contract-extract.ts`가 소유한다.
- CLI contract coverage는 `packages/cli/src/commands/docs.test.ts`의 `docs-control-plane.bdd.cli.*` contract tests가 소유한다.
- 대표 smoke target은 `docs/specs/definition-catalog/docs-control-plane.cases.md`이며, `docs-control-plane` family의 BDD contracts를 read-only로 소비한다.

---

## 4. 안정성 규칙

- 모든 명령은 read-only다.
- JSON field는 additive다.
- BDD block이 없는 문서는 기존처럼 동작한다.
- `--family-only`가 없으면 target 문서만 본다.
- `--family-only`가 있으면 same-family role docs와 direct module children을 본다.
