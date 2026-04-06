# @qa-sdk/convergence

`@qa-sdk/convergence`는 usage snapshot 기반 수렴 분석 엔진이다. 비교와 추천 계층을 중앙 spec에서 먼저 보고 코드를 따라가는 방식이 맞다.

## 먼저 볼 문서

- [convergence-layer-group.md](../../docs/specs/spec-engine-system/convergence-layer-group.md) — 수렴 계층 개요
- [convergence-comparators.spec.md](../../docs/specs/spec-engine-system/convergence-layer-group/convergence-comparators.spec.md) — 비교/발견 계층
- [convergence-advisors.spec.md](../../docs/specs/spec-engine-system/convergence-layer-group/convergence-advisors.spec.md) — 추천/사이클 계층
- [realization-spec-core-improvement.md](../../docs/realization-spec-core-improvement.md) — spec-core에서 분리된 배경

## 패키지 역할

- usage aggregation, pattern classification, causal discovery, boundary/simplification recommendation을 담당한다.
- `spec-core`와 분리된 독립 분석 패키지지만, shared contract는 서로 맞물린다.
- DKG 그래프를 전부 알기보다 `GraphPort` 수준의 얇은 타입만 소비한다.

## 코드 진입점

- `src/index.ts` — public export
- `src/usage-aggregator.ts`, `src/scoped-aggregator.ts` — 사용량 집계
- `src/pattern-classifier.ts`, `src/pattern-aggregator.ts`, `src/pattern-anomaly.ts` — 패턴 분석
- `src/causal-discovery.ts`, `src/decision-comparator.ts`, `src/symbol-comparator.ts` — 비교 계층
- `src/boundary-recommender.ts`, `src/simplification-advisor.ts`, `src/headroom-advisor.ts` — 추천 계층
- `src/self-check-analyzer.ts` — self-check 통합 분석

## 실행

```bash
pnpm --filter @qa-sdk/convergence build
pnpm --filter @qa-sdk/convergence test
```
