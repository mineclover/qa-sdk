---
def:
  id: system-frontend
  tier: layout
  address: def_document:v2:137229
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: experience
  tags: [structural]
  links:
    - target: browser-system
      type: refs
    - target: viz-system
      type: refs
    - target: viz-system-root
      type: refs
    - target: experience-layer-group
      type: refs
sources:
  - scripts/package-surfaces.mjs
  - docs/specs/system/system-packages.spec.md
  - docs/specs/system/package-surface-separation.rule.md
  - packages/browser-sdk/package.json
  - packages/taxonomy-web/package.json
  - packages/viz-web/package.json
  - packages/platform-demo/package.json
  - packages/shop-web/package.json
---
# Consumer/Preview 표면

## 목적 ^purpose

클라이언트 측 소비자와 preview 앱을 찾기 위한 layout 문서다. Browser SDK는 observability runtime consumer entry이고, taxonomy/profile/product demo UI는 각 capability의 읽기 전용 consumer surface다.

## 구성 ^overview

- `@qa-sdk/browser`: 브라우저 이벤트 수집/runtime SDK. taxonomy/profile 소유권 없음.
- `@qa-sdk/taxonomy-web`: taxonomy artifact preview consumer. vocabulary SSOT가 아님.
- `@qa-sdk/viz-web`: profile lineage/graph preview consumer. profile schema나 ledger write surface가 아님.
- `Product demo surfaces`: platform-demo, shop-web, roleplay-web, registry-ui 등 상위 capability를 소비해 보여주는 앱.
- `viz-system`, `viz-system-root`, `experience-layer-group`: visual/experience 문서 navigation.

## 검증 ^validation

```bash
corepack pnpm arch:surfaces
corepack pnpm arch:verify
```
