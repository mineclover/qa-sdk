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
---

# BDD CLI Consumption — `qa-sdk docs bdd`

## 목적 ^purpose

BDD core contract를 소비하는 첫 CLI 표면을 정의한다. Phase 1은 새 top-level `qa-sdk bdd`가 아니라 기존 `qa-sdk docs` 아래에 BDD read model을 노출한다.

## 구성 ^overview

현재 CLI:

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

## 2. 명령별 역할

| command | 역할 |
|---------|------|
| `list` | contract 목록 |
| `validate` | BDD diagnostics |
| `units` | contract id 기준 test/implementation unit 그룹 |
| `compile` | ScenarioSpec/PipeGraph read-only compile |
| `test-plan` | test skeleton 후보 preview |
| `impl-plan` | source target별 implementation unit preview |

---

## 3. 안정성 규칙

- 모든 명령은 read-only다.
- JSON field는 additive다.
- BDD block이 없는 문서는 기존처럼 동작한다.
- `--family-only`가 없으면 target 문서만 본다.
- `--family-only`가 있으면 same-family role docs와 direct module children을 본다.
