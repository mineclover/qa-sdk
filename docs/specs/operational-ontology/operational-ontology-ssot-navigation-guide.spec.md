---
def:
  id: operational-ontology-ssot-navigation-guide
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, contract, cross-scope]
  links:
    - target: operational-ontology-system
      type: traces_to
    - target: operational-ontology-registry-lifecycle
      type: traces_to
    - target: registry-system
      type: traces_to
    - target: index-meta-system
      type: traces_to
---

# Operational Ontology SSOT Navigation Guide — schema/registry/address 경계 탐색

## 목적 ^purpose

operational ontology, registry-service, index-meta가 같은 좌표/주소 문제를 다른 책임으로 다루는 상황에서 어느 파일과 문서를 먼저 봐야 하는지 정의한다. 목표는 schema semantics, registry lifecycle, address decode/capacity, runtime observation store를 혼동하지 않고 정확한 SSOT에서 변경을 시작하게 만드는 것이다.

## 구성 ^overview

이 가이드는 네 가지 SSOT 경계를 분리한다.

- **Schema semantics SSOT** — axis/taxonomy/relation/traversal 의미와 validation
- **Registry lifecycle SSOT** — namespace, owner, prefix/version lifecycle, allocation activation
- **Address runtime SSOT** — prefix registry, schema version, entry, address decode/capacity
- **Observation/projection SSOT** — object/facet/observation/projection store

## 탐색 순서 ^defines

### 1. Operational ontology 의미를 바꿀 때

먼저 아래를 본다.

1. `docs/specs/operational-ontology/operational-ontology-system.spec.md`
2. `docs/specs/operational-ontology/operational-ontology-taxonomy-schema.spec.md`
3. `docs/specs/operational-ontology/operational-ontology-schema-validation.spec.md`
4. `packages/operational-ontology/src/internal/schema-core.ts`
5. `packages/operational-ontology/src/internal/ontology-allocation-core.ts`

판단 기준:

- axis 값, taxonomy identity, relation category, traversal purpose는 operational-ontology schema semantics다.
- registry-service DB table부터 바꾸면 안 된다.
- 먼저 schema validation과 allocation plan이 닫히는지 확인한다.

### 2. Ontology pack을 등록/승격할 때

먼저 아래를 본다.

1. `docs/specs/operational-ontology/operational-ontology-pack-interface.spec.md`
2. `docs/specs/operational-ontology/operational-ontology-registry-allocation.plan.md`
3. `packages/operational-ontology/src/internal/pack-core.ts`
4. `packages/operational-ontology/src/internal/ontology-allocation-core.ts`
5. `packages/registry-service/src/lib/registry-service.ts`

판단 기준:

- pack validation은 operational-ontology가 소유한다.
- namespace/allocation reservation은 registry-service가 소유한다.
- active allocation만 index-meta로 내려간다.

### 3. Prefix/version/address decode가 깨질 때

먼저 아래를 본다.

1. `docs/specs/index-meta-system/index-meta-system.md`
2. `packages/index-meta/src/prefix-registry.ts`
3. `packages/index-meta/src/schema-sync.ts`
4. `packages/index-meta/src/db/schema.ts`
5. `packages/index-meta/src/adapters/sql-store.ts`

판단 기준:

- 실제 address decode/capacity/entry lookup은 index-meta 책임이다.
- ontology allocation이 active가 되었는데 decode가 안 되면 `prefix_registry`, `schema_version`, `entry` sync를 확인한다.
- operational-ontology persistence store에서 address decode 문제를 고치면 안 된다.

### 4. Registry service의 owner/lifecycle이 문제일 때

먼저 아래를 본다.

1. `docs/specs/registry-system/registry-system.md`
2. `packages/registry-service/src/db/schema.ts`
3. `packages/registry-service/src/lib/registry-service.ts`
4. `packages/registry-service/src/stores/sql-prefix-owner-store.ts`
5. `packages/registry-service/src/stores/sql-axis-profile-store.ts`
6. `packages/registry-service/src/stores/sql-catalog-store.ts`

판단 기준:

- registry-service는 허브다.
- prefix owner, version lifecycle, catalog channel, ontology allocation lifecycle은 registry-service에 둔다.
- index-meta는 lifecycle 정책이 아니라 address mechanics를 맡는다.

### 5. Runtime observation/projection이 문제일 때

먼저 아래를 본다.

1. `docs/specs/operational-ontology/operational-ontology-persistence.spec.md`
2. `packages/operational-ontology/src/internal/persistence-core.ts`
3. `packages/operational-ontology/src/internal/persistence-memory.ts`
4. `packages/operational-ontology/src/internal/persistence-ingest.ts`
5. `packages/operational-ontology-web/src/main.ts`

판단 기준:

- object/facet/observation/projection은 runtime fact와 rebuildable view다.
- registry allocation state를 observation store에 넣지 않는다.
- store JSON은 운영 관측 결과이고, registry-service DB는 address allocation/lifecycle 권위다.

## 책임 매트릭스

| 질문 | 먼저 볼 SSOT |
|------|--------------|
| 이 axis/taxonomy가 유효한가? | `operational-ontology/src/internal/schema-core.ts` |
| 이 ontology pack이 등록 가능한가? | `operational-ontology/src/internal/pack-core.ts` |
| 이 taxonomy가 어떤 prefix/version을 점유하는가? | `operational-ontology/src/internal/ontology-allocation-core.ts`, 이후 registry-service allocation table |
| prefix/version/capacity는 어디서 decode되는가? | `index-meta/src/prefix-registry.ts`, `index-meta/src/db/schema.ts` |
| prefix owner와 lifecycle은 누가 관리하는가? | `registry-service/src/lib/registry-service.ts` |
| 런타임에서 관측된 topology는 어디에 있는가? | `operational-ontology/src/internal/persistence-*` |
| UI에서 store JSON을 어떻게 해석하는가? | `packages/operational-ontology-web`, `packages/viz-core/src/ontology-graph.ts` |

## 변경 규칙

1. schema semantics 변경은 operational-ontology에서 시작한다.
2. registry table 변경은 allocation plan이 먼저 있어야 한다.
3. index-meta 변경은 active allocation sync가 필요한 경우에만 한다.
4. runtime persistence 변경은 observation/projection 문제일 때만 한다.
5. registry-service prefix를 catalog scoped로 바꾸는 일은 별도 ADR 없이는 하지 않는다.

## 검증 명령

기능별 기본 검증은 아래를 따른다.

```bash
pnpm --filter operational-ontology test -- allocation
pnpm --filter operational-ontology typecheck
pnpm --filter operational-ontology build
pnpm --filter @qa-sdk/cli typecheck
node packages/cli/dist/index.js def validate
```

registry-service/index-meta 구현 단계로 넘어가면 해당 패키지의 store/service 테스트를 추가로 실행한다.
