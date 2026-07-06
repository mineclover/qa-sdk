---
def:
  id: perm-constraint-encoding-selection
  tier: component
  scope: constraint
  aspect: biz_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: permission-engine
  tags: [security]
  links:
    - target: permission-constraint
      type: refines
    - target: perm-codec-system
      type: depends_on
sources:
  - packages/permission-engine/src/permission-codec.ts
  - packages/permission-engine/src/permission-codec.test.ts
  - packages/permission-engine/src/permission-view-cache.ts
  - packages/permission-engine/src/bench-bit-optimization.test.ts
  - packages/bit-index/src/bridge.ts
  - packages/bit-index/src/bridge.test.ts
---
# 권한 제약 — 인코딩 선택 기준

## 목적 ^purpose

PermissionCodec 3-tier 인코딩 중 상황별 선택 가이드를 정의한다. WeightedIndex, BitIndex, IndexBridge, PermissionView의 용도를 구분한다.

## 정의 ^defines

- 3-tier 인코딩 구분 (text, integer, bitmask)
- 상황별 선택 가이드 4가지

## 소비 ^consumes

- `PermissionCodec` (`permission-engine/src/permission-codec.ts`)
- `PermissionView` (`permission-engine/src/permission-codec.ts`)
- `WeightedIndex`, `BitIndex`, `IndexBridge` (`weighted-index`)

## 3-tier 인코딩

| Tier | 형태 | 용도 | 구현 |
|------|------|------|------|
| Tier 1 | text | 사람용, 디버그/로그 | formatPermCode/parsePermCode |
| Tier 2 | integer | 1D 주소 (SemanticAddress) | WeightedIndex encode/decode |
| Tier 3 | bitmask | O(1) 클라이언트 체크 | Uint8Array + hasBit |

## 선택 가이드

- **DB + 범위 질의** → WeightedIndex (Tier 2): 주소 범위로 특정 service/resource의 권한을 질의
- **인메모리 필터** → BitIndex (Tier 3): BitMaskSet.filterByLabel()로 차원별 O(1) 필터
- **양쪽 모두** → IndexBridge: WI ↔ BI 변환. `toBitMaskSet(mask)`, `toUint8Mask(bitSet)`
- **캐시된 반복 질의** → PermissionView: mask 1개당 1회 변환, 이후 모든 필터 O(granted)

## 구현 참조

- 구현: `permission-engine/src/permission-codec.ts`
- 테스트: `permission-engine/src/permission-codec.test.ts`
  - encode/decode 라운드트립: `:23`
  - BitIndex 최적화: `:48`
  - toBitMaskSet 변환: `:63`
  - filterGrants 차원 필터: `:131`
  - PermissionView 캐시: `:204`
- 벤치마크: `permission-engine/src/bench-bit-optimization.test.ts`
