---
def:
  id: scope-nesting-pattern-lifecycle-plan
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: scope-nesting-pattern-lifecycle
      type: depends_on
    - target: scope-nesting-pattern-lifecycle-todo
      type: depends_on
---

# Scope Nesting Pattern Lifecycle — 구현 계획

## 목적 ^purpose

3단계 파이프라인의 구현 순서와 검증 기준을 단계별로 고정한다.

## 구현 파일

| 파일 | 역할 |
|------|------|
| `packages/core/src/scope-nesting-lifecycle.ts` | 타입 + 3 stage + 합성 함수 |
| `packages/core/src/scope-nesting-lifecycle.test.ts` | 단위 + 통합 테스트 |
| `packages/core/src/index.ts` | re-export 추가 |

## 단계

### P1: 타입 + Stage 1 (snapshotProviders)

1. `ProviderSnapshot`, `ContractTrace`, `DeactivationImpact` 타입 정의
2. `snapshotProviders(nesting, guards?)` 구현
   - nesting.scopes 순회, provides → provider map 구축
   - override 해소: 하위 scope의 override=true가 상위 교체
   - guards?.isEncodable 적용: false → guardFiltered에 기록, providers에서 제외
3. 단위 테스트
   - 기본 provider map 생성
   - override 반영
   - guard 필터링
   - 빈 nesting 처리

### P2: Stage 2 (traceContracts)

1. `traceContracts(nesting, snapshot, scopeId)` 구현
   - snapshot.providers에서 대상 scope가 provider인 계약 필터
   - 각 계약의 consumers 수집 (대상 scope보다 하위인 scope의 consumes)
   - hasAlternative: 대상 scope 외에 같은 계약을 provides하는 scope 존재 여부
2. 단위 테스트
   - 단일 계약 추적
   - 다중 소비자
   - 대체 provider 존재 → hasAlternative=true
   - override로 provider가 아닌 경우 → trace 안 함

### P3: Stage 3 (classifyImpact) + 합성

1. `classifyImpact(nesting, scopeId, traces, snapshot)` 구현
   - traces 기반: hasAlternative=false && consumers 존재 → affected
   - affected scope별 lostContracts 집계
   - 나머지 하위 scope → unaffected
   - 대상/상위 scope는 분류 대상 아님
2. `analyzeDeactivation(nesting, scopeId, guards?)` 합성
3. 통합 테스트
   - 스펙 예시 재현 (qa-bridge 비활성화)
   - guard 통합 (이미 비활성 → guardFiltered)
   - override 대체 → unaffected
   - fail-open (미존재 scopeId)

### P4: Export + 정리

1. `packages/core/src/index.ts`에 re-export
2. spec.md 구현 상태 갱신
3. todo.md 체크 완료

## 검증 기준

| 기준 | 방법 |
|------|------|
| 타입 정합 | `tsc --noEmit` 통과 |
| 테스트 | 전체 scope-nesting 테스트 회귀 없음 |
| 스펙 예시 | qa-bridge 비활성화 결과 정확 일치 |
| fail-open | 미존재 scopeId → 에러 없이 빈 결과 |
| 계보 | traces에 판단 근거 전부 포함 |

## 예상 규모

- 구현: ~120줄 (타입 40 + 로직 80)
- 테스트: ~200줄 (단위 3 describe + 통합 1 describe)
