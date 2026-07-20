---
def:
  id: work-lifecycle-test
  type: spec
  tier: component
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  tags: [testing, structural]
  links:
    - target: work-lifecycle
      type: refines
sources:
  - packages/cli/src/commands/docs.test.ts
  - packages/cli/src/lib/docs-control-plane/docs-control-plane.test.ts
---

# Work Lifecycle — Validation Mapping

## 목적 ^purpose

`work-lifecycle`의 read-only 기계화 표면을 어떤 테스트가 검증하는지 연결한다. 이 문서는 behavior truth를 재정의하지 않고, 테스트 증거 표면만 소유한다.

## 검증 매핑 ^defines

| 검증 표면 | 테스트 |
|-----------|--------|
| `yaml work-topic` block extraction | `packages/cli/src/lib/docs-control-plane/docs-control-plane.test.ts` |
| `.cases.md` 내 work-topic block 비소비 warning | `packages/cli/src/lib/docs-control-plane/docs-control-plane.test.ts` |
| lifecycle artifacts/workTopics/prune summary | `packages/cli/src/commands/docs.test.ts` |
| cross-family `work_topic.contracts[]` resolution | `packages/cli/src/commands/docs.test.ts` |
| path suffix readiness (`:symbol`, `#anchor`) | `packages/cli/src/commands/docs.test.ts` |
| standard work-method artifact/closure mapping | `docs/specs/system/work-lifecycle.spec.md` + `docs/specs/system/work-lifecycle.cases.md` |
| source-relative Markdown navigation boundary | `.hyalo.toml` + `docs/specs/system/markdown-navigation-health.rule.md` |

## 소비 ^consumes

- `work-lifecycle`
- `work-topic-schema-plan`
- `docs-control-plane`
- `markdown-navigation-health`
