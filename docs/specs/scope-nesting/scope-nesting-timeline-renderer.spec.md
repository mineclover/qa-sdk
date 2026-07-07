---
def:
  id: scope-nesting-timeline-renderer
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [visualization]
  links:
    - target: scope-nesting-visualization
      type: refines
    - target: scope-nesting-system
      type: depends_on
    - target: scope-nesting-simulation-layers
      type: depends_on
    - target: scope-nesting-mount-flow
      type: depends_on
    - target: scope-nesting-contract-timing
      type: depends_on
sources:
  - packages/viz-core/src/scope-nesting-timeline.ts
  - packages/viz-core/src/scope-nesting-timeline.test.ts
  - packages/viz-core/src/primitives.ts
  - packages/viz-core/src/shapes.ts
---

# Scope Nesting Timeline Renderer

## 목적 ^purpose

scope-nesting의 5계층 시뮬레이션 결과를 `viz-core`에서 SVG와 D3 데이터로 변환하는 renderer contract를 정의한다.

## ^defines

- `scopeTimelineToSvg()` — ScopeNesting + SimulationResult → SVG 문자열
- `scopeTimelineToD3()` — ScopeNesting + SimulationResult → D3 데이터 모델
- `buildTimelineRows()` — scope/contract/pipe/delegation 4종 행 조립
- 전용 타입: `ScopeTimelineData`, `ScopeTimelineRow`, `TimelineBlock`, `D3TimelineData`
- 전용 토큰: `SCOPE_DEPTH_COLORS`, `CONTRACT_TYPE_COLORS`, `TIMING_COLORS`

## ^consumes

- `packages/viz-core/src/scope-nesting-timeline.ts`
- `packages/viz-core/src/scope-nesting-timeline.test.ts`
- `packages/viz-core/src/primitives.ts`
- `packages/viz-core/src/shapes.ts`
- `@qa-sdk/core`의 `ScopeNesting`, `NestingValidation`, `MountSnapshot`, `TimingValidation`, `SimulationResult`
