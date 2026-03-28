---
def:
  id: mermaid-gen-spec
  address: def_document:v1:9
  scope: ui
  aspect: component
  depth: specification
  lifecycle: approved
  layer: experience
  svc: platform-demo
  tags: [tier-system, observability]
  links:
    - target: dkg-node-types
      type: depends_on
    - target: dkg-service-topology
      type: depends_on
---
# Mermaid 다이어그램 생성 (mermaid-gen)

## 목적 ^purpose

DKG 그래프에서 Mermaid 텍스트를 생성하는 순수 함수 모듈. I/O 없음. CLI에서 파일 저장 + mmdc 렌더링을 담당한다.

## 구성 ^overview

12종의 다이어그램 생성 함수와 1개의 카탈로그 함수를 제공한다. 모두 GraphRegistry를 입력으로 받아 Mermaid 텍스트 문자열을 반환한다.

- **IntentLink 계열**: 단일/전체 IntentLink의 endpoint 흐름 (sequenceDiagram)
- **DSL 계열**: DSL 번들 멤버 prefix 흐름 (sequenceDiagram)
- **Domain/Service**: 도메인 소속 prefix, 서비스 소유/소비 관계 (sequenceDiagram)
- **Constraint**: 제약 조건의 대상 노드 관계 (sequenceDiagram)
- **Table 계열**: 단일 테이블 ER, 전체 테이블 ER (erDiagram)
- **Observation Loop**: observation → decision 피드백 루프 (sequenceDiagram)
- **Transition 계열**: 단일 전이 spec 흐름, 전체 전이 DAG (sequenceDiagram + graph TD)
- **Trace**: 서비스 간 이벤트 흐름 추적 (sequenceDiagram)
- **listAllDiagrams**: 사용 가능한 모든 다이어그램 목록 반환

---

## 1. IntentLink 다이어그램

### intentLinkDiagram(graph, intentLinkId, options?)

단일 IntentLink의 endpoint 흐름을 sequenceDiagram으로 생성한다.

- participants: IntentLink의 endpoints
- 순차 화살표: endpoint[0] → endpoint[1] → ... → endpoint[N]
- via annotation: `note over` 로 IntentLink.via 표시
- invariant note: `showInvariants !== false`일 때 표시 (기본 true)

### allIntentLinksDiagram(graph, options?)

전체 IntentLink를 하나의 sequenceDiagram으로 통합한다. 각 IntentLink를 `rect` 블록으로 구분.

## 2. DSL 다이어그램

### dslDiagram(graph, dslId, options?)

DSL 번들의 멤버 prefix 흐름을 sequenceDiagram으로 생성한다.

- participants: DslBundleNode.memberPrefixes 순서
- fixedDims annotation: 바인딩된 차원 목록
- 순차 화살표: memberPrefixes 순서
- invariant notes: 번들의 invariants 표시

## 3. Signal 다이어그램

### signalDiagram(signalDefs, signalId, options?)

Signal requires 체인을 sequenceDiagram으로 생성한다. Actor → 첫 멤버 → 연쇄 흐름. fixedValues가 있으면 화살표 라벨에 표시.

## 4. Domain 다이어그램

### domainDiagram(graph, domainId, options?)

도메인 소속 prefix를 sequenceDiagram으로 생성한다.

- participants: DomainNode.prefixes (category 라벨 포함)
- sharedAxes annotation
- boundary annotation: exports + internal
- constraint notes: 각 prefix에 적용되는 제약 조건 표시

## 5. Service 다이어그램

### serviceDiagram(graph, topo, serviceId, options?)

서비스의 prefix 소유/소비 관계를 sequenceDiagram으로 생성한다.

- 서비스를 actor로 표시
- owned prefixes → `owns` 화살표 (녹색 rect 내부)
- consumer services → `consumes` 화살표

ServiceTopologyLike duck type 인터페이스 사용 (service-topology.ts 직접 의존 없음).

## 6. Constraint 다이어그램

### constraintDiagram(graph, constraintId, options?)

constraint의 대상 노드를 sequenceDiagram으로 생성한다. rule/formal 표시, constrains 엣지로 대상 연결.

## 7. Table 다이어그램

### tableDiagram(graph, tableId, options?)

단일 테이블의 FK/prefix 참조를 erDiagram으로 생성한다. 컬럼별 타입(FK, axis, ref, scalar) 표시. 역방향 FK도 포함.

### tableErDiagram(graph, options?)

전체 테이블 ER 다이어그램. 모든 테이블 + FK 관계. `ddlStatus` 옵션으로 배포 상태(deployed/catalog-only/ddl-only) 태그.

**Mermaid 예약어 처리**: `safeId()` 함수가 entry, order, group 등의 예약어에 `tbl_` 접두사를 추가한다. (향후 schema-builder dialect로 이관 예정)

## 8. Observation Loop 다이어그램

### observationLoopDiagram(graph, options?)

observation → decision 피드백 루프를 sequenceDiagram으로 생성한다. 날짜순 정렬, subject 연결 표시.

## 9. TransitionSpec 다이어그램

### transitionSpecDiagram(graph, specId, options?)

단일 TransitionSpec의 4단계 흐름을 sequenceDiagram으로 생성한다:

1. **Event Match** (파란 rect) — matchAxes 표시
2. **State Check** (주황 rect) — inputAxes 표시
3. **State Mutate** (녹색 rect) — outputAxes 표시
4. **Effect** — effectKind 주석

depends-on/satisfies 관계도 note로 표시.

### transitionDagDiagram(graph, options?)

전체 TransitionSpec 간 관계 DAG를 `graph TD`로 생성한다.

- 노드: `transition\neffectKind | matchMode(coordinateCount)` 형식
- depends-on 엣지: sharedAxes 라벨
- satisfies 엣지: DSL 연결 (점선)
- effect별 색상: create(녹), close(분홍), open(파랑), 기타(주황)

## 10. Trace 다이어그램

### traceSequenceDiagram(traces, options?)

서비스 간 이벤트 흐름을 sequenceDiagram으로 생성한다. TracePathLike의 steps를 순차 화살표로 표현.

## 11. 다이어그램 카탈로그

### listAllDiagrams(graph, topo?) → Record<string, DiagramEntry[]>

사용 가능한 모든 다이어그램 목록을 종류별로 반환한다. registry-service의 `/api/diagrams` 엔드포인트가 이 함수를 호출한다.

반환 카테고리:

| 카테고리 | 조건 |
|----------|------|
| `intent-links` | intent-link 노드가 있을 때 |
| `dsl` | dsl-bundle 노드가 있을 때 |
| `domain` | domain 노드가 있을 때 |
| `service` | topology가 제공될 때 |
| `constraint` | constraint 노드가 있을 때 |
| `table` | table 노드가 있을 때 |
| `table-er` | table 노드가 있을 때 (전체 ER 단일 항목) |
| `observation-loop` | 항상 (단일 항목) |
| `transition-spec` | transition-spec 노드가 있을 때 |
| `transition-dag` | transition-spec 노드가 있을 때 (전체 DAG 단일 항목) |

## 관련 소스

| 파일 | 역할 |
|------|------|
| `packages/spec-core/src/visualization/mermaid-gen.ts` | 전체 다이어그램 생성 함수 |
| `packages/spec-core/src/visualization/mermaid-gen.test.ts` | 다이어그램 생성 테스트 |
| `packages/spec-core/src/visualization/index.ts` | barrel export |
