---
def:
  id: spec-temporal-capture
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  svc: spec-core
  tags: [entry-point]
  links:
    - target: temporal-relations
      type: refines
---

# Spec 시간 관계 수집

## 목적 ^purpose

시간 순서 수집, 데이터 흐름 수집, FlowDefinition 연결을 분리해 temporal relation이 어떤 관찰을 추가해야 하는지 정리한다.

## 구성 ^overview

- `관측 3단계와 시간 관계`: IntentLink → Auto IL → ScenarioSpec 체계에서 시간 순서의 위치를 정의한다.
- `시간 순서 수집`: session/trace 내 이벤트의 timestamp 기반 순서 모델링을 기술한다.
- `FlowDefinition 연결`: 설계된 정상 경로와 실제 이벤트 열을 비교하는 기준점을 명시한다.
- `데이터 흐름 수집`: prefix 간 인과 관계(A가 발생해야 B가 가능)를 관찰하는 방법을 정리한다.

## 관측 3단계와 시간 관계

현재 관측 체계는 **공출현(co-occurrence)** 기반이다:

1. **IntentLink (수동)**: prefix 공출현 조건 — 순서 없음, 같은 컨텍스트에서 동시에 나타나기만 하면 됨
2. **Auto IL (데이터)**: Jaccard ≥ 0.5인 session 단위 공출현 패턴 — 순서 정보 없음
3. **ScenarioSpec (설계)**: step 기반 시간 순서 — `step 1 → step 2 → step 3`

시간 관계 수집은 **Auto IL과 ScenarioSpec 사이의 gap**을 메우는 작업이다. Auto IL은 "함께 나타남"만 알고, ScenarioSpec은 "이 순서여야 함"을 선언한다. 사이에 "실제로 이 순서로 나타남"을 수집해야 한다.

## 시간 순서 수집

session 내 이벤트의 timestamp를 기반으로 순서를 모델링한다:

1. **session 단위 그룹핑**: `qa_session_id`로 이벤트를 그룹핑한다. session이 없으면 trace_id fallback.
2. **timestamp 정렬**: ISO-8601 timestamp로 이벤트를 정렬한다. `compareTimestamps(a, b)` 사용 (문자열 비교 금지).
3. **prefix 순서 추출**: 정렬된 이벤트에서 address_context의 prefix 출현 순서를 추출한다.
4. **빈도 집계**: 동일 prefix 순서 패턴의 빈도를 집계하여 "실제로 자주 나타나는 순서"를 발견한다.

시간 관계 수집은 더 많은 이벤트를 추가하는 것이 **아니라** 기존 이벤트 사이의 순서를 모델링하는 작업이다.

## FlowDefinition 연결

spec-core/src/dkg/flow-definition.ts의 FlowDefinition이 설계된 정상 경로를 정의한다:

```typescript
interface FlowDefinition {
  id: string;
  name: string;
  entry: FlowPoint;                           // 진입점: prefix:version:address
  branches: Record<string, FlowPoint>;        // 분기점들
  requiredPermissions?: FlowPoint[];          // 기대하는 권한
  expectedEvents?: FlowPoint[];               // 기대하는 이벤트
}
```

시간 관계 수집 결과와 FlowDefinition을 비교하여:
- **정상 경로 일치**: 수집된 순서가 FlowDefinition의 step 순서와 일치
- **이탈 경로 발견**: 수집된 순서가 FlowDefinition에 없는 분기를 포함
- **누락 step 탐지**: FlowDefinition에 정의된 step이 실제 데이터에서 관찰되지 않음

### FlowDefinition API

| 함수 | 설명 |
|------|------|
| `defineFlow(catalog, input)` | FlowDefinition 생성. 각 포인트의 values를 `encodePrefixByValue`로 인코딩하여 정수 주소를 확정 |
| `serializeFlow(flow)` | FlowDefinition을 JSON 문자열로 직렬화 |
| `deserializeFlow(json)` | JSON에서 FlowDefinition을 복원 |

FlowPoint 구조: `{ prefix, version, address(정수), label }`. label은 values를 `.`으로 연결하여 자동 생성.

### 주소 자동 마이그레이션 (resolve)

소스: `packages/spec-core/src/dkg/resolve.ts`

`resolve(catalog, serialized, latestVersion?)` 함수가 구버전 주소를 최신 version으로 자동 마이그레이션한다.

```
입력: "tracking:v1:15"
동작: decodePrefix(v1) → 문자열 추출 → encodePrefixByValue(v2)
출력: { address: "tracking:v2:42", migrated: true, originalVersion: "v1" }
```

문자열 식별자가 영구 고정이므로 별도 migrator가 불필요하다. decode → re-encode로 항상 마이그레이션 가능하다 (DSL DB의 마이그레이션 전략).

### FlowSchemaNode 관계 파생

소스: `packages/spec-core/src/dkg/flow-schema-relations.ts`

FlowSchemaNode에 연결할 DKG 엣지를 기존 엣지 타입 재사용으로 파생한다:

| 엣지 타입 | 방향 | 의미 |
|-----------|------|------|
| `composes` | flow-schema → axis | 참조하는 축 |
| `observes` | flow-schema → prefix | 관측하는 prefix |
| `contains` | flow-schema → domain | 소속 도메인 |
| `references` | flow-schema → flow-schema | subFlow 참조 |

두 함수 제공:
- `deriveFlowSchemaEdges(input)` — 엣지 배열 반환 (순수 함수)
- `attachFlowSchemaEdges(graph, input)` — 그래프에 직접 연결 (부수 효과)

중복 방지: 같은 (type, from, to) 조합은 한 번만 생성.

## 데이터 흐름 수집

prefix 간 인과 관계를 관찰하는 방법:

- **선행 조건**: prefix A의 이벤트가 prefix B의 이벤트보다 항상 먼저 나타나면, A→B 선행 관계를 추론한다.
- **DKG cascadeFromPrefix**: graph에서 prefix의 domain/consumer 영향 범위를 분석하여 구조적 인과를 파악한다.
- **Auto IL과의 차이**: Auto IL은 공출현(동시), 데이터 흐름은 선후(순차). 동일 session에서 둘 다 관찰 가능하다.
- 수집된 인과 관계는 ScenarioSpec 후보로 사용되지만, **직접 승격하지 않는다** — 실 사용 패턴이 최적 경로와 다를 수 있기 때문.
