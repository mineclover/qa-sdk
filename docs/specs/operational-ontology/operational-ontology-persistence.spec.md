---
def:
  id: operational-ontology-persistence
  type: knowledge
  knowledge_kind: concept
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural, persistence]
  links:
    - target: operational-ontology-taxonomy-schema
      type: depends_on
    - target: operational-ontology-schema-validation
      type: depends_on
    - target: operational-ontology-core-model
      type: depends_on
    - target: operational-ontology-edge-assertion
      type: depends_on
    - target: operational-ontology-traversal-coordinate
      type: depends_on
    - target: address-context-storage
      type: refines
---

# Operational Ontology Persistence — facet bundle + append-only observation 저장 모델

## 목적 ^purpose

`operational-ontology`가 정의하고 관측하는 정보를 어떤 저장 모델로 보존할지 정의한다. 목표는 schema, registry, assertion, observation을 서로 다른 책임으로 분리하고, 각 객체를 facet bundle로 저장하되 raw observation과 schema snapshot을 SSOT로 유지하며 graph/path/search projection은 재생성 가능하게 만드는 것이다.

## 구성 ^overview

저장 모델은 4개의 저장 영역과 1개의 projection 영역으로 구성된다.

- **schema store** — AxisSchema, TaxonomySchema, RelationCategorySchema, TraversalSchema snapshot
- **registry store** — 승인된 schema에서 파생된 canonical node/relation type/traversal registry
- **assertion store** — edge fact 저장
- **observation log** — node/edge/traversal hit와 drift를 append-only로 기록
- **projection store** — graph view, search index, traversal cache, embedding 같은 재생성 가능한 파생 뷰

객체 하나를 테이블 하나에 강하게 정규화하는 대신, **base object + facet bundle** 구조를 기본 저장 단위로 삼는다.

현재 패키지는 이 저장 계약을 실제로 써볼 수 있도록 최소 구현으로 `InMemoryOperationalOntologyStore`를 제공한다. 이 adapter는 object/facet/observation/projection을 메모리에 저장하면서 facet kind 규칙과 payload shape 규칙을 저장 시점에 강제한다.

또한 `persistOperationalOntologySnapshot()`와 `loadOperationalOntologySnapshot()` helper를 제공하여, runtime snapshot을 projection store에 저장/복원하고 필요하면 traversal object/facet/observation까지 함께 materialize할 수 있게 한다.

그 위에 `ingestOperationalOntologyProjection()` helper를 제공하여, projector 입력을 받아 snapshot 생성과 store 적재를 한 번에 수행할 수 있게 한다.

마지막으로 `listOperationalOntologySnapshotProjections()`와 `loadOperationalOntologySnapshotView()` helper를 제공하여, 저장된 snapshot projection과 하위 corridor/control-flow/checkpoint-lattice/junction/route-decision/traversal bundle을 queryable view로 다시 읽을 수 있게 한다.

그 위에 `ingestEventRecordProjection()`, `ingestPipeGraphProjection()`, `listOperationalOntologySnapshotViewsByScope()`, `loadLatestOperationalOntologySnapshotViewByScope()` 같은 service-style helper를 제공하여, 더 좁은 진입점에서 ingest와 조회를 수행할 수 있게 한다.

또한 `loadOperationalOntologyCorridors()`, `loadOperationalOntologyCheckpointLattices()`, `loadOperationalOntologyTraversalBundles()`와 scope 기반 `listOperationalOntologyCorridorsByScope()`, `listOperationalOntologyCheckpointLatticesByScope()`, `listOperationalOntologyTraversalBundlesByScope()`를 제공하여, snapshot view 전체 대신 corridor/checkpoint/traversal 단위로 직접 조회할 수 있게 한다.

그 위에 `loadOperationalOntologyCorridorView()`, `listOperationalOntologyCorridorViewsByScope()`, `loadLatestOperationalOntologyCorridorViewByScope()`를 제공하여, 특정 corridor를 중심으로 control-flow/checkpoint-lattice/junction/route-decision/traversal bundle을 묶은 higher-level view를 직접 조회할 수 있게 한다.

## 정의 ^defines

### facet bundle 저장 원칙

각 저장 객체는 최소한 아래 두 층을 가진다.

1. **base object**
   - `object_id`
   - `object_kind`
   - `canonical_key`
   - `schema_version`
   - `lifecycle`
2. **facets**
   - `facet_kind`
   - `payload_json`
   - `version`
   - `source_ref`
   - `recorded_at`

이 구조를 쓰면 schema가 변하는 동안에도 facet을 독립적으로 확장할 수 있고, 초기 설계 단계에서 과도한 정규화로 구조를 얼리지 않을 수 있다.

### object kind

초기 object kind는 다음을 기준으로 잡는다.

- `axis_schema`
- `taxonomy_schema`
- `relation_category_schema`
- `traversal_schema`
- `node`
- `relation_type`
- `edge`
- `traversal`

### facet kind

초기 facet kind는 다음을 기준으로 잡는다.

