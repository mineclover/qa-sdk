---
def:
  id: gate-consistency-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  svc: gate-service
  tags: [scenario, gate, consistency]
  links:
    - target: gate-consistency
      type: refines
    - target: gate-system
      type: depends_on
sources:
  - packages/gate-service/src/services/consistency.ts
  - packages/gate-service/src/services/consistency.test.ts
  - packages/gate-service/src/lib/gate-service.ts
  - packages/index-meta/src/gate-engine.test.ts
---

# Gate Consistency — 소비자 기대 시나리오

## 목적 ^purpose

`gate-consistency`(shouldVerify 재확인, direct lookup, fail-open)가 `gate-system`에 의존할 때 기대하는 계약. consistency 서비스는 gate-system의 4-state 모델과 GateEngine recompute 경로가 안정적으로 제공되어야 동작한다.

## 시나리오 1: 4-state 분류 완전성 ^overview

**전제**: `gate-system`의 `gate-state-model`이 active/inactive/open/reserved 4개 상태만 정의한다.

**동작**: `directClassify(prefix, versionId, address)` 호출.

**기대**:
- 반환 값이 4개 상태 중 하나 (unknown/pending 등 중간 상태 없음)
- 존재하지 않는 prefix에 대해 기본값 `active` 반환 (fail-open, CON-006)
- 상태가 추가되면 gate-consistency 타입 에러로 감지 (Exhaustive switch)

**실패 시 수정 대상**: `gate-system`의 `gate-state-model` 스펙. 상태 집합 변경 시 consistency 서비스의 classify 스위치가 exhaustive 하도록 TypeScript discriminated union 사용.

## 시나리오 2: GateEngine recompute 계약 ^overview

**전제**: `gate-system`이 `gate-engine-func`을 통해 recompute API를 제공한다.

**동작**: `verifyGate`가 `shouldVerify=true` 판정 시 `engine.recompute(prefix, versionId)` 호출.

**기대**:
- recompute 완료 후 캐시가 최신 상태를 반영
- recompute 실패 → throw (consistency가 catch하여 fail-open 진입)
- 같은 prefix/version 에 대해 concurrent recompute 호출은 직렬화 또는 dedup

**실패 시 수정 대상**: `gate-system`의 `gate-engine-func`. recompute 동시성 정책(lock 또는 request coalescing)을 스펙에 명시해야 fail-open 경로가 예측 가능.

## 시나리오 3: open 상태 shouldVerify 규칙 ^overview

**전제**: `gate-system`의 `gate-flow`가 "open 상태는 캐시가 stale 가능"을 전제한다.

**동작**: address가 `open` 상태로 캐시되어 있을 때 `verifyGate` 호출.

**기대**:
- `shouldVerify = true` 자동 반환
- primary recompute 재조회 수행
- drift 있으면 `drifted = true`, 상태 갱신된 verified 반환

**실패 시 수정 대상**: `gate-system`의 `gate-flow` 스펙. open → shouldVerify 규칙이 gate-system 레벨에서 명문화되지 않으면 consistency가 로컬 판단으로 가지게 되어 정책 이원화.

## 시나리오 4: 읽기 전용 모드 fail-open ^overview

**전제**: `gate-system`은 gate-service가 engine 없이 읽기 전용 모드로 동작 가능함을 허용한다.

**동작**: `createConsistencyService({ gateService, engine: undefined })`로 초기화.

**기대**:
- `verifyGate` → `{ cached, verified: cached, drifted: false }` 반환
- `directLookup` → 캐시 결과 반환 (recompute 스킵)
- 내부적으로 engine 부재를 감지하여 단일 경로 처리 (분기 단순화)

**실패 시 수정 대상**: `gate-system`의 운영 모드 (읽기 전용 vs 읽기-쓰기) 정의. 모드 전환 시 어떤 기능이 degradation 되는지 스펙에 명시.
