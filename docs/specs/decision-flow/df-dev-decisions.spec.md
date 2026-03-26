---
def:
  id: df-dev-decisions
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  svc: decision-flow
  tags: [decision]
  links:
    - target: df-vector-analysis
      type: depends_on
    - target: df-system
      type: implements
---
# 일상 개발 의사결정 플로우

## 목적 ^purpose

개발자가 매일 마주치는 작업 수준 의사결정을 구조화한 5개 FlowSchema + 6개 자동 정책. 라우터가 결정 유형을 분류하고 적절한 하위 플로우로 자동 연결한다.

## 구성 ^overview

- **DECISION_ROUTER**: 8유형 분류 (test/scope/stabilization/architecture/feature-lookup/sprint/coordinate/custom) → urgency → reversibility → 하위 플로우 자동 시작
- **TEST_NEEDED_FLOW**: 변경성격 → 영향범위 → 커버리지 → 판정. 자동: docs→불필요, 리팩터+국소+충분→불필요, 신규+시스템→E2E
- **SCOPE_EXPANSION_FLOW**: 완성도 → 피드백 → 부채 → 판정. 자동: 미완성+수요없음→보류
- **STABILIZATION_FLOW**: 버그빈도 → 성능 → 코드품질 → 판정. 자동: 버그높음→개선필요
- **ARCHITECTURE_DECISION_FLOW**: 대안목록 → 트레이드오프 → 전환비용 → 최종선택
- **DEV_DECISION_UNITS**: 각 플로우별 주제/목적/성공기준/fallback 정의

## DECISION_ROUTER — 범용 라우터 ^router

모든 일상 개발 의사결정의 진입점. 3개 gate로 구성된다.

| Gate | Phase | 선택지 | Weight |
|------|-------|--------|--------|
| decision-type | perceive | test-needed, scope-expansion, stabilization, architecture-decision, feature-lookup, sprint, coordinate-design, custom | core |
| urgency | evaluate | blocking, important, can-defer | - |
| reversibility | evaluate | one-way, two-way | - |

- CLI에서 라우터 완료 시 `decision-type` 선택 값이 등록된 스키마 ID와 일치하면 **하위 플로우를 자동 시작**
  - 라우터 context를 하위 플로우에 전달 (`routerInstanceId`, `urgency`, `reversibility` 포함)
  - `feature-lookup`과 `custom`은 하위 플로우 없음
- mentalModels: urgency → `speed-calibration`, `wartime-awareness` / reversibility → `bezos-doors`

## TEST_NEEDED_FLOW — 테스트 필요 여부 ^test-needed

변경의 성격에 따라 테스트 필요 여부와 종류를 판정한다.

| Gate | Phase | 선택지 | Weight | Mental Model |
|------|-------|--------|--------|-------------|
| change-type | perceive | new-feature, bug-fix, refactor, config, docs | core | bezos-doors |
| impact-scope | evaluate | local, module, system | structural | munger-inversion |
| existing-coverage | perceive | sufficient, partial, none | - | - |
| verdict | decide | not-needed, add-unit, add-integration, add-e2e, strengthen | - | edge-paranoia |

- 자동 정책 3건:
  - `docs` → `not-needed` (confidence 0.95, priority 100)
  - `refactor` + `local` + `sufficient` → `not-needed` (confidence 0.9, priority 90)
  - `new-feature` + `system` → `add-e2e` (confidence 0.85, priority 85)

## SCOPE_EXPANSION_FLOW — 기획 확장 여부 ^scope-expansion

| Gate | Phase | 선택지 | Weight | Mental Model |
|------|-------|--------|--------|-------------|
| completeness | perceive | incomplete, basic, stable | core | boil-the-lake |
| user-feedback | perceive | high-demand, moderate, none | - | proxy-skepticism |
| tech-debt | evaluate | high, moderate, low | - | temporal-depth |
| verdict | decide | expand, maintain, reduce, defer | - | bezos-doors, jobs-subtraction |

- 자동 정책: `incomplete` + `none` → `defer` (confidence 0.85, priority 85)

## STABILIZATION_FLOW — 기능 안정화 ^stabilization

| Gate | Phase | 선택지 | Weight | Mental Model |
|------|-------|--------|--------|-------------|
| bug-frequency | perceive | high, moderate, low | core | munger-inversion |
| performance | evaluate | sla-breach, borderline, healthy | - | edge-paranoia |
| code-quality | evaluate | debt-heavy, acceptable, clean | - | temporal-depth |
| verdict | decide | stable, needs-fix, needs-refactor, redesign | - | bezos-doors, boil-the-lake |

- 자동 정책: `high` → `needs-fix` (confidence 0.9, priority 95)

## ARCHITECTURE_DECISION_FLOW — 아키텍처 결정 ^architecture

| Gate | Phase | 선택지 | Weight | Mental Model |
|------|-------|--------|--------|-------------|
| alternatives | perceive | two, three-plus, single | core | munger-inversion, jobs-subtraction |
| tradeoff | evaluate | clear-winner, balanced, constraint-driven | structural | temporal-depth, boil-the-lake |
| migration-cost | evaluate | none, low, high | - | bezos-doors |
| verdict | decide | option-a, option-b, option-c, defer, spike | - | speed-calibration, narrative-coherence |

## DEV_DECISION_UNITS — 의사결정 단위 ^units

각 플로우에 대해 주제/목적/성공기준/fallback을 정의한다. 결정 완료 후 `flow judge`에서 성공 여부를 판정하는 기준이 된다.

- **test-needed**: 판정 결과가 실제 위험에 비례함 + 판정 후 1주 내 관련 버그 미발생
- **scope-expansion**: 사용자 피드백이 실증거 기반 + 확장 후 사용량 증가 또는 보류 후 자원 효과적 투입
- **stabilization**: 조치 후 버그 빈도 감소 또는 안정 판정 후 1개월 내 인시던트 없음
- **architecture-decision**: 2개 이상 대안 식별 + 선택 후 6개월 내 재설계 없음
- **decision-router**: 결정 유형이 3분 내 분류 + 분류 결과가 실제 필요한 플로우와 일치

fallback 패턴: 판단 불가 시 안전한 기본값으로 전환 (test→통합 테스트, scope→유지, stabilization→개선, architecture→spike, router→custom)

## 자동 정책 구동 방식 ^auto-policy

`DEV_DECISION_POLICIES`는 `FlowPolicy[]` 타입으로 정의된다. 정책 평가 흐름:

1. `FlowEngine.autoSelect(instanceId)` 호출
2. `tryAutoSelect(policies, gateId, context, priorSelections)` — 현재 gate에 적용 가능한 정책 탐색
3. 조건 평가: `gate.{gateId}.branch` 형태로 이전 선택을 컨텍스트에 병합
4. priority 내림차순으로 정렬. 동일 priority + 다른 branch → 충돌(null 반환, 수동 결정)
5. 자동 선택 시 evidence `{ kind: "rule", source: "policy-engine" }` 첨부
6. `autoAdvance(instanceId)` — 수동 결정이 필요한 gate에서 멈출 때까지 연속 자동 처리
