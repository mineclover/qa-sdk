---
def:
  id: scope-nesting-pattern-lifecycle
  level: module
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [structural]
  links:
    - target: scope-nesting-provider-patterns
      type: refines
    - target: scope-nesting-guide
      type: depends_on
    - target: scope-nesting-pattern-lifecycle-plan
      type: contains
    - target: scope-nesting-pattern-lifecycle-todo
      type: contains
    - target: scope-nesting-pattern-lifecycle-test
      type: contains
---

# Scope Lifecycle 패턴 — 비활성화 영향 분석 파이프라인

## 목적 ^purpose

scope 비활성화 시 하위에 어떤 영향이 있는지 사전 분석하는 파이프라인 API를 정의한다. L0 guard의 동적 변화에 대응하며, 각 단계가 독립 관측·재사용 가능하고 데이터 계보를 추적한다.

## 정의 ^defines

- **snapshotProviders()** — provider 스냅샷 생성 (범용)
- **traceContracts()** — 계약별 소비자 추적 (범용)
- **classifyImpact()** — 영향/무영향 분류 (deactivation 전용)
- **analyzeDeactivation()** — 3단계 합성 편의 함수
- **ProviderSnapshot** — provider 매핑 + guard 필터 결과
- **ContractTrace** — 계약별 추적 데이터 (provider, consumers, 대체 여부)
- **DeactivationImpact** — 최종 분류 + 계보

## 소비 ^consumes

- `ScopeNesting` / `SimulationGuards` (`@qa-sdk/core`)

## 파이프라인 설계

```
ScopeNesting + guards?
  → [1] snapshotProviders   → ProviderSnapshot
  → [2] traceContracts      → ContractTrace[]
  → [3] classifyImpact      → DeactivationImpact
```

### Stage 1: snapshotProviders (범용)

nesting의 provider 구조를 평탄화한다. guards가 있으면 비활성 계약을 필터링한다.

```typescript
function snapshotProviders(
  nesting: ScopeNesting,
  guards?: SimulationGuards,
): ProviderSnapshot;

interface ProviderSnapshot {
  /** contractId → provider 정보 (override 해소 후 최종 provider) */
  providers: Record<string, { scopeId: string; depth: number }>;
  /** guard에 의해 이미 비활성인 계약 목록 */
  guardFiltered: string[];
}
```

- override 해소: 같은 contractId를 override하는 하위 scope가 있으면 해당 provider로 교체
- guard 필터: `isEncodable(contractId) === false`인 계약은 providers에서 제외, guardFiltered에 기록

### Stage 2: traceContracts (범용)

특정 scope가 제공하는 계약의 소비자를 추적한다.

```typescript
function traceContracts(
  nesting: ScopeNesting,
  snapshot: ProviderSnapshot,
  scopeId: string,
): ContractTrace[];

interface ContractTrace {
  contractId: string;
  provider: { scopeId: string; depth: number };
  consumers: Array<{ scopeId: string; depth: number; required: boolean }>;
  /** 대상 scope 제거 후에도 대체 provider 존재 여부 */
  hasAlternative: boolean;
}
```

- 대상 scope가 최종 provider인 계약만 추적 (override로 대체된 것 제외)
- consumers: 해당 계약을 consumes하는 하위 scope 전부
- hasAlternative: 대상 제거 시 같은 계약을 제공하는 다른 scope 존재 여부

### Stage 3: classifyImpact (deactivation 전용)

trace 결과를 affected/unaffected로 분류한다.

```typescript
function classifyImpact(
  nesting: ScopeNesting,
  scopeId: string,
  traces: ContractTrace[],
  snapshot: ProviderSnapshot,
): DeactivationImpact;

interface DeactivationImpact {
  deactivated: string;
  affected: Array<{ scopeId: string; lostContracts: string[] }>;
  unaffected: string[];
  /** 판단 근거 — 계약별 추적 데이터 */
  traces: ContractTrace[];
  /** guard로 제외된 계약 (노이즈 제거 근거) */
  guardFiltered: string[];
}
```

- hasAlternative === false && consumers 존재 → 해당 consumers는 affected
- affected scope의 lostContracts에 해당 contractId 추가
- 대상 scope 자신과 대상 이전(상위) scope는 affected/unaffected 어디에도 포함 안 함
- traces/guardFiltered: 판단 근거 계보 전체 포함

### 합성 편의 함수

```typescript
function analyzeDeactivation(
  nesting: ScopeNesting,
  scopeId: string,
  guards?: SimulationGuards,
): DeactivationImpact;
```

내부: `snapshotProviders → traceContracts → classifyImpact` 순차 실행.

## 파이프라인 특성

| 속성 | 설계 |
|------|------|
| 분리 관측 | 각 stage 독립 export → 단위 테스트 + 중간 결과 로깅 |
| 범용 재사용 | snapshotProviders, traceContracts는 deactivation 외 분석에도 사용 가능 |
| 데이터 계보 | DeactivationImpact.traces에 판단 근거 전체 포함 |
| 노이즈 제거 | guardFiltered로 "왜 이 계약이 빠졌는지" 추적 가능 |
| fail-open | 존재하지 않는 scopeId → 빈 결과 (에러 없음) |

## 적용 예시

```
analyzeDeactivation(nesting, "qa-bridge")
→ {
    deactivated: "qa-bridge",
    affected: [
      { scopeId: "feature-context", lostContracts: ["logging-session"] },
      { scopeId: "handlers", lostContracts: ["logging-session"] },
    ],
    unaffected: ["view"],
    traces: [
      {
        contractId: "logging-session",
        provider: { scopeId: "qa-bridge", depth: 0 },
        consumers: [
          { scopeId: "feature-context", depth: 1, required: true },
          { scopeId: "handlers", depth: 2, required: true },
        ],
        hasAlternative: false,
      },
    ],
    guardFiltered: [],
  }
```

## 구현 위치

- `packages/core/src/scope-nesting-lifecycle.ts`
- `packages/core/src/scope-nesting-lifecycle.test.ts` (19 tests)
- `packages/core/src/index.ts` re-export

## 구현 상태

구현 완료 (2026-04-05). 19 tests 전부 통과, 기존 1039 tests 회귀 없음.
