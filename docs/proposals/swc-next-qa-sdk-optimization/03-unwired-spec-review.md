---
def:
  id: swc-next-qa-sdk-optimization-03-unwired-spec-review
  type: knowledge
  knowledge_kind: proposal
  lifecycle: draft
  owner_system: apm-system
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: validation
  links:
    - target: swc-next-qa-sdk-optimization-readme
      type: depends_on
status: draft
date: 2026-10-29
part_of: swc-next-qa-sdk-optimization
role: audit
sources:
  - packages/ingest-server/src/server.ts
  - packages/ingest-server/src/routes/ingest.ts
  - packages/ingest-server/src/lib/phase-two-worker.ts
  - packages/ingest-server/src/lib/convergence-pipeline.ts
  - packages/convergence/src/metric-registry.ts
  - packages/spec-core/src/transition/transition-metrics.ts
---

# Spec은 있으나 런타임에 배선되지 않은 기능 — 배선 vs 삭제

## 목적 ^purpose

핵심 기능 정리 2순위의 첫 묶음이다. approved spec이 정의하고 코드도 있지만 런타임 경로에 연결되지 않은 기능 8건을, 배선 비용과 삭제 영향으로 비교해 하나씩 결정할 수 있게 한다. 판정 기준은 "실제로 읽는 소비자가 있는가"다. 쓰기만 하고 읽는 곳이 없는 기능은 배선해도 관리 비용만 늘어난다.

조사 기준: `main` (2026-10-29, Track A~F merge 이후).

## 1. 비교표 ^defines

| # | 기능 | spec | 현재 상태 | 읽는 소비자 | 배선 비용 | 삭제 영향 | 권장 |
|---|---|---|---|---|---|---|---|
| U-1 | 회복된 metric observation 해소 (`resolveRecoveredMetrics`) | `analysis-convergence` | 함수·테스트 존재, pipeline도 optional로 지원. `server.ts` 함수 묶음(:125-131)에서만 빠짐 | DKG observation (CON-005 흐름) | **매우 작음** — 묶음에 1줄 + 테스트 | metric이 회복돼도 observation이 열린 채로 남음 | **배선** |
| U-2 | 패턴 통계 조회 (`GET /patterns`, `getPatternStats`) | `ingest-runtime-operations` | route 존재, 항상 `inactive`. runner가 `previousPatternStats`를 private로만 보관 | `/patterns` API | **작음** — runner getter + `createApp` 전달 | API가 계속 비어 있음 (지금과 동일) | **배선** |
| U-3 | address_context 건전성 경고 (`checkAddressHealth`) | `pipeline-enrichment` 외 4건 | 함수 존재, `knownPrefixes`·`latestVersions`를 넘기지 않아 실행 안 됨. 결과는 경고 로그뿐 | 운영 로그 | **작음** — catalog에서 파생해 전달 | 경고 없음 (지금과 동일) | **Track B snapshot gate로 흡수 후 삭제**. B 전까지는 배선해 둔다 |
| U-4 | key observation 추적 (`KeyObservationStore`) | `key-observation-store` | 구현 3벌(D1·ingest pg·store drizzle), 테이블은 SQLite·PG 마이그레이션 모두 존재. server가 store를 만들지 않아 쓰기 안 됨 | **없음** — 조회 API·CLI 없음 | 쓰기: 작음 (runtime store에 1종 추가). 읽기 surface: 중간 (summary API 1개) | "설계 좌표 공간 vs 실제 관측" gap 관측 수단이 없음 (지금과 동일) | **배선 + 최소 조회 API**. 좌표 gap 관측은 시스템 목적(변화 관측)의 핵심이다. 미사용 ingest pg 구현은 삭제 |
| U-5 | metric 1분 rollup (`MetricRollupStore`, `aggregateMetrics`) | `pipeline-metric-agg` | **구현체 없음** (core 인터페이스뿐), 테이블 없음, Phase 2에서 store가 없어 항상 skip | **없음** — `query()` 호출처 없음 | **큼** — store 2 driver + 마이그레이션 + 조회 API | 없음 (raw `metric_*` 필드는 X-18로 저장됨) | **삭제** — 집계 소비자가 생기면 raw 레코드 위에서 다시 설계 |
| U-6 | transition metric 3종 (`transitionFlushToMetrics`, coverage·violation-rate·orphan) | `analysis-transition` | 함수 존재, `METRIC_DEFS`에 정의만 있고 `collectMetrics`가 계산 안 함. Phase 2.5 결과는 로그만 남음 | convergence metric → observation | **중간** — Phase 2.5 세션 결과를 convergence 버퍼까지 운반해야 함 | transition 위반이 observation으로 이어지지 않음 (지금과 동일) | **G3에서 배선** (TransitionRecord IR이 운반 수단). 그 전까지 유지 |
| U-7 | 단발 convergence 분석 (`runConvergenceAnalysis`) | `analysis-convergence`, `engine-system` | 순수·결정론 오케스트레이터. 프로덕션 호출 0 (테스트만). 런타임은 `ConvergencePipelineRunner`가 별도로 수행 | **없음** | 중간 — CLI 리포트나 G3 full rebuild로 연결 | 추천(simplification·boundary·headroom) 일괄 리포트가 사라짐 | **G3 full rebuild 진입점으로 흡수**. G3를 하지 않기로 하면 삭제 |
| U-8 | transition 상태 영속화 (`SqliteStateStore`) | `analysis-transition` | 구현 존재. 엔진이 세션마다 `InMemoryStateStore`를 만들어 연결 안 됨. Track E가 `TRANSITION_STATE_PATH`를 "배선할 자리 없음"으로 삭제 | **없음** — 세션을 넘는 상태 조회가 없음 | 중간 — 엔진 생성자에 state store 주입 경로 추가 | 세션 간 상태가 이어지지 않음 (지금과 동일) | **삭제** — 세션 격리가 현재 설계이고 교차 세션 상태 요구가 없다 |

