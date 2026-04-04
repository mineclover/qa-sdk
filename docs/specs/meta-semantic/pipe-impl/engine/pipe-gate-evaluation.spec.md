---
def:
  id: pipe-gate-evaluation
  level: leaf
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
  - packages/core/src/pipe/pipe-interpret-gate.test.ts
---

# PipeGraph 게이트 개별 평가

## 목적 ^purpose

단일 `PipeGateSpec`을 `PipeGraph`에 대해 평가하여
criterion별 pass/fail과 메트릭을 계산한다.
이 패싯은 `evaluateGate`와 `evaluateCriterion`의 동작을 정의한다.

## 정의 ^defines

- `evaluateGate(spec, graph, executedPipeIds?, executedPathCount?)`
- criterion별 metric 채움:
  `concernCount`, `blastRadius`, `pathCoverage`, `complexity`, `isolatedPipes`

## criterion 규칙

| criterion | 계산 근거 | 비고 |
|-----------|----------|------|
| `concern-present` | pipe 직접 concern 또는 graph 전체 concern 집합 | graph 타깃 허용 |
| `concern-absent` | pipe 직접 concern | graph 타깃은 스킵 |
| `role-is` | `classifyPipeRole(pipe)` | pipe 미존재 시 fail |
| `blast-radius-max` | `analyzePipeImpact(graph, target)` | `metrics.blastRadius` 기록 |
| `path-coverage-min` | `executedPathCount / countGraphPaths(graph)` | `executedPathCount` 필수 |
| `no-isolated-pipes` | endpoint 정규화 후 연결 여부 검사 | 단일 파이프 그래프는 pass |
| `max-complexity` | `analyzePipeComplexity(graph).totalPaths` | `metrics.complexity` 기록 |
| `all-pipes-have-concerns` | `propagatePipeConcerns(graph)` | 전파 포함 |
| `no-unhandled-resilience` | inherited resilience만 있고 direct resilience 없는 pipe 탐지 | 내결함 패턴 누락 탐지 |

## 제약

`path-coverage-min`은 반드시 실제 실행 경로 수 `executedPathCount`가 필요하다.
`executedPipeIds.size` 같은 근사값으로 대체하지 않는다.

```typescript
// 잘못된 사용
evaluateGate(spec, graph, executedPipeIds);

// 올바른 사용
evaluateGate(spec, graph, executedPipeIds, executedPathCount);
```

## 구현 참조

- `packages/core/src/pipe/pipe-gate.ts:99` — `evaluateGate`
- `packages/core/src/pipe/pipe-gate.ts:135` — `evaluateCriterion`
- `packages/core/src/pipe/pipe-gate.ts:145` — criterion switch
- `packages/core/src/pipe/pipe-gate.ts:200` — `path-coverage-min`
- `packages/core/src/pipe/pipe-gate.ts:220` — `no-isolated-pipes`
- `packages/core/src/pipe/pipe-gate.ts:264` — `no-unhandled-resilience`

## 테스트 참조

- `packages/core/src/pipe/pipe-gate.test.ts:135` — 개별 게이트 pass/fail
- `packages/core/src/pipe/pipe-gate.test.ts:199` — criterion별 단위 검증
- `packages/core/src/pipe/pipe-gate.test.ts:252` — `executedPathCount` 필수성
- `packages/core/src/pipe/pipe-interpret-gate.test.ts:145` — concern/impact 품질 게이트가 평가 입력 품질을 보증

## 검증

```bash
pnpm --filter @qa-sdk/core test -- src/pipe/pipe-gate.test.ts src/pipe/pipe-interpret-gate.test.ts
```
