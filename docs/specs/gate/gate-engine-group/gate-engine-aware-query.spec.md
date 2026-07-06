---
def:
  tier: component
  id: gate-engine-aware-query
  address: def_document:v2:68770
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: gate-service
  tags: [security]
  links:
    - target: gate-engine-core
      type: depends_on
  sources:
    - packages/index-meta/src/gate-aware-query.ts
    - packages/index-meta/src/gate-aware-query.test.ts
    - packages/index-meta/src/invalid-ranges.ts
    - packages/index-meta/src/index.ts
    - packages/index-meta/src/workers.ts
    - packages/gate-service/src/lib/gate-service.ts
    - packages/gate-service/src/routes/gate.ts
---
# Gate-Aware Query

## 목적 ^purpose

gate-aware-query — 정책 해소 결과에 gate 상태를 합성하여 최종 허용 범위를 결정하는 질의 레이어.

## 구성 ^overview

- **gateFilterRanges**: 주소 범위에서 gate 차단 범위를 제거하여 유효 범위만 반환
- **3가지 모드**: encodable(active+open), decodable(active+inactive), active(active만)
- **gateAwareResolve**: 이미 계산된 policy 결과와 단일 주소의 gate 상태를 합성하여 `permitted`를 산출
- **buildDenialSpecs**: 정책 거부 position을 DimStateSpec으로 변환해 gate 계산 입력으로 재사용
- **Null gateRecord**: gate 상태가 없으면 전체 active로 간주한다

---

## gateFilterRanges

주소 범위에서 gate 차단 범위를 제거하여 유효 범위만 반환한다.

### 모드

| mode | 반환 범위 | 용도 |
|------|----------|------|
| encodable | active + open | 인코딩 가능한 주소 |
| decodable | active + inactive | 디코딩 가능한 주소 |
| active | active만 | 현재 사용 중인 주소 |

### 정책 합성

1. 정책 해소 결과로 허용 주소 범위를 얻는다.
2. `gateFilterRanges()`로 mode별 gate 차단 범위를 제거한다.
3. `gateAwareResolve()`는 단일 주소 기준으로 policy allow와 gate active 여부를 합성한다.

```
정책 허용 범위:    [0..31]
gate 차단 범위:    [8..15] (inactive), [24..31] (reserved)
최종 encodable:    [0..7] ∪ [16..23]
```

## gateAwareResolve

`gateAwareResolve(policyResult, address, gateRecord)`는 policy가 deny(null)이면 null을 반환한다.
policy가 allow이고 gateRecord가 있으면 address를 reserved/inactive/open/active로 분류한다. active가 아니면 `gateBlocked=true`, `permitted=false`다.
gateRecord가 null이면 gate 미설정으로 보고 policy 결과를 그대로 허용한다.

## buildDenialSpecs

`buildDenialSpecs(deniedPositions, dimIndex, state?)`는 1-based position 목록을 weighted-index constraint로 변환한 뒤 DimStateSpec 배열을 반환한다. 기본 state는 `reserved`이며, 빈 position 목록은 빈 배열을 반환한다.

## gate-service 관계

- gate-service는 AddressStateStore의 저장된 gate record를 조회하는 HTTP 경계다.
- gateEngine이 주입되지 않은 기본 모드에서는 캐시 조회만 수행하고, gate record가 없으면 active로 간주한다.
- gateEngine이 주입되면 `/gate/recompute`와 `/gate/cascade-recompute`가 index-meta GateEngine 재계산을 위임한다.
- `/gate/filter-ranges`는 index-meta의 `gateFilterRanges()`를 사용해 저장된 gate record와 요청 range를 합성한다.
