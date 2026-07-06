---
def:
  id: gate-consistency
  tier: system
  scope: flow
  aspect: gate_flow
  depth: specification
  lifecycle: approved
  layer: operation
  svc: gate-service
  links:
    - target: gate-api
      type: traces_to
    - target: gate-consistency-test
      type: contains
    - target: gate-system
      type: depends_on
contains:
  - gate-consistency-test
sources:
  - packages/gate-service/src/services/consistency.ts
  - packages/gate-service/src/services/consistency.test.ts
  - packages/gate-service/src/lib/gate-service.ts
  - packages/index-meta/src/gate-engine.ts
---
# Consistency 서비스

## 목적 ^purpose

gate-service의 일관성 모델을 구현한다.
shouldVerify 재확인 흐름(캐시 기반 checkGate가 open 상태를 반환하면 primary에서 직접 재계산)과
Primary direct lookup(캐시 우회 최신 상태 보장)을 제공한다.
GateEngine이 없으면(읽기 전용 캐시 모드) 캐시 결과를 그대로 반환한다 (fail-open).

## ^defines

**함수**

- `createConsistencyService(deps: ConsistencyServiceDeps): ConsistencyService`

**인터페이스**

- `ConsistencyService`
  - `verifyGate(prefix, versionId, address): Promise<VerifyResult>` — shouldVerify 재확인 흐름
  - `directLookup(prefix, versionId, address): Promise<GateResult>` — primary direct lookup, 캐시 우회
  - `directClassify(prefix, versionId, address): Promise<AddressState>` — primary direct classify, 캐시 우회

- `VerifyResult`
  - `cached: GateResult` — 캐시 기반 결과
  - `verified: GateResult` — primary 재확인 결과 (engine 없으면 cached와 동일)
  - `drifted: boolean` — 캐시와 primary 결과가 다른지 여부

- `ConsistencyServiceDeps`
  - `gateService: GateLookupService`
  - `onError?: (error: unknown, context: string) => void`

**verifyGate 흐름**

```
1. checkGate(prefix, versionId, address) → cached
2. shouldVerify=false → { cached, verified: cached, drifted: false } (캐시 신뢰)
3. engine 없음   → { cached, verified: cached, drifted: false } (fail-open)
4. recompute(prefix, versionId) 시도
   4a. 실패 → { cached, verified: cached, drifted: false } (fail-open)
   4b. 성공 → checkGate 재조회 → verified
5. drifted = (state/encode/decode 중 하나라도 다르면 true)
```

**directLookup / directClassify 흐름**

```
1. engine 있으면 recompute(prefix, versionId) 시도 (실패해도 계속)
2. checkGate / classifyAddress 조회
```

## ^consumes

- `packages/gate-service/src/services/consistency.ts` — createConsistencyService, VerifyResult
- `packages/gate-service/src/lib/gate-service.ts` — GateLookupService, GateResult
- `index-meta` — GateResult, AddressState

## 설계 결정

- **shouldVerify**: open 상태는 캐시가 stale할 가능성이 있으므로 shouldVerify=true를 반환한다
- **fail-open 3단계**: engine 없음 → 캐시 반환, recompute 실패 → 캐시 반환, 성공 → 재조회
- **drift 감지**: state, encode, decode 3개 필드를 비교하여 캐시 불일치를 감지한다
- **읽기 전용 모드**: gate-service는 읽기 전용 캐시 서비스이므로, primary lookup은 "recompute → 캐시 갱신 → 재조회" 시퀀스로 구현한다
