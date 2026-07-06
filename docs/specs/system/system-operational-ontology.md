---
def:
  id: system-operational-ontology
  tier: layout
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: domain
  tags: [ontology, operational, structural, entry-point]
  links:
    - target: operational-ontology-system
      type: refs
    - target: operational-ontology-package-architecture
      type: refs
    - target: package-surface-separation-rule
      type: refs
    - target: system-packages
      type: refs
  sources:
    - scripts/package-surfaces.mjs
    - scripts/report-package-surfaces.mjs
    - packages/operational-ontology/package.json
    - packages/operational-ontology/src/index.ts
    - packages/operational-ontology/src/schema.ts
    - packages/operational-ontology/src/runtime.ts
    - packages/operational-ontology/src/projectors.ts
    - packages/operational-ontology/src/programming-artifacts.ts
    - packages/operational-ontology/src/pack.test.ts
    - packages/operational-ontology/src/programming-artifacts.test.ts
    - packages/operational-ontology-web/package.json
    - packages/operational-ontology-web/src/main.ts
    - packages/operational-ontology-web/scripts/static-smoke.mjs
---

# Operational Ontology Capability

## 목적 ^purpose

operational ontology runtime, pack projection, programming artifact registry, store visualization을 다루는 기능군의 operator entry다. 이 문서는 operational ontology capability를 decision recording이나 generic product demo surface와 섞지 않고, 실제 운영자가 어느 패키지를 보면 되는지 먼저 가리킨다.

## 구성 ^overview

| Surface id | 패키지 | 실제 usecase | 소유하지 않는 것 |
|------------|--------|--------------|------------------|
| `operational-ontology-runtime` | `operational-ontology` | schema validation, pack facade, runtime/projector ports, programming artifact registry/provider, persistence snapshot tests | decision-flow instance lifecycle, taxonomy vocabulary SSOT, generic product demo ownership |
| `operational-ontology-preview-surfaces` | `@qa-sdk/operational-ontology-web` | operational ontology store JSON 업로드, sample store 탐색, graph/record inspector static smoke | ontology schema 작성, registry persistence, pack validation rule ownership |

## 사용 경로 ^method

- ontology schema, pack facade, projector, programming artifact registry를 고칠 때는 `operational-ontology`를 본다.
- 사람이 store JSON이나 projection 결과를 확인해야 할 때는 `@qa-sdk/operational-ontology-web`을 consumer preview로 사용한다.
- 판단 기록의 lifecycle이나 escalation semantics는 `decision-flow`/DKG 쪽에 남기고, operational ontology runtime이 흡수하지 않는다.
- taxonomy vocabulary 원본은 taxonomy capability가 소유한다. operational ontology는 approved schema와 pack projection을 소비하거나 검증한다.

## 경계 규칙 ^constraint

- `operational-ontology-runtime`은 runtime/projector/pack/persistence boundary를 소유하지만, 제품 demo나 decision recording surface의 대표 패키지가 아니다.
- `operational-ontology-preview-surfaces`는 read-only consumer다. store를 읽고 시각화할 수 있지만 ontology object나 registry record의 SSOT가 되면 안 된다.
- 새 operational ontology 패키지를 추가하면 먼저 `scripts/package-surfaces.mjs`의 operational ontology capability surface 중 하나에 배정하고, consumer smoke가 생기기 전까지 product demo로 승격하지 않는다.

## 검증 ^validation

```bash
corepack pnpm --filter operational-ontology test
corepack pnpm --filter @qa-sdk/operational-ontology-web test
corepack pnpm arch:surfaces
corepack pnpm arch:verify
```
