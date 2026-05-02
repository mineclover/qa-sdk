---
def:
  id: pipe-zoom-view
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
  - packages/core/src/pipe/pipe-zoom-view.test.ts
  - packages/core/src/pipe/__fixtures__/pipe-zoom-fixtures.ts
---

# PipeGraph 줌 레벨 뷰 계산

## 목적 ^purpose

PipeGraph를 `group / module / leaf` 3단계 줌 레벨로 접어
`ZoomView`와 `ZoomLevelMap`을 계산한다.
이 패싯은 "어떤 노드와 엣지가 보이는가"를 책임지고,
좌표 계산과 시각 스타일 세부 규칙은 다루지 않는다.

## 정의 ^defines

- `computeZoomLevels(graph)` — 3단계 뷰 일괄 계산
- `computeZoomView(graph, level)` — 단일 레벨 뷰 계산
- `ZoomView`, `ZoomLevelMap` — 레벨별 노드/엣지/요약 구조
- `ZoomEdge.sourcePorts/targetPorts` — PortRef 연결 메타데이터

## 소비 ^consumes

- `PipeGraph`, `ConnectionKind` (`packages/core/src/types/pipe-spec.ts`)
- `detectFoldRegions`, `foldSubgraph`, `FoldRegion`, `FoldedContract` (`packages/core/src/pipe/pipe-fold.ts`)
- `countPipePaths`, `countGraphPaths` (`packages/core/src/pipe/pipe-path.ts`)
- `extractPipeConcerns`, `propagatePipeConcerns`, `classifyPipeRole` (`packages/core/src/pipe/pipe-interpret.ts`)
- `normalizePortRefs` (`packages/core/src/pipe/pipe-endpoint.ts`)
- `resolvePorts` (`packages/core/src/pipe/pipe-port.ts`)

## 접기 전략

| 레벨 | 접는 영역 | 결과 |
|------|----------|------|
| `group` | `scope-cluster` + `aspect-cluster` + `linear-chain` + `strongly-connected` | 최대 축소 |
| `module` | `linear-chain` + `strongly-connected` | scope/aspect cluster 유지 |
| `leaf` | 없음 | 전체 파이프 노출 |

핵심 불변량:

- `group.nodes <= module.nodes <= leaf.nodes`
- `summary.originalPipeCount`는 모든 레벨에서 원본 `graph.pipes.length`와 동일
- `entryNodeId`는 항상 해당 레벨의 실제 노드 집합 안에 존재

## 구현 참조

- `packages/core/src/pipe/pipe-zoom.ts:144` — `computeZoomLevels`
- `packages/core/src/pipe/pipe-zoom.ts:155` — `computeZoomView`
- `packages/core/src/pipe/pipe-zoom.ts:285` — 레벨별 fold reason 선택
- `packages/core/src/pipe/pipe-zoom.ts:301` — 공통 `buildView`에서 노드/엣지/summary 구성

## 테스트 참조

- `packages/core/src/pipe/pipe-zoom-view.test.ts:8` — `leaf/group/module` 레벨 동작
- `packages/core/src/pipe/pipe-zoom-view.test.ts:98` — `computeZoomLevels` 단조 증가/entry 보존
- `packages/core/src/pipe/pipe-zoom-view.test.ts:139` — SCC loop 접기
- `packages/core/src/pipe/pipe-zoom-view.test.ts:159` — conditional/fan-out/PortRef edge 메타데이터 보존

## 검증

```bash
pnpm --filter @qa-sdk/core test -- src/pipe/pipe-zoom-view.test.ts
```
