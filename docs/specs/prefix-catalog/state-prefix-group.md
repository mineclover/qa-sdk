---
def:
  id: state-prefix-group
  tier: system
  scope: data
  aspect: prefix_schema
  depth: overview
  lifecycle: approved
  tags: [structural, entry-point, generated, cross-scope]
  links:
    - target: prefix-test_scenario
      type: contains
    - target: prefix-ir_data
      type: contains
sources:
  - packages/definition-catalog/scripts/gen-prefix-docs.mjs
  - packages/demo-snapshot/src/demo-catalog.ts
  - packages/demo-snapshot/src/demo-catalog.test.ts
  - packages/demo-types/src/prefix-ids.ts
  - packages/demo-types/src/lifecycle.test.ts
---

## 목적 ^purpose

상태 모델 prefix
category: state에 해당하는 prefix를 모아 관리한다.

## 구성 ^overview

- `test_scenario`
- `ir_data`

## 검증 ^consumes

```bash
corepack pnpm --filter demo-snapshot test
corepack pnpm --filter demo-types test
node packages/cli/dist/index.js def validate
```
