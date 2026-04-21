---
def:
  id: pipe-static-lineage
  type: design
  tier: system
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: pipe-transition-scope
      type: contains
    - target: pipe-fold-lineage
      type: contains
    - target: pipe-graph-lineage-precision
      type: contains
    - target: pipe-reduce-lineage
      type: contains
    - target: test-name-tokens
      type: contains
    - target: pipe-static-lineage-test
      type: contains
    - target: meta-semantic-system
      type: depends_on
---

# 정적 계보 추적 — PipeFlow에서 데이터 계보 파생

## 목적 ^purpose

PipeFlow 정의만으로 "어떤 데이터가 어떤 데이터를 만드는 데 필요했는가"를 추적한다.
원본 값이 아니라 계보 그래프만 다루므로 folding 시 압축 가능.

## ^overview

두 경로로 계보 파생:
- **정적**: `deriveStaticLineage(flow)` — PipeFlow 구조만으로
- **시뮬**: `extractLineageFromSimulation(result, pipes)` — 실행 결과에서

양쪽 동일 `resolveStepSchemaId` 사용 → schemaId drift 불가.

## ^defines

### 공개 API (12개)

| 함수 | 역할 | 위치 |
|------|------|------|
| `deriveStaticLineage(flow, pipeId)` | PipeFlow → FieldLineage[] | pipe-lineage.ts |
| `summarizeFlowLineage(flow, pipeId)` | flow 입출력 계보 요약 | pipe-lineage.ts |
| `findFieldOrigin(flow, fieldName)` | 단일 필드 최종 입력 역추적 | pipe-lineage.ts |
| `deriveGraphLineage(graph)` | PipeGraph cross-pipe 계보 (facetType 필터 지원) | pipe-lineage.ts |
| `summarizeGraphLineage(graph)` | graph 전체 입출력 압축 (entry→exit) | pipe-lineage.ts |
| `findFieldOriginInGraph(graph, pipeId, field)` | cross-pipe 역추적 | pipe-lineage.ts |
| `validateStaticLineage(pipe, registry)` | data-object 바인딩 검증 | pipe-lineage.ts |
| `validateLineageChainDetailed(lineages, reg)` | 상세 chain 검증 (issues 포함) | data-object/validate.ts |
| `lineageId(lineage)` | 안정 키 | pipe-lineage.ts |
| `diffLineage(prev, next)` | 버전 간 diff | pipe-lineage.ts |
| `serializeLineage` / `deserializeLineage` | JSON 영속화 | pipe-lineage.ts |

### reduce accumulator 계보

- `walkLineage`에서 reduce 전용 처리: step 내부 계보 + accumulate 패턴 (transform: "aggregate")
- consumes+produces에 같은 필드 = accumulator 패턴

### fold 시 계보 통합

- `FoldedContract.lineageSummary?: FlowLineageSummary` — 접힌 구간의 입출력 압축
- `computeFoldedContract`에서 각 pipe의 `summarizeFlowLineage` 결과를 합산

### 핵심 설계 결정

- `lineageHints` 선택적 — 없으면 chain에서 이름 매칭 추론
- step-internal 이름 매칭 제거 (self-reference BFS 방지) — chain에서만 처리
- `traceOriginsStatic` schemaId 복합키 BFS — 컬럼명 충돌 방지
- 시뮬 경로 cross-pipe chain 유지 (실행 순서 기반)
- reduce accumulator = consumes+produces 같은 필드 → transform: "aggregate"
- graph cross-pipe: facetType 있으면 해당 필드만 연결, 없으면 이름 매칭
- fold lineageSummary: 각 pipe 계보 합산 (inputs 합집합, outputs 합집합, outputLineage 병합)

## ^delegates

| 하위 스펙 | 내용 |
|-----------|------|
| `pipe-fold-lineage` | fold 압축 시 계보 통합 |
| `pipe-graph-lineage-precision` | facetType/PortRef 기반 정밀 cross-pipe 연결 |
| `pipe-reduce-lineage` | reduce accumulator 계보 표현 |
| `pipe-static-lineage-test` | 정적/시뮬/graph 계보 검증 시나리오 |

## ^consumes

- `PipeFlow`, `PipeGraph`, `StepDataContract`, `LineageHint` (pipe-spec.ts)
- `FieldLineage`, `TransformKind` (data-schema.ts)
- `BindingRegistry`, `validateLineageChain` (data-object)
- `resolveStepSchemaId` (pipe-schema-id.ts)
- `getChildFlows` (pipe-flow-utils.ts)

## 테스트 패싯 매핑

| 소스 모듈 | 테스트 파일 | 건수 |
|-----------|-----------|------|
| `pipe-lineage.ts` | `pipe-lineage.test.ts` | 43 |
| `pipe-lineage.ts` ↔ `pipe-bridge.ts` | `pipe-lineage-consistency.test.ts` | 5 |
| `pipe-schema-id.ts` | `pipe-schema-id.test.ts` | 7 |
| `pipe-flow-utils.ts` | `pipe-flow-utils.test.ts` | 19 |
| `test-name.ts` | `test-name.test.ts` | 5 |
| `test-tokens.ts` | `test-tokens.test.ts` | 7 |
| **합계** | | **86** |
