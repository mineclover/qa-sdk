---
status: implemented
sources:
  - packages/spec-core/src/transition/index.ts
  - packages/spec-core/src/transition/transition-pipeline.ts
  - packages/spec-core/src/transition/transition-metrics.ts
  - packages/spec-core/src/dkg/lifecycle-e2e.test.ts
  - packages/spec-transition/src/decode-adapter.ts
  - packages/spec-transition/src/demo-transition-specs.ts
  - packages/dkg/src/dkg-bridge.ts
  - packages/dkg/src/violation-bridge.ts
  - packages/convergence/src/metric-registry.ts
  - packages/ingest-server/src/lib/phase-two-worker.ts
  - packages/ingest-server/src/lib/phase-two-worker.test.ts
  - packages/ingest-server/src/server.ts
  - packages/ingest-server/src/config/env.ts
  - packages/cli/src/commands/dkg.ts
  - docs/specs/analysis-system/analysis-transition.spec.md
  - docs/specs/pipeline-system/pipeline-phase-flow.spec.md
  - docs/specs/ingest/ingest-infra-system/ingest-runtime-operations.spec.md
---

# Tier 3 — 파이프라인 통합 + 수렴 + DKG

> ingest Phase 2.5 삽입 + 수렴 metric + effect vocabulary DKG 관리.

## 아키텍처

```
Phase 2.1: Reconstruction (EventRecord[] → RuntimeGraph)
Phase 2.2: Metric Aggregation
Phase 2.3: Verdict (ScenarioSpec 적용)
Phase 2.5: Decode + Transition Matching
  ├── decodeAddressContext(catalog, encoded) → 축:entry flat map
  ├── TransitionEngine.processSession(decoded events)
  ├── violations → logger.warn (TRANSITION_VIOLATION_MODE=warn)
  └── 에러 격리: Phase 2.5 전체 실패 → verdict/convergence 미영향
Phase 2.6: Convergence Notification (transition 결과 포함)
```

## 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `TRANSITION_ENGINE_ENABLED` | `false` | Phase 2.5 활성화 |
| `TRANSITION_VIOLATION_MODE` | — | **미구현·제거됨** (2026-10-29). 엔진이 specs만 받아 배선할 자리가 없어 env 스키마에서 삭제 — `docs/proposals/swc-next-qa-sdk-optimization/00-code-inventory.md` X-12 |
| `TRANSITION_STATE_PATH` | — | **미구현·제거됨** (2026-10-29). 세션마다 InMemoryStateStore 사용. 위와 같음 |

## Metric 정의

| ID | Category | 설명 | 임계값 |
|---|---|---|---|
| `metric:transition:coverage` | transition | 매칭된 spec / 전체 spec | warning: 50%, critical: 20% |
| `metric:transition:violation-rate` | transition | 위반 수 / 전체 시도 | warning: 20%, critical: 50% |
| `metric:transition:orphan-sequences` | transition | 미매칭 세션 수 | warning: 10, critical: 50 |

`autoRunnable: false` — Phase 2.5 결과에서 `transitionFlushToMetrics()`로 값을 주입.

## DKG 엣지

| Edge | From | To | 파생 조건 |
|------|------|---|----------|
| `depends-on` | TSPEC-payment-capture | TSPEC-cart-checkout | outputAxes ∩ inputAxes |
| `satisfies` | TSPEC-cart-checkout | dsl-checkout | slotRefs ∩ DSL axes ≥ 2 |
| `satisfies` | TSPEC-payment-capture | dsl-checkout | 동일 |
| `satisfies` | TSPEC-user-login | dsl-auth | 동일 |
| `constrains` | CON-EFFECT-VOCAB | 모든 TSPEC-* | effect kind 정규 vocabulary 제약 |

## 질의 API (query-service)

| 엔드포인트 | 설명 |
|---|---|
| `GET /state/:ctx/:res` | 현재 축 스냅샷 |
| `GET /state/:ctx/:res/history` | transition instance 이력 |
| `GET /state/:ctx/:res/at?ts=` | 시점 상태 |
| `GET /transitions?context_id=&limit=` | context별 전이 목록 |

## CLI 명령

| 명령 | 설명 |
|------|------|
| `dkg transitions` | 전체 목록 (effect별 그룹 + 축 사용 빈도) |
| `dkg transition <name>` | 상세 (축 역할별 + 상태 의존성 + consumes) |
| `dkg transition coverage` | spec 수, effect 분포, 축 커버리지 |
| `dkg transition orphans` | transition이 관찰하지 않는 prefix |
| `dkg transition violations` | DKG observation + constraint 상태 |

## TransitionFunctions (convergence 주입 번들)

```typescript
interface TransitionFunctions {
  processSession: (input: TransitionSessionInput) => TransitionSessionResult;
  violationsToObs: (violations, opts?) => ObservationNode[];
  decodeCtx: (catalog, encoded) => Record<string, string>;
  specs: readonly TransitionSpec[];
}
```

세션마다 fresh InMemoryStateStore로 상태 격리. `createTransitionFunctions(specs)`로 생성.
