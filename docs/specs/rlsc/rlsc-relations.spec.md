---
def:
  id: rlsc-relations
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: rlsc
  links:
    - target: rlsc
      type: depends_on
---

^purpose

가시 노드 목록에서 8종 공간 관계를 탐지한다.
노드 쌍을 순회하며 기하 조건을 평가하고, RLSCRelation 배열을 반환한다.

^defines

- `packages/rlsc/src/relations.ts:detectRelations` — `(nodes) → RLSCRelation[]`
  - 가시 노드(`visible`)만 필터링 후 O(n²) 쌍 순회
  - `contains` 판정 시 해당 쌍에 대해 나머지 관계 판정 skip (`continue`)
  - 쌍 판정 후 `detectFlowRelations` 추가 수행 (형제 순서)

- 8종 관계 및 판정 조건:

  | type       | 조건                                                                 |
  |------------|----------------------------------------------------------------------|
  | contains   | DOM depth 차이(얕은 쪽이 source) + rect 완전 포함                     |
  | stacked    | z-index 다름 + overlapRatio > 0.8, source = 낮은 z 노드              |
  | overlaps   | rectsOverlap = true + overlapRatio > 0.1                             |
  | adjacent-x | y축 겹침 > 0 + x 간격 ≤ ADJACENCY_GAP(16px)                         |
  | adjacent-y | x축 겹침 > 0 + y 간격 ≤ ADJACENCY_GAP(16px)                         |
  | aligned-x  | left 차이 ≤ ALIGNMENT_THRESHOLD(4px) 또는 right 차이 ≤ 4px          |
  | aligned-y  | top 차이 ≤ ALIGNMENT_THRESHOLD(4px) 또는 bottom 차이 ≤ 4px          |
  | flow       | 같은 부모 노드의 가시 자식 간 순서 (i → i+1)                          |

- `packages/rlsc/src/relations.ts:overlapRatio` — 교차 면적 / min(A면적, B면적) (내부)
  - 교차 없으면 0, 더 작은 노드 기준 비율

- `packages/rlsc/src/relations.ts:ADJACENCY_GAP` — 16px 상수
- `packages/rlsc/src/relations.ts:ALIGNMENT_THRESHOLD` — 4px 상수

- `packages/rlsc/src/relations.ts:relationsToText` — `(relations) → string`
  - 유형별 그룹화 후 source별로 targets 합산 출력
  - 형식: `{source} {TYPE} {target1, target2, ...}`

^consumes

- `packages/rlsc/src/types.ts` — RLSCNode, RLSCRelation, LayoutRect
