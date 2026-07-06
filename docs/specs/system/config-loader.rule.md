---
def:
  id: config-loader-rule
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: config-loader
  tags: [runtime, config, contract]
  links:
    - target: config-loader-spec
      type: constrains
sources:
  - packages/config-loader/src/catalog-loader.ts
  - packages/config-loader/src/dkg-config-loader.ts
  - packages/config-loader/src/index.ts
  - packages/config-loader/scripts/smoke.test.mjs
---

# config-loader — Consumption Rule

## 목적 ^purpose

`config-loader`를 CLI와 소비자 앱에서 사용할 때 파일 탐색, fallback, schema ownership이 섞이지 않도록 consumption rule을 고정한다.

## 규칙 ^constraint

- 호출자는 explicit path를 우선 전달하고, 없을 때만 cwd의 `qa-sdk.config.ts` 또는 `qa-sdk.config.js` discovery에 의존한다.
- module export는 default export, well-known named export, `*_CATALOG` 같은 loader-supported shape만 사용한다.
- loader의 shape guard는 최소 구조 확인이다. catalog axis/prefix 의미 검증은 catalog/definition/decision package가 수행한다.
- demo fallback은 local bootstrap 편의를 위한 마지막 경로다. production config의 source of truth로 승격하지 않는다.
- CLI flag parsing, help text, user-facing error formatting은 CLI package가 소유하고 loader에 넣지 않는다.

## 검증 ^validation

```bash
corepack pnpm --filter config-loader typecheck
corepack pnpm --filter config-loader test
corepack pnpm --filter config-loader build
qa-sdk docs closure config-loader-spec
```
