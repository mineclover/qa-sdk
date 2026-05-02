# decision-flow

`decision-flow`는 의사결정 과정을 좌표 공간으로 모델링하는 코어 엔진이다. 중앙 진입 문서는 `df-system`이다.

## 먼저 볼 문서

- [df-system.md](../../docs/specs/decision-flow/df-system.md) — 전체 진입점
- [df-model-group.md](../../docs/specs/decision-flow/df-model-group.md) — 모델 계층
- [df-analysis-group.md](../../docs/specs/decision-flow/df-analysis-group.md) — 비교/시간/인과 분석
- [df-interface-group.md](../../docs/specs/decision-flow/df-interface-group.md) — CLI/ingest 연동
- [decision-flow-quality-contract.spec.md](../../docs/specs/quality-gates/decision-flow-quality-bundle/decision-flow-quality-contract.spec.md) — 공개 계약 기준

## 패키지 역할

- FlowSchema, FlowInstance, gate, branch, narrative, policy learning을 제공한다.
- 의사결정의 “왜”를 좌표로 표현해 재현/비교 가능한 형태로 만든다.
- CLI와 decision-service가 이 패키지를 코어로 소비한다.

## 코드 진입점

- `src/index.ts` — public export
- `src/engine.ts`, `src/schema.ts`, `src/types.ts` — 엔진/모델
- `src/coordinate.ts`, `src/observe.ts` — 좌표화/관측
- `src/core-analysis.ts`, `src/comparison.ts`, `src/policy-learning.ts` — 분석 계층
- `src/narrative.ts`, `src/mental-model.ts` — 서사/판단 보조층

## 실행

```bash
pnpm --filter decision-flow build
pnpm --filter decision-flow test
```
