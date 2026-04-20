---
def:
  id: pipe-gate
  type: design
  tier: system
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  links:
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: pipe-interpret
      type: contains
    - target: pipe-analyze
      type: contains
    - target: pipe-gate-model
      type: contains
    - target: pipe-gate-evaluation
      type: contains
    - target: pipe-gate-review
      type: contains
  source: packages/core/src/pipe/pipe-gate.ts
---

# PipeGraph 퀄리티 게이트

## 목적 ^purpose

PipeGraph에 대한 품질 기준을 **스펙으로 정의**하고,
테스트 실행 시 **자동으로 평가**하여 **pass / fail / review** 판정을 내린다.

## ^overview

`pipe-gate`은 하나의 기능이지만 책임은 세 패싯으로 분리된다.

- `pipe-gate-model`:
  `GateLevel`, `GateCriterion`, `PipeGateSpec`, `GateResult` 같은 게이트 계약과 적용 시점을 정의한다.
- `pipe-gate-evaluation`:
  `evaluateGate`와 9종 criterion 평가 규칙, metric 계산, `executedPathCount` 제약을 다룬다.
- `pipe-gate-review`:
  `evaluateGates`의 배치 평가, 레벨 간 `review` 전파, `allGatesPass`/`hasReviewItems`를 다룬다.

## 위임 ^delegates

| 하위 스펙 | 내용 |
|-----------|------|
| `pipe-gate-model` | 타입 계약, 적용 시점, 게이트 예시 |
| `pipe-gate-evaluation` | 개별 criterion 평가와 metric 계산 |
| `pipe-gate-review` | 배치 평가와 review 전파 규칙 |

## 소비 ^consumes

- `PipeSpec`, `PipeGraph`, `PipeFlow` (`packages/core/src/types/pipe-spec.ts`)
- `extractPipeConcerns`, `propagatePipeConcerns`, `analyzePipeImpact`, `classifyPipeRole` (`packages/core/src/pipe/pipe-interpret.ts`)
- `countGraphPaths` (`packages/core/src/pipe/pipe-path.ts`)
- `analyzePipeComplexity` (`packages/core/src/pipe/pipe-analyze.ts`)
- `normalizeEndpointPipeIds` (`packages/core/src/pipe/pipe-endpoint.ts`)

## 검증

```bash
pnpm --filter @qa-sdk/core test -- src/pipe/pipe-gate.test.ts
```
