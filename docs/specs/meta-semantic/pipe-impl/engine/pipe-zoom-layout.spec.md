---
def:
  id: pipe-zoom-layout
  type: design
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: domain
  links:
    - target: pipe-zoom
      type: depends_on
sources:
  - packages/core/src/pipe/pipe-zoom.ts
  - packages/core/src/pipe/pipe-zoom-layout.test.ts
---

# PipeGraph 줌 레벨 레이아웃

## 목적 ^purpose

`ZoomView`의 노드에 위상 정렬 기반 좌표를 부여하여
좌에서 우로 읽히는 DAG 배치를 만든다.
이 패싯은 "어디에 놓이는가"를 책임지고,
노드 선택이나 줌 상호작용 같은 렌더러 책임은 포함하지 않는다.

## 정의 ^defines

- `computeLayout(view)` — `ZoomView`를 받아 노드 `position`을 채운 새 `ZoomView` 반환
- `LAYER_GAP = 200`, `NODE_GAP = 100` — 기본 간격 상수
- 레이어 할당 + barycenter 정렬 + 좌표 할당 3단계 알고리즘

## 소비 ^consumes

- `ZoomView`, `ZoomNode`, `ZoomEdge` (`packages/core/src/pipe/pipe-zoom.ts`)

## 알고리즘

1. `inAdj / outAdj` 인접 리스트 구성
2. incoming 없는 노드를 layer 0으로 두고, 부모 최장 경로 기준으로 레이어를 올린다
3. 같은 레이어 안에서는 부모들의 평균 위치(barycenter)로 정렬한다
4. `x = layer * LAYER_GAP`, `y = index * NODE_GAP - totalHeight / 2`로 좌표를 준다

핵심 불변량:

- 체인 그래프에서는 downstream으로 갈수록 `x`가 단조 증가
- 같은 depth의 분기 노드는 같은 `x`를 공유
- 빈 뷰는 그대로 반환

## 구현 참조

- `packages/core/src/pipe/pipe-zoom.ts:193` — `computeLayout`
- `packages/core/src/pipe/pipe-zoom.ts:208` — 최장 경로 레이어 할당
- `packages/core/src/pipe/pipe-zoom.ts:238` — barycenter 정렬
- `packages/core/src/pipe/pipe-zoom.ts:262` — 좌표 할당

## 테스트 참조

- `packages/core/src/pipe/pipe-zoom-layout.test.ts:6` — 레이아웃 suite
- `packages/core/src/pipe/pipe-zoom-layout.test.ts:7` — 체인 x좌표 단조 증가
- `packages/core/src/pipe/pipe-zoom-layout.test.ts:21` — 분기 노드 동일 x축
- `packages/core/src/pipe/pipe-zoom-layout.test.ts:30` — 단일 노드/빈 그래프 처리

## 검증

```bash
pnpm --filter @qa-sdk/core test -- src/pipe/pipe-zoom-layout.test.ts
```
