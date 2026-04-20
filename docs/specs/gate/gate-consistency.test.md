---
def:
  id: gate-consistency-test
  level: leaf
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  svc: gate-service
  links:
    - target: gate-consistency
      type: refines
  source: packages/gate-service/src/services/consistency.test.ts
---

## 목적 ^purpose

`createConsistencyService`의 shouldVerify 재확인 흐름, primary direct lookup,
drift 감지, fail-open 에러 격리를 실제 GateEngine과 InMemory store를 사용하여 검증한다.

소스: `packages/gate-service/src/services/consistency.test.ts`

## 사전조건 ^preconditions

- InMemory store 6종 (IndexMeta, PrefixRegistry, EntryFlag, VersionLifecycle, AddressState, AddressRangeCache)
- GateEngine 인스턴스 (recompute 가능)
- GateService (engine 주입 / engine 없음 2가지 모드)
- 테스트 데이터: prefix="role", versionId="v1", capacity=4, entries=["admin", "editor"]
- position 2 (editor) → inactive 설정 후 recompute 완료

## verifyGate ^steps

| 시나리오 | 기대 결과 |
|----------|----------|
| address=0 (active, shouldVerify=false) | cached=active, verified=cached 동일, drifted=false |
| address=2 (open, shouldVerify=true) | primary recompute 후 재확인, 캐시 최신이면 drifted=false |
| 캐시 stale 상태에서 verifyGate | recompute 후 상태 변경 감지, drifted=true |

## verifyGate — engine 없는 모드 ^steps

| 시나리오 | 기대 결과 |
|----------|----------|
| engine 없이 open 주소 verifyGate | cached=open, shouldVerify=true이지만 verified=cached, drifted=false |

## directLookup ^steps

| 시나리오 | 기대 결과 |
|----------|----------|
| engine 있는 모드, address=0 (active) | recompute 후 active 반환, encode=true, decode=true |
| engine 있는 모드, address=1 (inactive) | inactive 반환, encode=false, decode=true |
| engine 없는 모드, address=1 | 캐시 기반 inactive 반환 (fail-open) |

## directClassify ^steps

| 시나리오 | 기대 결과 |
|----------|----------|
| engine 있는 모드, address=0 | "active" 반환 |
| engine 있는 모드, address=2 (open) | "open" 반환 |

## recompute 실패 시 fail-open ^steps

| 시나리오 | 기대 결과 |
|----------|----------|
| recompute가 throw하는 mock gateService + directLookup | onError 호출 + 캐시 결과(active) 반환 |
| recompute가 throw + verifyGate (shouldVerify=true) | cached=verified, drifted=false |

## 존재하지 않는 prefix ^steps

| 시나리오 | 기대 결과 |
|----------|----------|
| nonexistent prefix로 directLookup | active(기본값) 반환, shouldVerify=false |
| nonexistent prefix로 verifyGate | cached.state=active, drifted=false |

## 검증 항목 ^assertions

- 13 tests: verifyGate shouldVerify=false(1), verifyGate shouldVerify=true(1), drift 감지(1), engine 없는 verifyGate(1), directLookup active(1), directLookup inactive(1), directLookup engine 없음(1), directClassify active(1), directClassify open(1), recompute fail-open directLookup(1), recompute fail-open verifyGate(1), missing prefix directLookup(1), missing prefix verifyGate(1)
