---
def:
  id: pipe-zoom-style
  level: leaf
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
  - packages/core/src/pipe/pipe-zoom-style.test.ts
---

# PipeGraph 줌 레벨 스타일 규칙

## 목적 ^purpose

줌 노드의 타입 확실성, 크기, concern 집계를 계산하여
렌더러가 일관된 시각 인코딩을 적용할 수 있게 한다.
이 패싯은 "어떻게 보이는가"를 책임지고,
어떤 노드가 노출되는지는 다루지 않는다.

## 정의 ^defines

- `ZoomNodeStyle` — `certainty`, `shape`, `borderStyle`
- `computeNodeSize(pipe, contract)` — 경로 수 기반 노드 크기 계산
- `computePipeStyle(pipe)` — 개별 파이프의 타입 확실성 판정
- `computeContractStyle(contract)` — 접힌 계약의 타입 확실성 판정
- `resolveStyle(hasStrict, hasFlexible)` — strict/flexible/mixed 결정

## 소비 ^consumes

- `PipeSpec` (`packages/core/src/types/pipe-spec.ts`)
- `FoldedContract`, `collectFlowSteps` (`packages/core/src/pipe/pipe-fold.ts`)
- `countPipePaths` (`packages/core/src/pipe/pipe-path.ts`)
- `extractPipeConcerns`, `propagatePipeConcerns` (`packages/core/src/pipe/pipe-interpret.ts`)

## 시각 규칙

| certainty | 판정 기준 | shape | border |
|-----------|----------|-------|--------|
| `strict` | concrete 타입만 존재 | `polygon` | `solid` |
| `flexible` | `any`, `unknown`, `Record<string, any>`, `object`, generic `T` 포함 | `cloud` | `dashed` |
| `mixed` | strict와 flexible 혼재 또는 계약 부재 | `cloud` | `dashed` |

크기 규칙:

- `scale = 1 + log2(max(paths, 1)) * 0.5`
- `width = round(BASE_NODE_WIDTH * scale)`
- `height = round(BASE_NODE_HEIGHT * scale)`

concern 규칙:

- `leaf` 레벨: `propagatePipeConcerns(graph)` 사용
- `group/module` 레벨: 개별 `extractPipeConcerns(pipe)` 또는 fold contract concern 사용

## 구현 참조

- `packages/core/src/pipe/pipe-zoom.ts:307` — 레벨별 concern map 선택
- `packages/core/src/pipe/pipe-zoom.ts:389` — `computeNodeSize`
- `packages/core/src/pipe/pipe-zoom.ts:403` — `computePipeStyle`
- `packages/core/src/pipe/pipe-zoom.ts:427` — `computeContractStyle`
- `packages/core/src/pipe/pipe-zoom.ts:443` — `resolveStyle`
- `packages/core/src/pipe/pipe-zoom.ts:458` — `isFlexibleType`

## 테스트 참조

- `packages/core/src/pipe/pipe-zoom-style.test.ts:55` — strict / flexible / mixed 인코딩
- `packages/core/src/pipe/pipe-zoom-style.test.ts:86` — 경로 수 기반 노드 크기
- `packages/core/src/pipe/pipe-zoom-style.test.ts:108` — concern 추출/집계

## 검증

```bash
pnpm --filter @qa-sdk/core test -- src/pipe/pipe-zoom-style.test.ts
```
