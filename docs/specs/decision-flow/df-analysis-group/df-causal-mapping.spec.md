---
def:
  tier: component
  id: df-causal-mapping
  address: def_document:v2:138369
  scope: flow
  aspect: relation
  depth: specification
  lifecycle: approved
  layer: domain
  svc: decision-flow
  tags: [decision]
  links:
    - target: df-observation-space
      type: depends_on
    - target: df-state-model
      type: depends_on
sources:
  - packages/decision-flow/src/comparison.ts
  - packages/decision-flow/src/core-analysis.ts
  - packages/decision-flow/src/monitor.ts
  - packages/decision-flow/src/orthogonality.ts
  - packages/decision-flow/src/self-analysis.ts
  - packages/decision-flow/src/core-analysis.test.ts
  - packages/decision-flow/src/monitor.test.ts
  - packages/decision-flow/src/proof.test.ts
---
# Decision Flow X↔Y 인과 매핑

## 목적 ^purpose

비즈니스 요구(X)와 기술 구현(Y)을 의사결정 좌표로 연결하는 인과 증명 경로. "특정 코드가 왜 그렇게 작성되었는지"를 좌표로 추적한다.

## 구성 ^overview

- 매핑 경로: X(비즈니스 요구) → 의사결정 좌표(FlowEngine gate 순회) → Y(기술 구현, DecisionNode)
- 양방향 참조: `DecisionNode.flowInstanceId → FlowInstance`, `FlowInstance.dkgDecisionId → DecisionNode`
- 인과 그래프: `extractCausalGraph(schema)` — gate 간 `constrains/enables/invalidates` 엣지 추출
- 코어 결정 추적: `traceCorePath(schema, instance)` — 인과 체인 + pivot point 식별
- 서사(narrative): `buildNarrative()` — 배경→여정→도달→산출→판정→회고 구조로 인과 경로 기록

## 인과 그래프 구조 ^causal-graph

`core-analysis.ts`의 `extractCausalGraph(schema)` 함수가 FlowSchema에서 인과 그래프를 추출한다.

- **엣지 유형 3종**: `GateDependency.kind`로 구분
  - `constrains` — 이 gate의 선택이 대상 gate의 선택 범위를 제약
  - `enables` — 이 gate의 특정 branch가 대상 gate를 활성화
  - `invalidates` — 이 gate를 변경하면 대상 gate를 무효화 (재결정 필요)
- **루트 결정(roots)**: 다른 gate에 의존하지 않으면서 영향을 주는 gate. X(비즈니스 요구)의 진입점
- **리프(leaves)**: 누구에게도 영향을 주지 않는 gate. Y(기술 구현)의 종착점
- 반환 타입: `{ edges: CausalEdge[], roots: string[], leaves: string[] }`

## 코어 결정 추적 ^core-trace

`traceCorePath(schema, instance)` 함수가 완료된 FlowInstance에서 코어 결정 경로를 추출한다.

- **코어 식별**: `analyzeGateStructure(schema)` → `identifyCoreGates(profiles)` — weight + 전이적 영향 + 역방향 의존으로 코어 점수 산출
  - 코어 점수: `weightScore(core=10, structural=5, tactical=1) + transitiveImpact*3 + directImpact*2 - dependents`
  - 기본 임계값 `minScore >= 8` 또는 `weight === "core"`
- **인과 체인**: 코어 gate 선택을 순서대로 나열 — `["axis-definition=new-axis", "prefix-design=new-prefix", "merge-split=not-applicable"]`
- **Pivot Point**: 각 코어 선택이 배제한 대안 수(`excludedBranches`)와 후속 영향 범위(`downstreamImpact`)를 기록

## 영향 범위 분석 ^impact-analysis

`analyzeImpact(schema, changedGateId)` — 특정 gate를 변경했을 때의 무효화 범위.

- `invalidates` 엣지만 전이적(BFS)으로 추적
- `constrains/enables` 엣지는 직접 영향만 보고
- 반환: `ImpactAnalysis { directlyInvalidated, transitivelyInvalidated, impactedWeights, invalidatesCore }`
- 코어 gate가 무효화되면 `invalidatesCore: true` — 전체 재설계 필요 신호

## 서사를 통한 인과 기록 ^narrative

`narrative.ts`의 `buildNarrative()` 함수가 FlowInstance를 서사(DecisionNarrative)로 변환한다.

- **배경(NarrativeContext)**: `source`(요구 출처), `trigger`(촉발 사건), `observationId`(DKG 관측)
- **여정(NarrativeStep[])**: 각 gate 선택 — `choice`, `reason`(evidence에서 추출), `isCore`, `evidenceKinds`
- **도달(NarrativeDestination)**: `instanceId`, `address`(좌표), `coreSelections`(핵심 선택만 추출)
- **산출(NarrativeOutcome)**: `artifactType`, `artifactRef`, `decisionNodeId`, `filesChanged`, `commits`
- `findNarrativeDivergence(a, b)` — 두 서사의 분기점 탐색: "같은 배경에서 왜 다른 곳에 도달했는가"
- `summarizeNarrative()` — 한 줄 압축: `"{trigger} → [{코어 선택}] → {artifactType}:{artifactRef}"`

## X↔Y 매핑 흐름 ^mapping-flow

```
X (비즈니스 요구)
  → NarrativeContext.trigger (촉발)
  → FlowEngine.startFlow() (플로우 시작)
  → gate 순회: 각 선택이 GateSelection + Evidence로 기록
  → encodeSelections() → coordinateAddress (1D 정수)
  → NarrativeOutcome.decisionNodeId (DKG DecisionNode 참조)
Y (기술 구현)
```

역방향 추적: `coordinateAddress` → `decodePath()` → gate별 선택 → evidence → X(비즈니스 요구)로 역추적 가능.
