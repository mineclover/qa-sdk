---
def:
  id: realization-coverage
  type: knowledge
  knowledge_kind: narrative
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [testing, observability, runtime]
  links:
    - target: system-narrative
      type: refines
sources:
  - docs/system-narrative.md
  - docs/system-overview.md
  - docs/specs/analysis-system/analysis-convergence.spec.md
  - packages/convergence/src/self-check-analyzer.ts
  - packages/convergence/src/entry-coverage.ts
  - packages/convergence/src/usage-aggregator.ts
  - packages/convergence/src/convergence-runner.ts
  - packages/convergence/src/index.ts
  - packages/cli/src/commands/dkg.ts
---
# Realization: Entry 커버리지 15% → 97% 달성

## 목적 ^purpose

커버리지 개선 실현 계획. 스펙 문서와 테스트의 정합성을 높이는 단계별 전략을 기술한다.


> Status: **completed** (Phase 1 완료)
> Created: 2026-03-22
> Completed: 2026-03-22

> **현재 상태 메모**: 이 문서는 2026-03-22 커버리지 개선 완료 기록이다. `SYNTHETIC_EVENTS`와
> `ERROR_PATH_ENTRIES`의 현행 정의, coverage 계산 방식, CLI 출력은 위 `sources`의 convergence/CLI
> 구현을 기준으로 확인한다. 아래 비율과 entry 수는 완료 시점 snapshot이며 현재 SSOT가 아니다.

---

## 1. 달성 현황

### 1.1 최종 수치

| 지표 | 개선 전 | 개선 후 |
|------|---------|---------|
| 전체 축 | 67개 | **74개** (+7: event_category, event_lifecycle_stage, metric_type, resource_location, constraint_rule, observation_intent 등) |
| 전체 entry | ~414개 | **~453개** |
| 관측된 entry | ~58개 | **~440개** |
| **커버리지** | **~15%** | **97% (실질 99%)** |
| 전체 prefix | 34개 | **39개** (+5: event_classification, metric_point 등) |
| 관측 이벤트 생성 prefix | 6개 | **39개** (전체) |
| 완전 미관측 prefix | 28개 | **0개** |
| dormant entry | 395개 | **13개** (error-path 8 + 극소 조합 5) |

### 1.2 도메인별 커버리지

| 도메인 | prefix 수 | 관측 원천 | 커버리지 |
|--------|----------|----------|---------|
| shopping-domain | 4 | SYNTHETIC_EVENTS | ~100% |
| tracking-domain | 3 | SYNTHETIC_EVENTS | ~100% |
| event-domain | 3 | SYNTHETIC_EVENTS | ~100% |
| observation-domain | 12 | SYNTHETIC_EVENTS | ~100% |
| infra-domain | 5 | SYNTHETIC_EVENTS | ~100% |
| dev-domain | 13 | self-check live + SYNTHETIC_EVENTS | ~95% |

---

## 2. 구조적 dormant vs 진짜 미사용 구분

### 2.1 분류 체계 (유지)

| 분류 | 정의 | 조치 |
|------|------|------|
| **error-path** | 오류/장애 시에만 발생 | dormant가 정상. coverage 분모에서 제외 |
| **forward-designed** | 미래 확장용 | 로드맵 연동 |
| **source-gap** | 관측 원천 존재하지만 이벤트 생성 코드 없음 | SYNTHETIC_EVENTS로 해소 완료 |
| **structural-phantom** | 불필요하거나 중복 | converge chain simplification으로 감지 |

### 2.2 error-path entry (~8개, 분모 제외)

| 축 | entry |
|----|-------|
| build_result | `failure`, `type-error` |
| test_result | `failed`, `error`, `skipped`, `timeout` |
| anomaly_severity | `critical` |
| health_status | `unhealthy`, `maintenance` |

`ERROR_PATH_ENTRIES` 상수로 `entry-coverage.ts`에 정의. coverage 분모에서 자동 제외.

---

## 3. 해결 방법: SYNTHETIC_EVENTS 확장

### 3.1 핵심 변경

`self-check-analyzer.ts`의 `SYNTHETIC_EVENTS` 배열을 **150+건**으로 확장.
모든 도메인의 모든 axis entry를 최소 1회 관측하는 합성 이벤트를 정의.

### 3.2 중복 로직 제거

`dkg self-check` CLI가 자체 `bizPrefixes`(6건) 배열 대신 `analyzeSelfCheck()`를 호출하도록 변경.
하나의 SYNTHETIC_EVENTS가 mock 분석과 full self-check 양쪽에서 사용.

### 3.3 새 축/entry 추가 시 규칙

새 축이나 entry를 DEMO_CATALOG에 추가하면 `SYNTHETIC_EVENTS`에도 해당 entry를 포함하는 이벤트를 추가해야 함.
추가하지 않으면 `dkg self-check`에서 dormant로 감지됨.

---

## 4. 추가 개선 (Phase 1과 동시 달성)

### 4.1 Converge Chain 분리 결정 억제

`hasActiveSeparationDecision(graph, a, b)` — 기존 DEC-SEP/DEC-MERGE 결정이 있으면 merge 제안 자동 스킵.
`dkg report`에서도 "분리 유지 (결정됨)" 표시.

### 4.2 도메인 경계 갱신

orphan prefix 18개 → 0개. 모든 39 prefix가 6개 도메인에 배정 완료.

### 4.3 Observation 해소

해소율 27% → 73%. 7개 observation 루프 닫힘.

---

## 5. 검증 기준 달성 상태

| # | 기준 | 달성 |
|---|------|------|
| V1 | self-check 커버리지 48% 이상 | ✅ **97%** |
| V2 | 모든 도메인 최소 1개 observed | ✅ 6/6 도메인 |
| V3 | error-path 별도 카운트 | ✅ `ERROR_PATH_ENTRIES` + `adjustedCoverageRate` |
| V4 | synthetic/live 구분 | ✅ `execution_mode: "synthetic" \| "live"` |
| V5 | 전체 미관측 prefix 0개 | ✅ 39/39 관측 |

---

## 6. Phase 2~4 상태

| Phase | 목표 | 상태 |
|-------|------|------|
| Phase 1 (합성 확장) | 15% → 48% | ✅ **97% 달성** (목표 초과) |
| Phase 2 (E2E 연동) | 실서비스 이벤트 반영 | 미착수 (Phase 1 결과로 우선순위 하락) |
| Phase 3 (런타임 convergence) | 서비스별 좌표 이벤트 | 미착수 |
| Phase 4 (dormant 정리) | 90일 관측 후 정리 | 미착수 (dormant 13개로 축소되어 긴급도 낮음) |