## 2. 권장 묶음 — 2026-10-29 승인·반영

- **지금 배선 (작은 비용, 읽는 곳 있음):** U-1, U-2, U-3(임시), U-4
- **지금 삭제 (읽는 곳 없음, 구현 미완 또는 설계와 충돌):** U-5, U-8, U-4의 미사용 ingest pg 구현(`stores/pg/key-observation.adapter.ts`)
- **G3로 이관 (운반 구조가 G3에서 생김):** U-6, U-7

삭제 항목의 spec은 `lifecycle: deprecated`와 삭제 사유를 남기고, 상위 spec의 sources를 정리한다(1순위 정리와 같은 방식).

## 2.1 반영 결과

| # | 처리 | 커밋 |
|---|---|---|
| U-1 | ✅ 배선 — `lib/convergence-functions.ts`로 묶음 분리, 구성 테스트 | `98fef3a7` |
| U-2 | ✅ 배선 — runner `getPatternStats()`, route anomaly 필드를 실제 타입에 맞춤 | `98fef3a7` |
| U-3 | ✅ 배선 (임시) — `buildAddressHealthIndex(catalog)` | `98fef3a7` |
| U-4 | ✅ 배선 — SQLite·PG runtime store + `/v1/key-observations/{summary,unregistered,prefixes/:id}`. ingest-server `stores/pg/*`의 PgKeyObservationStore는 factory·cross-adapter·RLS 테스트와 묶인 Plan 07d 묶음이라 `stores/pg/*` 전체 판정으로 넘김 | `98fef3a7` |
| U-5 | ✅ 삭제 — `@qa-sdk/core` `MetricRollup*` export 제거 포함 (외부 배포 패키지 breaking) | `b62fa192` |
| U-8 | ✅ 삭제 | `b62fa192` |
| U-6, U-7 | G3 이관 표기 — `plans/gated-phases.md` G3, 각 spec에 미배선 주석 | 이 커밋 |

## 3. 이 표에 넣지 않은 것

- worker 모드 convergence 부재와 scheduler 전환은 운영 계층에서 동결하고, pure convergence 결정론·dirty-set 검증만 후속으로 둔다: [02-convergence-flush-review.md](./02-convergence-flush-review.md)
- `TransmissionEnvelope.entry_snapshot`: Track B D-2
- `DrizzleInsightsStore.collect()` no-op, `CON-005` 하드코딩 edge: 별도 정리 대상 (spec 미배선이 아니라 구현 품질 문제)
