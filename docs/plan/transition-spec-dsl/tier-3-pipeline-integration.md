# Tier 3 — 파이프라인 통합 + 수렴 + DKG [진행 중]

> ingest Phase 2.5 삽입 + 수렴 metric + effect vocabulary DKG 관리.

## 완료 현황

| 항목 | 상태 |
|------|------|
| address_context 디코딩 어댑터 | **완료** — `decode-adapter.ts` |
| ingest Phase 2.5 삽입 | **완료** — `phase-two-worker.ts` + `server.ts` |
| 환경변수 + 게이팅 | **완료** — `TRANSITION_ENGINE_ENABLED`, `TRANSITION_VIOLATION_MODE` |
| 에러 격리 테스트 | **완료** — 2개 테스트 (engine throw, engine 미설정) |
| CON-EFFECT-VOCAB constraint | **완료** — bootstrap 자동 등록 |
| 수렴 metric 3종 정의 | **완료** — METRIC_DEFS에 transition category 추가 |
| inter-spec depends-on | **완료** — bootstrap 자동 파생 |
| DSL satisfies | **완료** — bootstrap 자동 파생 |
| TransitionFunctions 함수 번들 | **완료** — processSession + violationsToObs + decodeCtx |
| query-service 상태 질의 API | 미착수 |
| CLI transition 명령 확장 | 부분 완료 (transitions/transition 조회) |

## 아키텍처

```
Phase 2.1: Reconstruction (EventRecord[] → RuntimeGraph)
Phase 2.2: Metric Aggregation
Phase 2.3: Verdict (ScenarioSpec 적용)
Phase 2.5: Decode + Transition Matching (NEW)
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
| `TRANSITION_VIOLATION_MODE` | `"warn"` | `"strict"` = 위반 시 에러, `"warn"` = 로깅만 |

## Metric 정의 (METRIC_DEFS)

| ID | Category | 설명 | 임계값 |
|---|---|---|---|
| `metric:transition:coverage` | transition | 매칭된 spec / 전체 spec | warning: 50%, critical: 20% |
| `metric:transition:violation-rate` | transition | 위반 수 / 전체 시도 | warning: 20%, critical: 50% |
| `metric:transition:orphan-sequences` | transition | 미매칭 세션 수 | warning: 10, critical: 50 |

`autoRunnable: false` — Phase 2.5에서 TransitionFlushResult로 값을 주입해야 함. 자동 수집 아님.

## 남은 작업

| 항목 | 설명 |
|------|------|
| query-service 상태 질의 API | GET /state/:ctx/:res, /history, /at?ts= |
| CLI transition coverage/orphans/violations | metric 기반 CLI 명령 |
| metric 수집 통합 | Phase 2.5 결과 → collectMetrics 연동 |
| SqliteStateStore 통합 | Phase 2.5에서 persist (현재 InMemory) |
