---
def:
  id: permission-model-ternary-mask
  tier: component
  scope: state
  aspect: domain_state
  depth: specification
  lifecycle: approved
  layer: domain
  svc: permission-engine
  tags: [security]
  links:
    - target: permission-model
      type: refines
    - target: perm-codec-stack
      type: depends_on
sources:
  - packages/permission-engine/src/ternary-mask.ts
  - packages/permission-engine/src/ternary-mask.test.ts
  - packages/bit-index/src/bit-index.ts
  - packages/bit-index/src/bit-index.test.ts
---
# 권한 모델 — TernaryMask

## 목적 ^purpose

binary mask만으로는 표현할 수 없는 allow/deny/unset 3상태 권한 판정을 `TernaryMask`로 정의한다. 상속 체인과 default policy 해석의 핵심 규칙을 분리한다.

## 구성 ^overview

- 3상태 정의: allow / deny / unset
- 단일 조작: allow, deny, unset, get
- 최종 판정: `check(id, defaultPolicy)`
- 상속 merge: `inherit(parent, child, { denyWins })`
- binary 변환: `toBinaryMask()`

## 3상태 정의

| 상수 | 값 | allowBit | denyBit | 의미 |
|------|----|----------|---------|------|
| `ALLOW` | `1` | 1 | 0 | 명시적 허용 |
| `DENY` | `-1` | 0 | 1 | 명시적 거부 |
| `UNSET` | `0` | 0 | 0 | 미설정 |

- `allow=1, deny=1` 충돌 시 기본은 **deny-wins**

## 생성과 크기

```typescript
const mask = new TernaryMask(40);
const mask = new TernaryMask(40, allowArr, denyArr);
```

슬롯당 2비트이므로 크기는 `ceil(N/8) × 2 bytes`.

## 단일 조작

| 메서드 | 동작 |
|--------|------|
| `allow(id)` | allowBit=1, denyBit=0 |
| `deny(id)` | allowBit=0, denyBit=1 |
| `unset(id)` | allowBit=0, denyBit=0 |
| `get(id)` | `TriState` 반환 |

## 최종 판정

```typescript
mask.check(id, "deny");
mask.check(id, "allow");
```

- `ALLOW` → true
- `DENY` → false
- `UNSET` → default policy에 따라 해석

## 상속 merge

```typescript
const resolved = TernaryMask.inherit(parent, child, { denyWins: true });
```

- child가 ALLOW/DENY면 child 우선
- child가 UNSET이면 parent 상속
- `denyWins=true`이면 어느 쪽이든 DENY가 있으면 최종 DENY

## 통계와 변환

| 속성/메서드 | 설명 |
|-------------|------|
| `allowCount` | 허용 비트 수 |
| `denyCount` | 거부 비트 수 |
| `unsetCount` | 미설정 슬롯 수 |
| `toBinaryMask("deny")` | UNSET→0 |
| `toBinaryMask("allow")` | UNSET→1 |
| `clone()` | deep copy |
