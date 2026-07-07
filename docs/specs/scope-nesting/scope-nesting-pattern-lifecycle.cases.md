---
def:
  id: scope-nesting-pattern-lifecycle-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  tags: [scenario, scope-nesting, lifecycle]
  links:
    - target: scope-nesting-pattern-lifecycle
      type: refines
    - target: scope-nesting-system
      type: depends_on
sources:
  - packages/core/src/scope-nesting-lifecycle.ts
  - packages/core/src/scope-nesting-lifecycle.test.ts
  - packages/core/src/scope-nesting.ts
---

# Scope Lifecycle 패턴 — 소비자 기대 시나리오

## 목적 ^purpose

`scope-nesting-pattern-lifecycle`(scope 비활성화 영향 분석 파이프라인: snapshotProviders / traceContracts / classifyImpact / analyzeDeactivation)이 `scope-nesting-system`에 의존할 때 기대하는 계약. 파이프라인은 scope-nesting-system 이 제공하는 ScopeNesting, SimulationGuards, contract descent 규칙 위에서 독립 관측·재사용 가능해야 한다.

## 시나리오 1: snapshotProviders provider 매핑 + guard 필터 ^overview

**전제**: `scope-nesting-system`의 `ScopeNesting`이 provider/consumer 선언 + guard 조건을 보유한다.

**동작**: `snapshotProviders(scope, guards?)` 호출.

**기대**:
- 입력 scope 트리의 모든 provider 를 수집
- guard 미통과 provider 는 result 에서 제외하되 별도 `skipped` 배열로 계보 기록
- 같은 scope 입력 → 같은 snapshot (결정론적)

**실패 시 수정 대상**: `scope-nesting-system.md` §"정의" — ScopeNesting 의 provider 선언 구조가 변경되면 snapshotProviders 의 결과가 변동. stable shape 보장 필요.

## 시나리오 2: traceContracts consumer 추적 + 대체 여부 ^overview

**전제**: `scope-nesting-system`의 `ContractRef.delegatesTo`가 계약 위임을 지원.

**동작**: `traceContracts(snapshot)` 호출로 계약별 consumer 추적.

**기대**:
- 각 계약의 consumer 목록과 대체 provider 존재 여부 반환
- delegatesTo 체인이 있으면 계보 경로 전체 기록 (중간 hop 포함)
- 순환 delegatesTo 감지 시 error (scope-nesting 검증 규칙)

**실패 시 수정 대상**: `scope-nesting-system.md` §"DelegationRef" — 순환 위임 검증이 scope-nesting-system 에서 수행되지 않으면 파이프라인이 무한 루프.

## 시나리오 3: classifyImpact 영향/무영향 분류 ^overview

**전제**: `scope-nesting-system`이 contract descent 경로를 명시.

**동작**: `classifyImpact(traces)` 호출로 deactivation 시 영향 분석.

**기대**:
- 대체 provider 존재 → 무영향(`no_impact`)
- 대체 없음 → 영향(`impacted`) + 하위 consumer 목록
- 부분 대체 → warning (`partial_impact`) + 대체된/안된 consumer 분리

**실패 시 수정 대상**: `scope-nesting-system.md`의 contract descent 정의 — 부분 대체(partial) 상태가 contract descent 스펙에 정의되지 않으면 classifyImpact 가 partial 상황을 fully impacted 로 오판.

## 시나리오 4: analyzeDeactivation 3단계 합성 ^overview

**전제**: `scope-nesting-system`이 L0 guard 의 동적 변화에 대응하는 5계층 simulation 모델을 제공.

**동작**: `analyzeDeactivation(scope, guards)` 편의 함수 호출 — snapshot + trace + classify 순차 실행.

**기대**:
- 3단계가 독립 호출 가능 (중간 결과 관측 가능)
- 합성 결과(DeactivationImpact) 에 계보 포함 (어느 단계에서 왜 impacted/no_impact 판정했는지)
- guard 변경 시 재실행으로 영향도 재평가 가능

**실패 시 수정 대상**: `scope-nesting-system.md`의 L0 guard 정의 — guard 가 scope-nesting-system 의 정식 확장 포인트가 아니면 파이프라인이 guard 변경을 반영 못함.
