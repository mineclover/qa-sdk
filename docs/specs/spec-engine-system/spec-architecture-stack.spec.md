---
def:
  id: spec-architecture-stack
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  svc: spec-core
  tags: [entry-point]
  links:
    - target: spec-system-architecture
      type: refines
---

# Spec Architecture 스택

## 목적 ^purpose

spec-engine의 패키지 구성, DKG 타입 계층, skills, convergence, SDK/CLI/store 구조를 분리해 전체 스택 지도를 정리한다.

## 구성 ^overview

- `spec-core 패키지 구조`: shared/schema/spec/export-surface/loader/propagation/dkg/codegen/convergence/transition/store 모듈 맵을 정의한다.
- `GraphPort 3단 추상화`: GraphPort → GraphRegistryPort → GraphRegistry 의존성 역전 구조를 기술한다.
- `Schema Layer (L2)`: 6종 카테고리 + CATEGORY_RULES + Fragment 기반 구조 검증을 명시한다.
- `DKG Skills`: 분석/탐색/자동화 skill 계층과 convergence 파이프라인을 정리한다.
- `CLI/Store 실행 표면`: codegen, propagation, sqlite store가 제공하는 CLI 인터페이스를 기술한다.

## spec-core 패키지 구조

spec-core (packages/spec-core/src/)의 모듈 구성:

```
spec-core/src/
├── shared/          # Result, Error, GraphPort (의존성 역전)
├── schema/          # Layer 2: SchemaCategory, SchemaDef, CATEGORY_RULES, presets
├── spec/            # SpecDocument, SpecDocumentRegistry
├── export-surface/  # ExportSurface (prefix의 외부 공개 차원)
├── loader/          # catalog-bridge, spec-loader, catalog-merge
├── propagation/     # lifecycle, publish, catalog-writer, axis-version-builder
├── dkg/             # flow-definition, semantic-ref, dsl-bundle, service-topology, relational-instance, skills/
├── codegen/         # ts-generator, proto-generator, json-schema-generator, IR
├── convergence/     # capacity-optimizer, deployment-skew, pattern-classifier
├── transition/      # transition-engine, state-store, registry, pipeline, metrics, dkg-bridge, violation-bridge
├── visualization/   # mermaid-gen (12종 다이어그램), layer-map, monitor-queries
└── store/           # dkg-sqlite-store, dkg-schema.sql
```

의존 방향: shared ← schema ← spec ← loader ← propagation ← dkg. 역방향 import 금지.

## shared/ 유틸리티 상세

spec-core의 최하위 레이어. 외부 의존 없이 순수 TS로 구성되며, 상위 모든 모듈이 import한다.

### Result 타입 (`result.ts`)

명시적 성공/실패 표현. 예외 대신 값으로 에러를 전달한다.

```typescript
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
ok<T>(value: T): Result<T, never>
err<E>(error: E): Result<never, E>
```

### 에러 계층 (`errors.ts`)

`SpecError(code, message)` 기반 도메인 에러 4종:

| 에러 | code | 용도 |
|------|------|------|
| `SpecError` | (임의) | 기반 클래스 |
| `DuplicateRegistrationError` | `DUPLICATE_REGISTRATION` | 동일 kind+id 중복 등록 |
| `NotFoundError` | `NOT_FOUND` | kind+id 조회 실패 |
| `ValidationError` | `VALIDATION_ERROR` | 검증 실패. `details: ValidationErrorDetail[]` (layer 0/1/2, axis, rule, message) |

### Decision Scaffold (`decision-scaffold.ts`)

결정 유형별 alternatives와 reversalConditions를 자동 생성하는 템플릿 엔진.

`scaffoldDecision(input: ScaffoldInput) → DecisionNode`

지원 유형 6종:

| type | 자동 생성 내용 |
|------|--------------|
| `capacity` | 최소 확장/제안값/다음 2^n/2배 확장 대안 + 사용률 컨텍스트 |
| `new-axis` | 기존 축 재사용/table_ref/metadata 대안 |
| `new-prefix` | 기존 prefix 확장/별도 시스템 대안 |
| `dim-add` | 별도 prefix 분리/metadata 관리 대안 |
| `merge` | 병합/alias/constraint 대안 + 중복 entries 컨텍스트 |
| `deprecate` | 유지+비활성화/완전 제거 대안 |

`weighted-index`의 `isPowerOf2`, `nextPowerOf2`를 사용하여 capacity 관련 계산 수행.

### 복사본 드리프트 방지 (`copy-drift.test.ts`)

`@qa-sdk/convergence`는 독립 패키지이므로 `shared/`를 직접 import할 수 없다. 물리적 복사본을 유지하되, 이 테스트가 원본과 복사본의 구조적 동기화를 검증한다.

