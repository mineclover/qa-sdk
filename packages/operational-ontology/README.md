# operational-ontology

`operational-ontology`는 taxonomy를 먼저 schema로 선언하고 검증한 뒤, node, relation type, edge, traversal coordinate를 생성하는 schema-first 초안 라이브러리다. RDF의 node/predicate/triple/path를 operational coordinate로 읽고, category 제약과 schema validation으로 taxonomy drift와 relation type 조합 폭발을 막는 것을 목표로 한다.

현재 해석 우선순위는 `flow corridor`, `junction`, `checkpoint` 관점으로 데이터 통로와 관측을 일관되게 읽는 데 있다.

## 먼저 볼 문서

- [operational-ontology-system.spec.md](../../docs/specs/operational-ontology/operational-ontology-system.spec.md) — 패키지 목적과 전체 구조
- [operational-ontology-taxonomy-schema.spec.md](../../docs/specs/operational-ontology/operational-ontology-taxonomy-schema.spec.md) — axis/taxonomy schema plane 정의
- [operational-ontology-relation-category-schema.spec.md](../../docs/specs/operational-ontology/operational-ontology-relation-category-schema.spec.md) — relation type category schema 정의
- [operational-ontology-schema-validation.spec.md](../../docs/specs/operational-ontology/operational-ontology-schema-validation.spec.md) — schema validation plane 정의
- [operational-ontology-persistence.spec.md](../../docs/specs/operational-ontology/operational-ontology-persistence.spec.md) — facet bundle + append-only observation 저장 모델
- [operational-ontology-core-model.spec.md](../../docs/specs/operational-ontology/operational-ontology-core-model.spec.md) — NodeCoord, canonical identity, anchor 모델
- [operational-ontology-relation-taxonomy.spec.md](../../docs/specs/operational-ontology/operational-ontology-relation-taxonomy.spec.md) — relation type 자체를 taxonomy로 다루는 규칙
- [operational-ontology-edge-assertion.spec.md](../../docs/specs/operational-ontology/operational-ontology-edge-assertion.spec.md) — relation type이 특정 node pair에서 성립한 assertion 모델
- [operational-ontology-category-constraint.spec.md](../../docs/specs/operational-ontology/operational-ontology-category-constraint.spec.md) — category-constrained taxonomy 운영 규칙
- [operational-ontology-traversal-coordinate.spec.md](../../docs/specs/operational-ontology/operational-ontology-traversal-coordinate.spec.md) — start/end/edge chain을 좌표화하는 방식
- [operational-ontology-rdf-bridge.spec.md](../../docs/specs/operational-ontology/operational-ontology-rdf-bridge.spec.md) — RDF URI/triple/path를 operational coordinate로 읽는 규칙

## 패키지 역할

