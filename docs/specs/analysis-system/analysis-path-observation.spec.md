---
def:
  id: analysis-path-observation
  level: leaf
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [structural]
  links:
    - target: analysis-convergence
      type: depends_on
---

# Path Observation — 경로 관측 파생

## 목적 ^purpose

MatchResult를 기반으로 PathObservation을 파생한다. "어떤 순서로 어떤 노드를 통과했는가"를 추적하고, recovery 경로 사용 여부를 감지한다.

## 정의 ^defines

- **derivePathObservation()** — MatchResult → PathObservation 변환
- **PathObservation** — 경로 관측 결과 (타입: `@qa-sdk/core`)

## 소비 ^consumes

- `MatchResult`, `SpecGraph`, `RuntimeGraph` (`@qa-sdk/core`)

## 알고리즘

```
MatchResult + SpecGraph + RuntimeGraph
  → [1] 매칭된 (step_id → RuntimeNode) 쌍 수집
  → [2] timestamp 순 정렬 → reached_nodes
  → [3] 같은 event_key 반복 → loop_detected
  → [4] outgoing edge 없는 spec 노드 = terminal (goal) 노드
  → [5] 도달/미도달 goal 분류
  → [6] 마지막 도달 노드 + 종료 사유 결정
  → [7] 양쪽 모두 매칭된 spec 엣지 = traversed_edges
  → [8] optional 엣지 통과 → recovery_used
```

## PathObservation 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `reached_nodes` | `ReachedNode[]` | timestamp 순 정렬된 매칭 노드 |
| `traversed_edges` | `TraversedEdge[]` | 양쪽 endpoint 매칭된 spec 엣지 |
| `reached_goals` | `string[]` | 도달된 terminal spec 노드 |
| `unreachable_goals` | `string[]` | 미도달 terminal spec 노드 |
| `loop_detected` | `boolean` | 같은 event_key 2회 이상 관측 |
| `recovery_used` | `boolean` | optional 엣지 통과 여부 |
| `terminal_node` | `string \| null` | 마지막 매칭 런타임 노드 |
| `terminal_reason` | `TerminalReason \| null` | `"goal_reached"` 또는 `"partial"` |

## recovery_used 판정

- `SpecEdgeType = "sequence" | "branch" | "optional"`
- `traversed_edges` 중 `edge_type === "optional"`이 하나라도 있으면 `true`
- branch 엣지는 정상 분기이므로 recovery로 판정하지 않음

## 비선형 경로 관측

분기 지점을 탐지하고 각 분기의 관측 여부를 분석한다.

### 추가 정의

- **deriveBranchPaths()** — spec graph의 분기 지점 탐지 + taken/untaken 분류
- **deriveNonLinearObservation()** — PathObservation + 분기 분석 합성
- **BranchPoint** — 분기 지점 (sourceStepId + branches[])
- **BranchPath** — 분기 경로 (targetStepId, edgeType, taken, reachedNodes)
- **NonLinearPathObservation** — PathObservation + branchPoints + branchCoverage

### 분기 지점 판정

- 같은 source에서 2개 이상 outgoing 엣지 → 분기 지점
- 각 분기의 target step이 관측 노드에 있으면 `taken: true`
- taken 분기의 후속 노드를 DFS로 수집

## 구현 위치

| 파일 | 역할 |
|------|------|
| `packages/core/src/types/path-observation.ts` | PathObservation + BranchPoint/Path + NonLinearPathObservation |
| `packages/engine/src/path-observation/observe-path.ts` | derivePathObservation + deriveBranchPaths + deriveNonLinearObservation |
| `packages/engine/src/path-observation/observe-path.test.ts` | 18 tests |