- `identity`
- `schema`
- `validation`
- `semantic`
- `grammar`
- `assertion`
- `status`
- `route`
- `evidence`
- `aggregate`
- `projection_meta`

facet kind는 object kind에 따라 허용 조합이 달라질 수 있다.

### object kind × facet kind 허용 매트릭스

초기 허용 조합은 아래를 기본값으로 둔다.

| object kind | 허용 facet kind | 비고 |
|---|---|---|
| `axis_schema` | `schema`, `validation` | axis 선언과 검증 결과 |
| `taxonomy_schema` | `schema`, `validation` | taxonomy 선언과 검증 결과 |
| `relation_category_schema` | `schema`, `grammar`, `validation` | category grammar와 검증 결과 |
| `traversal_schema` | `schema`, `route`, `validation` | purpose별 route family 규칙 |
| `node` | `identity`, `semantic`, `status`, `projection_meta` | canonical identity와 분류/파생 메타 |
| `relation_type` | `identity`, `grammar`, `semantic`, `status`, `projection_meta` | relation type vocabulary와 파생 메타 |
| `edge` | `assertion`, `status`, `evidence`, `projection_meta` | graph fact와 provenance |
| `traversal` | `route`, `aggregate`, `evidence`, `status`, `projection_meta` | canonical traversal family 또는 관측 요약 |

여기서 `projection_meta`는 projection store 전체를 대체하는 것이 아니라, 특정 객체에 붙는 경량 파생 메타데이터만 허용한다. 대형 graph view, traversal cache, embedding 결과는 여전히 `oo_projection`에 둔다.

### object kind × required/optional facet 규칙

허용 facet 중 일부는 **required**, 나머지는 **optional**이다.

| object kind | required facet | optional facet |
|---|---|---|
| `axis_schema` | `schema`, `validation` | — |
| `taxonomy_schema` | `schema`, `validation` | — |
| `relation_category_schema` | `schema`, `grammar`, `validation` | — |
| `traversal_schema` | `schema`, `route`, `validation` | — |
| `node` | `identity` | `semantic`, `status`, `projection_meta` |
| `relation_type` | `identity`, `grammar` | `semantic`, `status`, `projection_meta` |
| `edge` | `assertion` | `status`, `evidence`, `projection_meta` |
| `traversal` | `route` | `aggregate`, `evidence`, `status`, `projection_meta` |

원칙:

1. required facet이 없으면 해당 object는 저장상 완결되지 않은 것으로 본다.
2. optional facet은 후속 enrichment나 projection 단계에서 추가될 수 있다.
3. required facet을 projection store로 대체하면 안 된다.
4. 동일 object kind에 같은 facet을 중복 저장할 때는 version이나 source가 다르다는 근거가 있어야 한다.

### object kind × facet payload shape 규칙

facet의 존재만으로는 충분하지 않다. `payload_json`의 shape도 object kind와 facet kind의 조합으로 결정되어야 한다.

| object kind | facet kind | payload shape 초안 |
|---|---|---|
| `axis_schema` | `schema` | `{ axis: AxisSchema }` |
| `axis_schema` | `validation` | `{ valid, issues, validatorVersion? }` |
| `taxonomy_schema` | `schema` | `{ taxonomy: TaxonomySchema }` |
| `taxonomy_schema` | `validation` | `{ valid, issues, validatorVersion? }` |
| `relation_category_schema` | `schema` | `{ relationCategory: RelationCategorySchema }` |
| `relation_category_schema` | `grammar` | `{ relationCategory: RelationCategorySchema, normalizedAxes? }` |
| `relation_category_schema` | `validation` | `{ valid, issues, validatorVersion? }` |
| `traversal_schema` | `schema` | `{ traversal: TraversalSchema }` |
| `traversal_schema` | `route` | `{ purpose, canonicalizable?, allowedRelationCategories?, allowedEdgeKinds? }` |
| `traversal_schema` | `validation` | `{ valid, issues, validatorVersion? }` |
| `node` | `identity` | `{ realm, space, anchor, canonicalKey }` |
| `node` | `semantic` | `{ summary, labels?, taxonomyRefs? }` |
| `node` | `status` | `{ state, reason?, validFrom?, validTo? }` |
| `node` | `projection_meta` | `{ projectionRefs, lastProjectedAt? }` |
| `relation_type` | `identity` | `{ category, canonicalKey }` |
| `relation_type` | `grammar` | `{ relationCategory: RelationCategorySchema, normalizedAxes }` |
| `relation_type` | `semantic` | `{ summary, labels?, effect? }` |
| `relation_type` | `status` | `{ state, reason?, validFrom?, validTo? }` |
| `relation_type` | `projection_meta` | `{ projectionRefs, lastProjectedAt? }` |
| `edge` | `assertion` | `{ start, relationType, end, assertedAt?, sourceProvenance? }` |
| `edge` | `status` | `{ state, reason?, validFrom?, validTo? }` |
| `edge` | `evidence` | `{ evidenceRefs, confidence?, sourceKind? }` |
| `edge` | `projection_meta` | `{ projectionRefs, lastProjectedAt? }` |
| `traversal` | `route` | `{ purpose, start, edges, end, canonicalizable? }` |
| `traversal` | `aggregate` | `{ observationCount, lastObservedAt?, reachability? }` |
| `traversal` | `evidence` | `{ evidenceRefs, confidence?, sourceKind? }` |
| `traversal` | `status` | `{ state, reason?, validFrom?, validTo? }` |
| `traversal` | `projection_meta` | `{ projectionRefs, lastProjectedAt? }` |

