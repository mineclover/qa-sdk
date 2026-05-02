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
---

# BDD Contract System — 구현 상태

## 목적 ^purpose

BDD contract system의 현재 구현 상태와 남은 작업을 추적한다.

## 현재 구현됨 ^overview

- Core BDD 타입/스키마
- `.cases.md` / `.test.md` fenced YAML parser
- `DocumentEnvelope.metadata.bdd`
- per-document + family-wide validation
- `qa-sdk docs bdd list`
- `qa-sdk docs bdd validate`
- `qa-sdk docs bdd units`
- `qa-sdk docs bdd compile`
- `qa-sdk docs bdd test-plan`
- `qa-sdk docs bdd impl-plan`
- `BddContract → ScenarioSpec`
- `BddContract → PipeGraph`
- `docs-control-plane.cases.md` BDD contract coverage

## 검증 명령

```bash
pnpm --filter @qa-sdk/core exec vitest run src/bdd-contract/compile-scenario.test.ts src/schema/bdd-contract.schema.test.ts
pnpm --filter @qa-sdk/cli exec vitest run src/commands/docs.test.ts --testNamePattern "BDD|bdd"
pnpm --filter @qa-sdk/cli exec vitest run src/lib/docs-control-plane/docs-control-plane.test.ts --testNamePattern "BDD|bdd"
qa-sdk def validate
```

## 남은 작업

- `def validate` warning integration
- test scaffold write option
- implementation planner → PRD/JSON 변환
- dependency-contract cross-owner exception policy
- 전체 repo typecheck 오류 정리
