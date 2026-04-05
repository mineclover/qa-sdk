---
def:
  id: scope-nesting-pattern-lifecycle-todo
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: scope-nesting-pattern-lifecycle
      type: depends_on
    - target: scope-nesting-provider-patterns
      type: depends_on
---

# Scope Nesting Pattern Lifecycle — 구현 TODO

## 목적 ^purpose

scope 비활성화 영향 분석 파이프라인 구현 현황을 추적한다.

## 선행 조건 — 충족

- [x] 패턴 1: Override — 구현됨 (`scope-nesting.ts` buildProviderMap)
- [x] 패턴 2: Optional — 구현됨 (`scope-nesting.ts` consumer validation)
- [x] 패턴 3: Resolution — 구현됨 (`scope-nesting.ts` resolveContracts)
- [x] 테스트 fixture 정비 — entryPipeId 보강 완료 (2026-04-05)

## Stage 1: snapshotProviders (범용) — 완료 (2026-04-05)

- [x] ProviderSnapshot 타입 정의
- [x] nesting → provider 평탄화 (override 해소)
- [x] guards 적용 — isEncodable false 계약 필터링
- [x] guardFiltered 목록 수집
- [x] 단위 테스트 4건: provider map, guard 필터링, override 반영, 빈 nesting

## Stage 2: traceContracts (범용) — 완료 (2026-04-05)

- [x] ContractTrace 타입 정의
- [x] 대상 scope가 최종 provider인 계약 필터
- [x] 하위 scope의 소비자 추적
- [x] hasAlternative 판정 (대체 provider 탐지)
- [x] 단위 테스트 6건: 소비자 추적, 대체 provider, override 제외, 미존재 scope, required 플래그

## Stage 3: classifyImpact (deactivation 전용) — 완료 (2026-04-05)

- [x] DeactivationImpact 타입 정의
- [x] affected/unaffected 분류 로직
- [x] traces/guardFiltered 계보 포함
- [x] 단위 테스트 3건: 분류, 대체 provider, 계보 포함

## 합성 + 통합 — 완료 (2026-04-05)

- [x] analyzeDeactivation 편의 함수
- [x] index.ts re-export
- [x] 통합 테스트 6건: 스펙 예시, guard, feature-context/view/nonexistent, override
