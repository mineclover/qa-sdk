---
def:
  id: policy-prefix-group
  tier: system
  scope: data
  aspect: prefix_schema
  depth: overview
  lifecycle: approved
  tags: [structural, entry-point, generated, cross-scope]
  links:
    - target: prefix-permission
      type: contains
    - target: prefix-rbac
      type: contains
    - target: prefix-service
      type: depends_on
  sources:
    - packages/definition-catalog/scripts/gen-prefix-docs.mjs
    - packages/demo-snapshot/src/demo-catalog.ts
    - packages/demo-snapshot/src/demo-catalog.test.ts
    - packages/demo-types/src/prefix-ids.ts
    - packages/demo-types/src/lifecycle.test.ts
---

## 목적 ^purpose

권한/접근 제어 prefix
category: policy에 해당하는 prefix를 모아 관리한다.

## 구성 ^overview

- `permission`
- `rbac`

## 검증 ^consumes

```bash
corepack pnpm --filter demo-snapshot test
corepack pnpm --filter demo-types test
node packages/cli/dist/index.js def validate
```
