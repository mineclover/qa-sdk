---
def:
  id: rlsc-grid-test
  level: leaf
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: rlsc
  links:
    - target: rlsc-grid
      type: refines
  source: packages/rlsc/src/grid.test.ts
---

## 목적 ^purpose

`analyzeGrid`의 셀 크기 계산, 커버리지 범위, dominant 선정, zStack 정렬을 검증한다.

소스: `packages/rlsc/src/grid.test.ts`

## cellSize 기본값

| 시나리오 | 기대 결과 |
|----------|----------|
| cellSize 미지정 | `grid.cellSize === 16`, `cols = ⌈1920/16⌉`, `rows = ⌈1080/16⌉` |
| cellSize 32 지정 | `grid.cellSize === 32`, `cols = ⌈1920/32⌉` |

## coverage

- 모든 셀의 `cell.coverage ∈ [0, 1]` (Math.min clamping)

## 빈 셀

- child가 첫 번째 셀만 차지할 때, 마지막 행/열 셀에 `child` id 없음
  - root가 전체 커버하더라도 child id는 해당 셀에만 포함

## dominant

- big(100×100)과 small(20×20)이 동일 위치에 있을 때, root를 `visible: false`로 설정
- 첫 번째 셀 [0][0]: `dominant = "big"`
- 두 번째 셀 [0][1] (x:16–32): `dominant = "big"` (small은 x<16 범위 밖)

## zStack

- low(zIndex=0)와 high(zIndex=100)가 동일 위치 → `zStack` 배열에서 low 인덱스 < high 인덱스 (오름차순)