- `NodeCoord`로 정보의 canonical identity를 정의한다.
- `AxisSchema`, `TaxonomySchema`, `TraversalSchema`로 schema plane을 정의한다.
- `OperationalOntologySchemaRegistry`로 외부 schema catalog를 framework에 주입한다.
- `validateOperationalOntologySchema()`로 schema plane을 검증한다.
- `RelationTypeCoord`로 관계 유형 자체를 taxonomy 교차점으로 식별한다.
- `EdgeCoord`로 start/relationType/end assertion을 표현한다.
- `TraversalCoord`로 시작점, edge chain, 끝점, 목적을 route coordinate로 다룬다.
- `InformationFacetRef`, `SemanticTransmission`, `DataLineageLink`, `BranchDecision`, `ControlFlowGraph`로 현재 핵심 해석층을 표현한다.
- `OperationalOntologyRuntimePorts`로 `EventRecord`, `PipeGraph`, `DataSchema/FieldLineage`, `PathObservation` 입력을 받는 운영 포트를 정의한다.
- 기본 event adapter는 `EventRecord -> EventRecordProjectionResult`에서 transmission과 synthetic observed data flow를 함께 만들고, object payload의 top-level field를 data flow field로 분해한다.
- event projector의 `CheckpointObservation`은 최소 `corridorId`를 가지며, snapshot 합성 시 `junctionId`와 `traversalKey`까지 연결될 수 있다. 또한 payload/binding 기준의 `CheckpointLattice`를 함께 만들고, snapshot phase에서는 route decision checkpoint까지 추가될 수 있다. checkpoint template registry를 주입하면 lattice relation materialization과 observed field/prefix validation을 조절할 수 있다.
- 기본 adapter는 `PipeGraph (+ optional schemas/lineages) -> ControlFlowGraph + DataFlowDefinition + SemanticTransmission[] + DataLineageLink[] + BranchDefinition[]` baseline projection을 제공한다.
- corridor template registry를 주입하면 materialized corridor의 `templateDescription`과 `templateValidation`을 조절할 수 있다.
- junction template registry를 주입하면 `BranchDefinition`과 `RouteDecision`의 materialized metadata와 allowed mode/path shape validation을 조절할 수 있다.
- `projectOperationalOntologySnapshot()`으로 corridor, checkpoint, junction, traversal을 하나의 운영 결과로 합성할 수 있다.
- observation topology template registry를 주입하면 snapshot 전체의 corridor/junction/checkpoint/traversal 조합 검증을 조절할 수 있다.
- snapshot 결과의 `RouteDecision`은 `junctionId`, `corridorId`, `traversalKey`로 실제 corridor 위 판단을 가리킬 수 있다.
- observation topology template registry를 주입하면 snapshot 전체의 corridor/junction/checkpoint/traversal 배치 validation과 description을 조절할 수 있다. presence뿐 아니라 corridor 수, checkpoint lattice depth, route decision reference completeness 같은 layout rule도 제어할 수 있다.
- persistence는 schema store, registry store, assertion store, observation log, projection store로 분리해 설계한다.
- `OperationalOntologyObjectRecord`, `OperationalOntologyFacetRecord`, `OperationalOntologyObservationRecord`, `OperationalOntologyProjectionRecord`로 저장 표면을 정의한다.
- `REQUIRED_FACET_KINDS_BY_OBJECT_KIND`, `OPTIONAL_FACET_KINDS_BY_OBJECT_KIND`, `ALLOWED_FACET_KINDS_BY_OBJECT_KIND`로 object/facet 규칙을 고정한다.
- `validateFacetKindsForObjectKind()`로 required facet 누락, disallowed facet, duplicate facet을 함께 검증한다.
- `FACET_PAYLOAD_SHAPES_BY_OBJECT_KIND`와 `validateFacetPayloadShape()`로 object/facet별 payload_json 최소 shape를 검증한다.
- `InMemoryOperationalOntologySchemaRegistry`와 `InMemoryOperationalOntologyStore`로 실제 사용 가능한 최소 registry/store adapter를 제공한다.
- `persistOperationalOntologySnapshot()`와 `loadOperationalOntologySnapshot()`으로 runtime snapshot을 projection store에 저장/복원하고, 선택적으로 traversal object/facet/observation을 함께 materialize할 수 있다.
- `ingestOperationalOntologyProjection()`으로 projector 입력을 받아 snapshot 생성과 store 적재를 한 번에 수행할 수 있다.
- `listOperationalOntologySnapshotProjections()`와 `loadOperationalOntologySnapshotView()`로 저장된 snapshot과 하위 corridor/checkpoint-lattice/traversal bundle을 다시 읽을 수 있다.
- `ingestEventRecordProjection()`, `ingestPipeGraphProjection()`, `listOperationalOntologySnapshotViewsByScope()`, `loadLatestOperationalOntologySnapshotViewByScope()`로 더 좁은 service-style 진입점을 제공한다.
- `loadOperationalOntologyCorridors()`, `loadOperationalOntologyCheckpointLattices()`, `loadOperationalOntologyTraversalBundles()`와 scope 기반 `listOperationalOntologyCorridorsByScope()`, `listOperationalOntologyCheckpointLatticesByScope()`, `listOperationalOntologyTraversalBundlesByScope()`로 목적별 query DSL을 제공한다.
- `loadOperationalOntologyCorridorView()`, `listOperationalOntologyCorridorViewsByScope()`, `loadLatestOperationalOntologyCorridorViewByScope()`로 corridor 기준의 higher-level view도 직접 조회할 수 있다.
- `diffOperationalOntologySnapshots()`, `diffOperationalOntologyCorridor()`와 scope 기반 latest diff helper로 snapshot/corridor 변화 비교도 수행할 수 있다.
- `RelationCategorySchema`와 축 검증 헬퍼로 relation type category가 허용한 축만 조합되게 한다.
- category catalog는 패키지 내부에 고정하지 않고 외부 registry/resolver에서 주입받는다.

