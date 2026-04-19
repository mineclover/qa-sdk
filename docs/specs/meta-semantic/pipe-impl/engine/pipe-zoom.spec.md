---
def:
  id: pipe-zoom
  level: module
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  links:
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: meta-semantic-folding
      type: depends_on
    - target: pipe-analyze
      type: depends_on
    - target: pipe-interpret
      type: depends_on
    - target: pipe-zoom-view
      type: contains
    - target: pipe-zoom-layout
      type: contains
    - target: pipe-zoom-style
      type: contains
  source: packages/core/src/pipe/pipe-zoom.ts
---

# PipeGraph 줌 레벨 시각화 데이터 모델

## 목적 ^purpose

PipeGraph를 3단계 줌 레벨(group/module/leaf)로 변환하여
시각화 렌더러(Mermaid, D3, Canvas 등)에 넘길 데이터를 계산한다.
실제 렌더링은 하지 않으며, 노드/엣지/레이아웃/스타일 데이터만 제공한다.

## ^overview

`pipe-zoom`은 하나의 구현 파일에서 세 패싯을 함께 제공하지만, 추적 단위는 명확히 나뉜다.

- `pipe-zoom-view`:
  3단계 줌 레벨 뷰 생성, 접기 전략, edge 메타데이터 보존, monotonic node count 불변량을 다룬다.
- `pipe-zoom-layout`:
  DAG 레이어 배치, barycenter 정렬, x/y 좌표 계산을 다룬다.
- `pipe-zoom-style`:
  타입 확실성 시각 인코딩, 노드 크기, concern 집계를 다룬다.

## 위임 ^delegates

| 하위 스펙 | 내용 |
|-----------|------|
| `pipe-zoom-view` | `computeZoomView` / `computeZoomLevels`와 접기 전략 |
| `pipe-zoom-layout` | `computeLayout`과 레이아웃 불변량 |
| `pipe-zoom-style` | `ZoomNodeStyle`, 크기 규칙, concern 집계 |

## 소비 ^consumes

- `PipeGraph`, `PipeSpec`, `PipeConnection`, `PipePort` (`packages/core/src/types/pipe-spec.ts`)
- `foldSubgraph`, `detectFoldRegions`, `FoldedContract`, `collectFlowSteps` (`packages/core/src/pipe/pipe-fold.ts`)
- `countPipePaths`, `countGraphPaths` (`packages/core/src/pipe/pipe-path.ts`)
- `extractPipeConcerns`, `propagatePipeConcerns`, `classifyPipeRole` (`packages/core/src/pipe/pipe-interpret.ts`)
- `normalizePortRefs` (`packages/core/src/pipe/pipe-endpoint.ts`)
- `resolvePorts` (`packages/core/src/pipe/pipe-port.ts`)

## 검증

```bash
pnpm --filter @qa-sdk/core test -- src/pipe-zoom   # 26 tests (3 files)
```
