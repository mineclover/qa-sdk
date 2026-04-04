---
def:
  id: pipe-gate-model
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: pipe-gate
      type: depends_on
sources:
  - packages/core/src/pipe/pipe-gate.ts
  - packages/core/src/pipe/pipe-gate.test.ts
---

# PipeGraph 게이트 모델

## 목적 ^purpose

PipeGraph 품질 게이트가 어떤 수준에서 무엇을 평가하는지,
그리고 결과가 어떤 계약으로 반환되는지를 정의한다.
이 패싯은 게이트의 "모델과 언어"를 담당하고, 실제 판정 알고리즘은 포함하지 않는다.

## 정의 ^defines

- `GateLevel` — `pipe | facet | scenario | graph`
- `GateCriterion` — 9종 평가 기준
- `PipeGateSpec` — 게이트 선언 모델
- `CriterionResult` — 기준별 평가 결과
- `GateVerdict` — `pass | fail | review`
- `SubGateIssue`, `GateResult` — review 포함 최종 결과 모델

## 적용 시점

| 시점 | 필요 데이터 | 사용 가능 기준 |
|------|------------|--------------|
| 정의 직후 | `PipeGraph` 구조만 | `no-isolated-pipes`, `max-complexity` |
| 정적 분석 후 | + concern / role / impact | `concern-*`, `role-is`, `all-pipes-have-concerns`, `no-unhandled-resilience`, `blast-radius-max` |
| 시뮬레이션 후 | + `executedPathCount` | `path-coverage-min` |

핵심 규칙:

- `GateLevel`은 분류 태그이지 자동 합성 레벨이 아니다
- 같은 레벨끼리는 서로 review를 발생시키지 않는다
- `review`는 배치 평가에서만 생기며, 단일 `evaluateGate` 결과에는 직접 나오지 않는다

## 게이트 예시

```typescript
const chargeResilience: PipeGateSpec = {
  id: "charge-resilience",
  level: "pipe",
  target: "charge",
  criteria: [
    { type: "concern-present", values: ["resilience", "latency"] },
    { type: "role-is", value: "transformer" },
    { type: "blast-radius-max", value: 5 },
  ],
};
```

## 구현 참조

- `packages/core/src/pipe/pipe-gate.ts:18` — `GateLevel`
- `packages/core/src/pipe/pipe-gate.ts:21` — `GateCriterion`
- `packages/core/src/pipe/pipe-gate.ts:33` — `PipeGateSpec`
- `packages/core/src/pipe/pipe-gate.ts:46` — `CriterionResult`
- `packages/core/src/pipe/pipe-gate.ts:56` — `GateVerdict`
- `packages/core/src/pipe/pipe-gate.ts:59` — `SubGateIssue`
- `packages/core/src/pipe/pipe-gate.ts:69` — `GateResult`

## 테스트 참조

- `packages/core/src/pipe/pipe-gate.test.ts:85` — 게이트 스펙 fixture
- `packages/core/src/pipe/pipe-gate.test.ts:135` — 개별 게이트 평가 시나리오
- `packages/core/src/pipe/pipe-gate.test.ts:343` — spec-tracker 리포트 생성

## 검증

```bash
pnpm --filter @qa-sdk/core test -- src/pipe/pipe-gate.test.ts
```
