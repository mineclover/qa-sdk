---
def:
  id: docs-control-plane-test
  type: design
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: mediation
  svc: cli
  tags: [testing, contract]
  links:
    - target: docs-control-plane
      type: refines
    - target: docs-control-plane-interface
      type: depends_on
    - target: docs-control-plane-graph
      type: depends_on
    - target: docs-control-plane-bdd
      type: depends_on
    - target: docs-control-plane-cleanup
      type: depends_on
    - target: docs-control-plane-prd
      type: depends_on
    - target: docs-control-plane-transform
      type: depends_on
sources:
  - packages/cli/src/commands/docs.test.ts
  - packages/cli/src/lib/docs-control-plane/docs-control-plane.test.ts
  - packages/cli/src/lib/docs-control-plane/graph-summary.test.ts
  - packages/cli/src/lib/docs-control-plane/graph-types.test.ts
  - packages/cli/src/lib/docs-control-plane/graph-traverse.test.ts
  - packages/cli/src/lib/docs-control-plane/graph-filter.test.ts
  - packages/cli/src/lib/docs-control-plane/graph-rank.test.ts
  - packages/cli/src/lib/docs-control-plane/role-matrix.test.ts
---

# Docs Control Plane — Validation Mapping

## 목적 ^purpose

docs-control-plane family의 구현 검증 표면을 E/C/I/S 책임별로 매핑한다. BDD behavior contract는 `docs-control-plane-cases`가 소유하고, 이 문서는 실제 test file과 검증 범위만 소유한다.

## 검증 매핑 ^defines

| 책임 | 검증 표면 | 테스트 |
|------|----------|--------|
| Interface / CLI | command descriptor, dispatch, help, text/json output | `packages/cli/src/commands/docs.test.ts` |
| Graph behavior | traversal, ranking, filtering, summary, role/type counts | `packages/cli/src/lib/docs-control-plane/graph-*.test.ts`, `role-matrix.test.ts` |
| BDD behavior | BDD block extraction, diagnostics, docs bdd commands | `packages/cli/src/lib/docs-control-plane/docs-control-plane.test.ts`, `packages/cli/src/commands/docs.test.ts` |
| PRD flow | context/scaffold/to-ralph-json/sync-completion | `packages/cli/src/commands/docs.test.ts` |
| Metadata transform | transform preview, selector, protected fields, source refusal | `packages/cli/src/commands/docs.test.ts` |
| Cleanup review | completed-record recommendation, family/PRD cleanup scope | `packages/cli/src/commands/docs.test.ts` |
| Family/read model | family-only scope, lifecycle summary, role coverage, source collection | `packages/cli/src/commands/docs.test.ts`, `packages/cli/src/lib/docs-control-plane/docs-control-plane.test.ts` |

## 검증 명령

```bash
pnpm --filter @qa-sdk/cli test -- docs.test.ts
pnpm --dir packages/cli exec vitest run src/lib/docs-control-plane/graph-summary.test.ts src/lib/docs-control-plane/graph-types.test.ts src/lib/docs-control-plane/graph-traverse.test.ts src/lib/docs-control-plane/graph-filter.test.ts src/lib/docs-control-plane/graph-rank.test.ts src/lib/docs-control-plane/role-matrix.test.ts
```

## BDD 연결

- `docs-control-plane-cases`의 `test_units[]`는 이 문서의 test files와 일치해야 한다.
- `docs bdd validate docs-control-plane --family-only --json`은 `passed: true`여야 한다.
