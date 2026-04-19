---
def:
  id: pipe-gate-review
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
    - target: pipe-gate
      type: depends_on
sources:
  - packages/core/src/pipe/pipe-gate.ts
  - packages/core/src/pipe/pipe-gate.test.ts
  - packages/core/src/pipe/verdict-v2.ts
  - packages/core/src/pipe/verdict-v2.test.ts
---

# PipeGraph 게이트 배치 판정과 Review 전파

## 목적 ^purpose

여러 게이트를 한 배치로 평가할 때,
하위 레벨 fail을 상위 레벨의 `review`로 전파하는 규칙을 정의한다.
이 패싯은 `evaluateGates`와 그 보조 함수들의 합성 의미를 담당한다.

## 정의 ^defines

- `LEVEL_ORDER`
  `pipe(0) < facet(1) < scenario(2) < graph(3)`
- `evaluateGates(specs, graph, ...)`
- `allGatesPass(results)`
- `hasReviewItems(results)`

## review 규칙

1. 모든 spec을 먼저 `evaluateGate`로 독립 평가한다
2. `pass=false`인 결과를 레벨별로 `failedByLevel`에 모은다
3. 어떤 결과가 자기 자신은 `pass`인데 더 낮은 레벨에 fail이 있으면 `verdict = "review"`로 바꾼다
4. 같은 레벨의 실패는 review 근거가 되지 않는다

예시:

- `pipe fail + graph pass -> graph review`
- `pipe fail + pipe pass -> 둘 다 원래 verdict 유지`
- `pipe fail + scenario pass + graph pass -> scenario, graph 둘 다 review`

## 외부 소비

- `verdict-v2`는 gate fail이 있으면 최종 `fail`로,
  gate review가 있으면 최종 `review`로 승격한다
- 로컬 테스트에서는 review를 차단이 아닌 검토 요청으로 취급한다

## 구현 참조

- `packages/core/src/pipe/pipe-gate.ts:288` — `LEVEL_ORDER`
- `packages/core/src/pipe/pipe-gate.ts:302` — `evaluateGates`
- `packages/core/src/pipe/pipe-gate.ts:347` — `allGatesPass`
- `packages/core/src/pipe/pipe-gate.ts:352` — `hasReviewItems`
- `packages/core/src/pipe/verdict-v2.ts:121` — gate 결과를 최종 verdict에 반영

## 테스트 참조

- `packages/core/src/pipe/pipe-gate.test.ts:275` — 배치 평가
- `packages/core/src/pipe/pipe-gate.test.ts:303` — 하위 fail -> 상위 review
- `packages/core/src/pipe/pipe-gate.test.ts:327` — 같은 레벨은 review 아님
- `packages/core/src/pipe/verdict-v2.test.ts:139` — gate fail -> 최종 fail
- `packages/core/src/pipe/verdict-v2.test.ts:183` — gate review -> 최종 review

## 검증

```bash
pnpm --filter @qa-sdk/core test -- src/pipe/pipe-gate.test.ts src/pipe/verdict-v2.test.ts
```