## Plane Facades

- `operationalOntologySchemaPlane` — schema validation
- `operationalOntologyLineagePlane` — lineage projection과 lineage skeleton 추론
- `operationalOntologyCorridorPlane` — corridor template와 corridor validation
- `operationalOntologyJunctionPlane` — junction template와 route decision 해석
- `operationalOntologyCheckpointPlane` — checkpoint template와 event observation 해석
- `operationalOntologyTopologyPlane` — snapshot 조합과 topology validation
- `operationalOntologyProjectors` — projector 모음
- `operationalOntologyPersistencePlane` — object/facet/payload 저장 계약 검증

## Subpath Imports

- `operational-ontology/schema`
- `operational-ontology/runtime`
- `operational-ontology/lineage`
- `operational-ontology/corridor`
- `operational-ontology/junction`
- `operational-ontology/checkpoint`
- `operational-ontology/topology`
- `operational-ontology/projectors`
- `operational-ontology/projectors/event`
- `operational-ontology/projectors/pipe`
- `operational-ontology/projectors/path`
- `operational-ontology/projectors/snapshot`
- `operational-ontology/persistence`

`operational-ontology/projectors`는 aggregate convenience layer이고, 실제 책임 경계는 event/pipe/path/snapshot subpath에 맞춘다.

## 코드 진입점

- `src/index.ts` — 얇은 composition root. internal core 재수출과 facade 조합만 담당
- `src/internal/schema-core.ts` — axis/taxonomy/relation/traversal schema와 검증
- `src/internal/schema-memory.ts` — in-memory schema registry adapter
- `src/internal/runtime-core.ts` — node/relation/edge/traversal/control-flow/runtime primitive
- `src/internal/lineage-core.ts` — lineage transform, lineage link, lineage canonical key helper
- `src/internal/corridor-core.ts` — corridor template, data flow type, corridor validation
- `src/internal/junction-core.ts` — junction template, branch/route decision type, junction validation
- `src/internal/checkpoint-core.ts` — checkpoint template, checkpoint lattice type, checkpoint validation/materialization
- `src/internal/topology-core.ts` — observation topology template와 snapshot topology validation
- `src/internal/projector-types.ts` — projector input/output/runtime port 계약
- `src/internal/projector-shared.ts` — projector 공통 helper
- `src/internal/event-projector.ts` — EventRecord projector 본체
- `src/internal/lineage-projector.ts` — lineage projector와 schema-aware lineage helper
- `src/internal/pipe-projector.ts` — PipeGraph projector 본체
- `src/internal/path-projector.ts` — path observation projector 본체
- `src/internal/snapshot-projector.ts` — snapshot orchestrator와 runtime port 조합
- `src/internal/projector-core.ts` — projector 계열 re-export aggregator
- `src/internal/persistence-core.ts` — object/facet/payload 저장 계약 검증
- `src/internal/persistence-memory.ts` — in-memory persistence store adapter
- `src/internal/persistence-snapshot.ts` — snapshot 저장/복원 helper
- `src/internal/persistence-ingest.ts` — projection input → snapshot → store ingest helper
- `src/internal/persistence-query.ts` — snapshot/corridor/checkpoint/traversal 조회 helper
- `src/internal/persistence-service.ts` — event/pipe ingest와 scope 기반 snapshot query service helper
- `src/internal/persistence-diff.ts` — snapshot/corridor diff helper
- `src/internal/projector-utils.ts` — projector 저수준 helper

## 실행

```bash
pnpm --filter operational-ontology build
pnpm --filter operational-ontology typecheck
```