검증 대상:
- `GraphPort` 인터페이스 메서드 시그니처 (spec-core ↔ convergence)
- `scaffoldDecision` export 함수 시그니처 (spec-core ↔ convergence)
- `DecisionNode`/`ObservationNode`/`ConstraintNode` DKG 타입 존재 여부 (convergence의 dkg-types.ts)

`shared/graph-port.ts` 또는 `shared/decision-scaffold.ts` 변경 시 `convergence/` 동명 파일도 반드시 동기화해야 한다.

## GraphPort 3단 추상화

spec-core/src/shared/graph-port.ts에 정의된 DKG 그래프의 의존성 역전 구조:

| 계층 | 인터페이스 | 사용자 | 반환 타입 |
|------|-----------|--------|-----------|
| GraphPort (shared/) | convergence/schema 레이어 | GraphNodeLike (kind+id만) |
| GraphRegistryPort | 서비스(ingest/registry) 동적 import | 최소 2메서드 |
| GraphRegistry (dkg/) | CLI/skills 직접 사용 | DkgNode 16종 구체 타입 |

GraphPort는 DkgNode를 import하지 않는다. convergence 함수들은 kind/id만으로 그래프를 질의한다.

GraphPort 인터페이스 메서드:

- **노드 읽기**: `getNode(id)`, `getNodeOrThrow(id)`, `getNodesByKind(kind)`, `getAllNodes()`, `findNodes(kind, predicate?)`
- **엣지 읽기**: `edgesFrom(id, type?)`, `edgesTo(id, type?)`, `neighbors(id, type)`
- **복합 질의**: `intentLinksFor(targetId)`, `cascadeFromAxis(axisId)`, `cascadeFromPrefix(prefixId)`, `activeConstraints(targetId)`, `getPrefixesByCategory(category)`, `groupPrefixesByCategory()`
- **통계**: `nodeCount`, `edgeCount` (readonly)
- **쓰기**: `addNode(node)`, `addEdge(type, from, to, meta?)`

보조 타입: `GraphNodeLike { kind, id }`, `GraphEdgeLike { type, from, to, meta? }`, `PrefixLike { kind: "prefix", id, dimLabels, category? }`.

## Schema Layer (L2)

6종 SchemaCategory (entity/event/relation/state/policy/observation) 기반 구조 검증:

- **CATEGORY_RULES**: 카테고리별 requiredDimKinds, requiredRefs, minDims, maxDims, validate 함수
- **presets.ts**: 6종 base schema (event.base, entity.base 등) + 4종 Fragment (HasActor, HasTarget, HasOutcome, Identified)
- **SchemaValidator**: SchemaDef + SchemaRegistry에서 스키마 유효성 검증
- **schema-validation-codec.ts**: 검증 에러를 좌표(ValidationCoordinate)로 인코딩 (관측 체계와 연결)

`validateAllCategories(graph)` → 모든 prefix의 카테고리 규칙 준수를 일괄 검증하여 total/passed/failed 보고.

## DKG Skills

dkg/skills/ 디렉토리의 자동화 skill 목록:

| Skill | 역할 |
|-------|------|
| version-event-derive | diff 정보에서 VersionEvent 자동 생성 |
| infer-migrator | 버전 간 마이그레이션 추론 |
| decision-scaffold | DecisionNode 자동 생성 |
| domain-health | 도메인별 건전성 분석 |
| analyze-impact | 축/prefix 변경의 영향 범위 분석 |
| safe-entry-add | entry 추가 시 capacity 안전성 검증 |
| claim-operation | prefix claim 연산 |
| service-explorer | 서비스별 prefix 탐색 |
| converge-chain | convergence 체인 실행 |
| coverage-audit | 테스트 커버리지 감사 |

convergence 파이프라인: capacity-optimizer, deployment-skew, pattern-classifier, observation-lifecycle, ref-entries-sync, self-check-analyzer.

## CLI/Store 실행 표면

- **codegen**: `cli/src/commands/codegen.ts` → ts-generator, proto-generator, catalog-typescript로 타입 코드 생성
- **propagation**: lifecycle.ts의 seal/activateAndPropagate → catalog-writer, axis-version-builder로 카탈로그 업데이트
- **store**: dkg-sqlite-store.ts → SQLite 기반 DKG 영속 (dkg-schema.sql.ts에서 DDL 정의)
- **transition**: transition-engine (7단계 파이프라인) + TransitionRegistry + StateStore(InMemory/SQLite) + 2단계 검증(구조/카탈로그) + DKG bridge + violation → observation 변환 + convergence pipeline 통합 + metric 3종 (coverage/violation-rate/orphan-sequences)
- **visualization**: mermaid-gen (12종 다이어그램: IntentLink, DSL, Domain, Service, Constraint, Table, TableER, ObservationLoop, TransitionSpec, TransitionDAG, Trace, Signal) + layer-map (레이어 배치, 프로젝션, trace path) + monitor-queries (MonitorState 비동기 생성)

상세 문서: `analysis-transition.spec.md` (transition), `mermaid-gen.spec.md` (visualization)