원칙:

1. payload shape는 object kind와 facet kind의 곱으로 결정된다.
2. 같은 facet kind라도 object kind가 다르면 payload shape가 달라질 수 있다.
3. payload shape 검증은 top-level required key 존재 여부부터 시작하고, 필요하면 이후 세부 schema validation으로 확장한다.
4. payload shape가 맞지 않으면 facet 존재 여부와 무관하게 invalid persistence로 본다.

## 저장 계층

### 1. schema store

schema store는 immutable snapshot 중심이다.

- schema 생성/갱신 시 snapshot 단위로 저장
- validation result를 함께 저장
- 이후 runtime registry는 승인된 snapshot만 소비

SSOT:
- schema JSON
- schema validation result

### 2. registry store

registry store는 현재 승인된 schema에서 파생된 canonical identity lookup 용도다.

저장 대상:
- node registry
- relation type registry
- canonical traversal family registry

규칙:
- registry는 source of truth가 아니라 승인된 schema의 projection이다
- schema 변경 시 registry는 재계산 가능해야 한다

### 3. assertion store

assertion store는 edge fact를 저장한다.

저장 대상:
- `start`
- `relation_type`
- `end`
- assertion lifecycle
- source provenance

규칙:
- relation type vocabulary와 edge fact를 분리한다
- 동일한 relation type이 여러 edge에서 재사용될 수 있다
- edge store는 graph query의 canonical source가 된다

### 4. observation log

observation log는 append-only 원칙을 따른다.

저장 대상:
- node observed
- edge activated
- traversal observed
- schema drift detected
- validation warning emitted

규칙:
- raw context를 보존한다
- observation은 수정보다 append를 우선한다
- 집계/요약은 observation log가 아니라 projection에서 계산한다

이 영역은 `address_context`가 EventRecord의 canonical source인 방식과 같은 철학을 따른다. 관측 시점의 원본 의미를 먼저 보존하고, 조회 편의 구조는 나중에 파생한다. [address-context-storage.spec.md](/Users/junwoobang/workflow/qa-sdk/docs/specs/apm-system/apm-schema-system/address-context-storage.spec.md#L17)

### 5. projection store

projection store는 재생성 가능한 파생 뷰만 둔다.

예시:
- adjacency view
- traversal cache
- impact index
- search index
- embedding/materialized view

규칙:
- projection은 SSOT가 아니다
- raw schema / raw registry / raw observation에서 다시 만들 수 있어야 한다
- projection failure가 canonical data를 손상시키면 안 된다

## 논리 스키마 초안

논리적으로는 아래 구조를 권장한다.

### `oo_object`

- `object_id`
- `object_kind`
- `canonical_key`
- `schema_version`
- `lifecycle`
- `created_at`
- `updated_at`

### `oo_object_facet`

- `object_id`
- `facet_kind`
- `version`
- `payload_json`
- `source_ref`
- `recorded_at`

### `oo_observation_log`

- `observation_id`
- `target_object_id`
- `observation_kind`
- `raw_context`
- `payload_json`
- `observed_at`

### `oo_projection`

- `projection_id`
- `projection_kind`
- `target_scope`
- `payload_json`
- `built_from`
- `built_at`

이 스키마는 물리 테이블 확정안이 아니라 logical contract다. 실제 backend는 memory/d1/pg/clickhouse 중 무엇이든 될 수 있다.

## 불변식 ^constraint

1. schema snapshot은 mutable row보다 versioned snapshot을 우선한다.
2. raw observation은 append-only여야 한다.
3. canonical registry는 schema를 거치지 않고 직접 수정하지 않는다.
4. projection은 언제든 재생성 가능해야 한다.
5. 모든 traversal을 저장하지 않는다. canonical traversal family만 registry에 저장하고, ad-hoc traversal은 projection 또는 observation으로만 남긴다.
6. object kind별 허용 facet kind 매트릭스를 벗어나는 조합은 validation warning이 아니라 schema error로 취급한다.
7. object kind별 required facet이 누락된 상태는 partial persistence가 아니라 invalid persistence로 취급한다.
8. object kind × facet kind에 맞지 않는 payload shape는 persistence validation error로 취급한다.

## 시사점

- 내부 안정화 단계에서는 JSONB/Map 중심이 적합하다.
- object/facet 모델을 먼저 고정하고, hot path만 나중에 typed table로 승격하는 것이 안전하다.
- RDF triple store 하나로 전부 해결하려 하지 말고, schema/registry/assertion/observation 책임을 분리해야 drift와 query cost를 동시에 제어할 수 있다.
