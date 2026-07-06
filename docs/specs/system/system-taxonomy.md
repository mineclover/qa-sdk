---
def:
  id: system-taxonomy
  tier: layout
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: domain
  tags: [taxonomy, structural, entry-point]
  links:
    - target: taxonomy-boundaries
      type: refs
    - target: package-surface-separation-rule
      type: refs
    - target: system-packages
      type: refs
  sources:
    - scripts/package-surfaces.mjs
    - scripts/report-package-surfaces.mjs
    - packages/taxonomy-engine/package.json
    - packages/taxonomy-engine/src/index.ts
    - packages/taxonomy-engine/__tests__/unit/public-api.test.ts
    - packages/taxonomy-decision-bridge/package.json
    - packages/taxonomy-decision-bridge/src/index.ts
    - packages/taxonomy-decision-bridge/__tests__/sync.test.ts
    - packages/taxonomy-web/package.json
    - packages/taxonomy-web/src/data/loadStaticTaxonomies.ts
    - packages/taxonomy-web/src/lib/lib.test.ts
---

# Taxonomy Capability

## 목적 ^purpose

유한 vocabulary를 선언, 검증, 변환, 미리보기하는 기능군의 operator entry다. 이 문서는 taxonomy capability를 profile contract나 제품 demo surface와 섞지 않고, 어떤 패키지를 봐야 하는지 먼저 가리킨다.

## 구성 ^overview

| Surface id | 패키지 | 실제 usecase | 소유하지 않는 것 |
|------------|--------|--------------|------------------|
| `taxonomy-tooling` | `taxonomy-engine` | YAML taxonomy parse/validate/diff/codegen, ref 해석, finite vocabulary gate | decision-flow runtime state, browser preview state, profile measurement |
| `taxonomy-decision-bridge` | `taxonomy-decision-bridge` | taxonomy artifact와 decision-flow schema 사이 round-trip 변환 | vocabulary SSOT, web preview ownership |
| `taxonomy-preview-surfaces` | `@qa-sdk/taxonomy-web` | generated/static taxonomy artifact 탐색, related docs/diff preview | vocabulary entry 작성, validation rule 소유 |

## 사용 경로 ^method

- 유한 vocabulary 자체를 고치거나 5Q checklist를 확인할 때는 `taxonomy-engine`과 `taxonomy-boundaries`를 본다.
- decision-flow와 taxonomy artifact를 연결해야 할 때만 `taxonomy-decision-bridge`를 본다.
- 사람이 taxonomy 결과를 훑어보는 UI가 필요할 때는 `@qa-sdk/taxonomy-web`을 본다.
- 제품 기능 승격 여부를 판단할 때는 이 문서가 아니라 `package-surface-separation-rule`의 승격 기준을 따른다.

## 경계 규칙 ^constraint

- taxonomy capability는 reusable finite vocabulary와 변환 계약을 소유한다.
- concrete data lineage, row multiplier, DPM readiness, quality-ledger run 기록은 profile capability로 보낸다.
- browser preview는 consumer surface이며 vocabulary SSOT가 아니다.
- 새 taxonomy 패키지를 추가하면 먼저 `scripts/package-surfaces.mjs`에 하나의 taxonomy surface로 배정하고, `arch:surfaces`로 누락/중복을 확인한다.

## 검증 ^validation

```bash
corepack pnpm --filter taxonomy-engine test
corepack pnpm --filter taxonomy-decision-bridge test
corepack pnpm --filter @qa-sdk/taxonomy-web test
corepack pnpm arch:surfaces
corepack pnpm arch:verify
```
