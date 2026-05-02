---
def:
  id: responsibility-closure-harness-test
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  svc: definition-service
  tags: [testing, structural, error-handling, authorization, observability]
  links:
    - target: responsibility-closure-harness
      type: refines
    - target: responsibility-closure-harness-rule
      type: depends_on
---

# Responsibility Closure Harness — Validation Mapping

## 목적 ^purpose

Responsibility Closure Harness의 현재 검증 표면을 연결한다. 이 문서는 closure behavior를 새로 정의하지 않고, 현재 존재하는 tests가 어떤 폐쇄 조건을 검증하는지만 매핑한다.

## 검증 매핑 ^defines

| closure 조건 | 현재 테스트 |
|--------------|-------------|
| `docs closure <doc-id|source>` read-only CLI | `packages/cli/src/commands/docs.test.ts` |
| concern-specific missing evidence aggregation | `packages/cli/src/commands/docs.test.ts` |
| concern-specific positive evidence removes missing items | `packages/cli/src/commands/docs.test.ts` |
| source symbol-level target matching | `packages/cli/src/commands/docs.test.ts` |
| frontmatter/link/source scan이 active docs를 등록한다 | `packages/definition-catalog/src/scan-real.test.ts` |
| structural links와 orphan/link coverage가 깨지지 않는다 | `packages/definition-catalog/src/system-link-coverage.test.ts` |
| topdown/assembly가 `contains`와 `refs` 구조를 조립한다 | `packages/definition-catalog/src/assemble.test.ts` |
| family-only scope가 System contains와 Layout refs를 조립한다 | `packages/doc-envelope/src/family-scope.test.ts` |
| docs control-plane family/read model/source collection이 동작한다 | `packages/cli/src/commands/docs.test.ts` |

## 수동 검증 명령

```bash
node packages/cli/dist/index.js docs collect responsibility-closure-harness --family-only
node packages/cli/dist/index.js docs collect definition-harness --family-only
node packages/cli/dist/index.js docs collect work-lifecycle --family-only
pnpm --filter definition-catalog exec vitest run
pnpm --filter @qa-sdk/cli test -- docs.test.ts
```

## 아직 없는 검증

- production-scale source symbol ownership split fixture.
