---
status: implemented
sources:
  - packages/spec-transition/src/transition.types.ts
  - packages/spec-transition/src/state-store.ts
  - packages/spec-transition/src/sqlite-state-store.ts
  - packages/spec-transition/src/input-validator.ts
  - packages/spec-transition/src/output-applier.ts
  - packages/spec-transition/src/transition-engine.ts
  - packages/spec-transition/src/transition-engine.test.ts
  - packages/spec-transition/src/proof-of-value.test.ts
  - packages/core/src/lib/clock.ts
  - packages/core/src/lib/clock.test.ts
  - docs/specs/analysis-system/analysis-transition.spec.md
---

# Tier 2 — 축 기반 상태 + Transition Engine

> 상태를 DEMO_CATALOG 축으로 표현. 7단계 파이프라인.
> 시스템의 성격 전환: 관찰 → 관찰 + 상태 재구성.

## 상태 축 매핑

| 용도 | 축 | 비고 |
|------|---|------|
| 흐름 위치 | `flow_step` | entry → processing → success |
| 자원 생명주기 | `lifecycle_state` | draft → active → deprecated |
| 자원 위치 | `resource_location` | origin, cache, queue, external |
| 버전 단계 | `version_lifecycle` | draft → locked → released |
| 존재 여부 | `lifecycle_state` 유무 | exists: false = 미설정 |

`resource_location` 축: 5Q 충족. DKG Decision `DEC-NEW-AXIS-resource_location`.

## 7단계 파이프라인

```
collect → match → bind → load state → validate input → apply output → emit instance
```

2-pass 아키텍처: Pass 1(match+bind) → matched_at 정렬 → Pass 2(load+validate+apply+emit).

## StateStore

```typescript
interface StateStore {
  get(contextId: string, resourceId: string, axis: string): string | null;
  set(contextId: string, resourceId: string, axis: string, value: string): void;
  unset(contextId: string, resourceId: string, axis: string): void;
  snapshot(contextId: string, resourceId: string): Record<string, string>;
  clear(): void;
}
```

| 구현 | 용도 |
|------|------|
| InMemoryStateStore | 개발/테스트/세션 격리 |
| SqliteStateStore | 영속 분석 (AsyncStateStore) |

## 타임스탬프 정렬

`compareTimestamps()` (`@qa-sdk/core`). ISO-8601 문자열 비교 금지 — `"10:00:00Z"` > `"10:00:00.100Z"` 문제.

## 실증 결과

shop-web checkout 흐름 13개 이벤트, 4개 transition spec:

| 시나리오 | 결과 |
|----------|------|
| A (정상) | 4개 전이 순서 실행. 최종 상태 재구성. unmatched 3개 |
| B (비정상) | 주문 없이 결제 → input violation. Verdict가 놓치는 것을 잡음 |
| C (시점 질의) | 중간 이벤트 → 중간 상태. deterministic replay 보장 |
