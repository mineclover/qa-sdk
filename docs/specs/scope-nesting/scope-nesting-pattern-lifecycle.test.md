---
def:
  tier: component
  id: scope-nesting-pattern-lifecycle-test
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  layer: domain
  tags: [testing]
  links:
    - target: scope-nesting-pattern-lifecycle
      type: verifies
sources:
  - packages/core/src/scope-nesting-lifecycle.ts
  - packages/core/src/scope-nesting-lifecycle.test.ts
---

# Scope Lifecycle 패턴 테스트 명세

## 목적 ^purpose

3단계 파이프라인(snapshotProviders → traceContracts → classifyImpact)의 각 단계와 합성 함수가 정확히 동작하고, 데이터 계보가 올바르게 전달되는지 검증한다.

## 전제 ^preconditions

- playbook fixture: qa-bridge(logging) → feature-context(state, persist) → handlers(adapter) → view
- guards: SimulationGuards 선택 주입 (미주입 시 fail-open)
- override fixture: parent → child(override) → consumer

## 테스트 시나리오

### Stage 1: snapshotProviders (4 tests)

| # | 시나리오 | 의도 | 검증 |
|---|---------|------|------|
| S1-1 | 기본 provider map | nesting → 평탄화된 provider 매핑이 정확한가 | 4개 계약 각각의 scopeId, depth |
| S1-2 | guard 필터링 | isEncodable=false 계약이 providers에서 빠지고 guardFiltered에 기록되는가 | logging-session 제외, guardFiltered 포함 |
| S1-3 | override 반영 | 하위 scope의 override=true가 상위 provider를 교체하는가 | child가 최종 provider |
| S1-4 | 빈 nesting | scopes=[] 시 빈 결과 반환 (에러 없음) | providers 0, guardFiltered 0 |

### Stage 2: traceContracts (5 tests)

| # | 시나리오 | 의도 | 검증 |
|---|---------|------|------|
| S2-1 | 단일 계약 추적 | qa-bridge의 logging-session 소비자가 정확히 추적되는가 | feature-context + handlers, hasAlternative=false |
| S2-2 | 다중 계약 추적 | feature-context의 state + persist 소비자가 각각 분리 추적되는가 | state: 2소비자, persist: 0소비자 |
| S2-3 | 대체 provider | 같은 계약을 제공하는 다른 scope가 있으면 hasAlternative=true | duplicate provider → true |
| S2-4 | 미존재 scopeId | 없는 scope → 빈 결과 (fail-open) | traces=[] |
| S2-5 | override로 provider 아닌 경우 | override당한 scope는 trace 대상 아님 | traces=[] |
| S2-6 | required=false 소비자 | optional consume의 required 플래그가 추적에 반영되는가 | consumer.required=false |

### Stage 3: classifyImpact (3 tests)

| # | 시나리오 | 의도 | 검증 |
|---|---------|------|------|
| S3-1 | affected/unaffected 분류 | 대체 없는 계약의 소비자 → affected, 나머지 → unaffected | feature-context, handlers affected / view unaffected |
| S3-2 | 대체 provider → unaffected | hasAlternative=true인 trace의 소비자는 영향 안 받음 | affected=0, 전부 unaffected |
| S3-3 | 계보 포함 | traces 참조가 결과에 그대로 전달되는가 | impact.traces === traces |

### 합성: analyzeDeactivation (6 tests)

| # | 시나리오 | 의도 | 검증 |
|---|---------|------|------|
| I-1 | 스펙 예시 재현 | qa-bridge 비활성화 → 스펙 문서의 기대 결과와 정확히 일치 | affected 2개, unaffected ["view"], traces 1개 |
| I-2 | guard 통합 | logging-session이 guard 비활성 → 영향 없음 | affected 0, guardFiltered ["logging-session"] |
| I-3 | feature-context 비활성화 | 중간 scope 제거 시 state/persist 소비자 추적 | handlers, view affected (playbook-state) |
| I-4 | leaf scope 비활성화 | view(provides 없음) 제거 → 아무 영향 없음 | affected 0 |
| I-5 | fail-open | 미존재 scopeId → 빈 결과 | affected 0, unaffected 4 |
| I-6 | override 통합 | override provider 비활성화 시 원래 provider가 대체 | hasAlternative=true, affected 0 |

## 검증 기준 ^assertions

- 각 stage 독립 테스트 가능 (stage 간 결합 없음)
- 계보: 최종 DeactivationImpact.traces에 판단 근거 계약별 추적 전부 포함
- 노이즈 제거: guardFiltered에 guard로 제외된 계약 기록
- fail-open: 미존재 입력 → 에러 없이 빈 결과
- 파이프라인 합성 = 개별 stage 순차 실행과 동일 결과

## 구현 위치

`packages/core/src/scope-nesting-lifecycle.test.ts` — 19 tests (4 + 6 + 3 + 6)
