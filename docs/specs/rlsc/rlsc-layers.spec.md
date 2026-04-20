---
def:
  id: rlsc-layers
  tier: component
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

## 목적 ^purpose

z-index 값 기준으로 노드를 6종 레이어 역할로 분류한다.
같은 z-index끼리 그룹화하여 LayerStack 배열을 생성하고,
각 스택에 역할 레이블과 총 면적을 부여한다.

## ^defines

- `packages/rlsc/src/layers.ts:classifyLayers` — `(nodes) → LayerStack[]`
  - 비가시 노드(`!visible`) 제외
  - z-index 값 기준으로 그룹화 (Map<number, RLSCNode[]>)
  - 각 그룹 → `{ zIndex, role, nodeIds, totalArea }` LayerStack 생성
  - 출력: z-index 오름차순 정렬

- `packages/rlsc/src/layers.ts:classifyRole` — z-index → LayerRole 분류 (내부)

  | z-index 구간 | LayerRole   |
  |-------------|-------------|
  | < 0         | background  |
  | 0–9         | content     |
  | 10–99       | sticky      |
  | 100–999     | overlay     |
  | 1000–9999   | modal       |
  | ≥ 10000     | tooltip     |

- `packages/rlsc/src/layers.ts:layersToText` — `(layers) → string`
  - 각 스택: `z:{zIndex}  {role}  [{nodeIds}]` 형식
  - nodeIds > 5개이면 첫 5개 + `+N` 생략 표시

## ^consumes

- `packages/rlsc/src/types.ts` — RLSCNode, LayerStack, LayerRole
