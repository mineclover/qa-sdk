---
def:
  id: config-loader-test
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  svc: config-loader
  tags: [testing, config, fallback, failure]
  links:
    - target: config-loader-spec
      type: refines
    - target: config-loader-rule
      type: depends_on
  sources:
    - packages/config-loader/scripts/smoke.test.mjs
---

# config-loader — Validation Mapping

## 목적 ^purpose

`config-loader`의 explicit file load, config discovery, demo fallback, invalid config failure path를 package smoke가 검증한다는 것을 연결한다.

## 검증 매핑 ^defines

| 검증 표면 | 테스트 |
|-----------|--------|
| explicit catalog/DKG JSON load | `packages/config-loader/scripts/smoke.test.mjs` |
| `qa-sdk.config.js` discovery와 relative path resolution | `packages/config-loader/scripts/smoke.test.mjs` |
| invalid catalog/DKG config rejection failure path | `packages/config-loader/scripts/smoke.test.mjs` |
| demo fallback import path | `packages/config-loader/scripts/smoke.test.mjs` |

## 검증 명령

```bash
corepack pnpm --filter config-loader test
```
