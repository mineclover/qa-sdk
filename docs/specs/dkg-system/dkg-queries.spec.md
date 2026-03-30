---
def:
  id: dkg-queries
  address: def_document:v2:68764
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [decision, observability, runtime]
  links:
    - target: dkg-node-types
      type: depends_on
    - target: dkg-edge-types
      type: depends_on
---
# DKG 설계 시점 질의


## 탐색 ^navigation

dkg-system > **dkg-queries**

형제: `dkg-node-types` · `dkg-edge-types` · `dkg-constraint` · `dkg-growth-spiral` · `dkg-skills-system` · `dkg-service-topology` · `dkg-state-store`

## 목적 ^purpose

DKG 그래프에서 설계 시점 정보를 추출하는 질의 함수. 이웃 조회, cascade 추적, 제약 검사, 의도 링크 검증 등을 제공한다.

## 구성 ^overview

질의 함수는 6개 범주로 분류된다: 이웃 조회, cascade 추적, 제약/의도 검사, 카테고리 질의, 테이블 의존 질의, 탐색 skill.

## GraphRegistry 질의 API

소스 위치: `packages/spec-core/src/dkg/graph-registry.ts`

### 이웃 조회

| 메서드 | 설명 |
|--------|------|
| `neighbors(id, type)` | 순방향 이웃 노드 ID 목록 |
| `reverseNeighbors(id, type)` | 역방향 이웃 노드 ID 목록 |
| `transitiveNeighbors(id, type, direction)` | BFS 순회. 깊이 제한 10. 중복 방지 |

### Cascade 추적

#### cascadeFromAxis(axisId)

축 변경 시 영향받는 prefix를 추적한다.

1. 1단계: `Axis ←composes── Prefix` (직접 사용)
2. 2단계: 영향받는 `Prefix ←references── Prefix` (참조하는 prefix) — transitive 반복

반환: `Array<{ id, reason: "composes" | "references", distance }>`

#### cascadeFromPrefix(prefixId)

prefix 변경 시 영향받는 domain + consumer를 추적한다.

- `prefix ←contains── Domain`: 소속 도메인 파악
- `Domain ←consumes── Consumer`: 도메인을 소비하는 consumer
- `prefix ←consumes── Consumer`: 도메인 밖에서 직접 소비하는 consumer

#### cascadeFromFlowSchema(flowSchemaId)

FlowSchema 변경 시 영향받는 axis/prefix를 추적한다.

1. 직접: `FlowSchema ─composes→ Axis`, `─observes→ Prefix`
2. subFlow: `FlowSchema ─references→ subFlow`를 재귀 순회하며 동일 규칙 반복

#### cascadeFromTable(tableId)

테이블 변경 시 영향받는 prefix와 FK 참조 테이블을 추적한다.

- `table ←composes── prefix` (table_ref dim 경유)
- `table ←references── table` (FK 경유)

### 제약/의도 검사

| 메서드 | 설명 |
|--------|------|
| `activeConstraints(targetId)` | 대상에 적용되는 활성 constraint 목록 |
| `intentLinksFor(targetId)` | 대상에 연결된 intent-link + invariant 목록 |

### 카테고리 질의

| 메서드 | 설명 |
|--------|------|
| `getPrefixesByCategory(category)` | 특정 schema category의 prefix 목록 |
| `groupPrefixesByCategory()` | 모든 prefix를 category별 그룹핑 |

### 테이블 의존 질의

| 메서드 | 설명 |
|--------|------|
| `getPrefixesForTable(tableId)` | 테이블을 참조하는 prefix 목록 |
| `getTablesForPrefix(prefixId)` | prefix가 참조하는 테이블 목록 |
| `getTableColumnRefs(tableId)` | 테이블 컬럼의 축/prefix/FK 참조 |

## 탐색 Skill (service-explorer)

소스 위치: `packages/spec-core/src/dkg/skills/service-explorer.ts`

4종의 복합 질의 함수가 DKG + ServiceTopology + Catalog를 조합한다.

### exploreService(graph, topo, catalog, serviceId)

서비스 단위 전체 프로파일. 소유 prefix별 headroom, 소비 prefix별 contract, 의존 관계, 관련 observation/decision을 수집한다.

### explorePrefix(graph, topo, catalog, prefixId)

prefix 단위 심층 프로파일. 차원 정보, 축별 headroom, 소유자/소비자, 소속 domain/DSL, 적용 constraint, 관련 observation/decision/intent-link을 수집한다.

### exploreDsl(graph, catalog, dslId)

DSL 번들 프로파일. 멤버 목록(role/svcRefLabel), 서비스 바인딩, 불변조건, 축 버전 스큐 분석 결과를 반환한다.

### systemOverview(graph, topo, catalog)

시스템 대시보드. 서비스 요약, hotspot(headroom-zero, constraint-violation, observation), 의존 그래프 통계, 도메인 건강 상태를 집계한다.

## 역추적 Skill (trace)

소스 위치: `packages/spec-core/src/dkg/skills/trace.ts`

### traceNode(graph, catalog, nodeId, options?)

임의의 노드에서 출발하여 구성(composition), 참조(references), 소속(membership), 제약(constraints), 인과 체인(causalChain), 직접 결정(directDecisions), 의도 링크(intentLinks), 소비(consumes), 토폴로지(topology), cascade, 적용 가능 skill을 한 번에 수집한다.

## 흐름 검증 Skill (flow-trace)

소스 위치: `packages/spec-core/src/dkg/skills/flow-trace.ts`

### traceFlows(graph, records, options?)

IntentLink의 invariant를 실 트래픽(AddressContextRecord)과 대조하여 위반을 감지한다. endpoint 불완전 + invariant 텍스트 패턴으로 위반 판정. 위반 시 Observation을 자동 생성.

### validateDslInvariants(graph, records, options?)

DSL 번들의 invariant를 AddressContextRecord와 대조. traceFlows와 보완적 — traceFlows는 IntentLink, validateDslInvariants는 DSL 번들 불변조건 검증.
