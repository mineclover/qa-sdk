---
def:
  id: wi-hex-ops
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [tier-infra]
  links:
    - target: wi-pack-format-def
      type: depends_on
    - target: wi-semantic-address
      type: depends_on
---
# Hex 연산

## 목적 ^purpose

formatHex/parseHex(포맷별 직렬화), hexBoundary/hexCeil/hexFloor(hex 자릿수 경계 연산). 주소를 hex 문자열로 변환하고 자릿수 경계를 계산한다.

## 구성 ^overview

Hex 연산은 2개 레이어로 구성된다.

- **포맷별 직렬화** (`pack-format.ts`) — PackFormat의 groups에 따라 dash를 삽입/제거
- **hex 자릿수 경계** (`pack-format.ts`) — 값이 hex 자릿수 경계에 어떻게 위치하는지 분석
- **난독화 hex** (`obfuscate/hex.ts`) — bitWidth 기반 정수 ↔ hex 변환 (toHex/fromHex)

## 포맷별 hex 직렬화

### formatHex — dash 삽입

PackFormat의 `groups` 정의에 따라 raw hex 문자열에 dash를 삽입한다.

```typescript
formatHex(PACK_FORMATS.uuid, "abcd0100000000000000000000000042")
// → "abcd0100-0000-0000-0000-000000000042"

formatHex(PACK_FORMATS.int64, "abcdef0123456789")
// → "abcdef0123456789"  (groups 없음 → 그대로)
```

### parseHex — dash 제거 + 정규화

dash를 제거하고 소문자로 정규화하여 raw hex를 반환한다.

```typescript
parseHex("ABCD0100-0000-0000-0000-000000000042")
// → "abcd0100000000000000000000000042"
```

## Hex 자릿수 경계 분석

### hexBoundary — 경계 분석

값이 hex 자릿수 경계에서 어디에 위치하는지 분석한다.

```typescript
hexBoundary(1000)
// → { value: 1000, hexChars: 3, hexMax: 4095, hexCapacity: 4096,
//     utilization: 0.244…, nextHexMax: 65535 }
```

| 필드 | 설명 |
|------|------|
| `hexChars` | value를 표현하는 데 필요한 hex 자릿수 |
| `hexMax` | 현재 자릿수의 최댓값 (`16^hexChars - 1`) |
| `hexCapacity` | 현재 자릿수로 수용 가능한 슬롯 수 (`hexMax + 1`) |
| `utilization` | 활용률 (`value / hexCapacity`) |
| `nextHexMax` | 다음 자릿수 레벨의 최댓값 |

### hexCeil — 올림

값을 현재 hex 자릿수 레벨의 ceiling으로 올림 (`16^n`).

```typescript
hexCeil(1000)  // → 4096   (3자리 → 16^3)
hexCeil(4096)  // → 4096   (이미 경계)
hexCeil(4097)  // → 65536  (4자리 필요 → 16^4)
```

### hexFloor — 내림

값을 이전 hex 자릿수 레벨의 floor로 내림 (`16^(n-1)`).

```typescript
hexFloor(1000)  // → 256   (2자리 → 16^2)
hexFloor(256)   // → 256   (이미 경계)
hexFloor(4096)  // → 4096  (이미 경계)
```

## 난독화 hex (obfuscate 레이어)

`toHex(id, bitWidth)` / `fromHex(hex, bitWidth)` — bitWidth 기반으로 zero-padded hex 변환.

```typescript
toHex(255, 10)    // → "0ff"  (10비트 → 3 hex chars)
fromHex("0ff", 10) // → 255
// 라운드트립 보장: fromHex(toHex(id, w), w) === id
```

hex 길이 = `ceil(bitWidth / 4)` 문자. URL, 헤더, DB 컬럼의 opaque 토큰에 적합.

## Capacity Planner에서의 활용

`hexBoundary`는 `capacity-planner.ts`에서 각 차원의 capacity가 hex 자릿수 경계에 어떻게 맞는지 분석하는 데 사용된다. 2의 거듭제곱(16=0x10, 256=0x100, 4096=0x1000)이 hex 자릿수와 자연스럽게 정렬된다.

## 난독화 모듈 (obfuscate/)

WeightedIndex의 정수 주소를 시각적으로 난독화하는 전환사슬(bijection chain). 모든 변환은 가역적이며, 입력 도메인 `[0, 2^bitWidth - 1]` 안에서 전단사(bijection)를 보장한다.

**핵심 원칙**: 암호학적 보안이 아닌 시각적 식별자 변환. 접근 제어, 세션 토큰 등 보안 용도 사용 금지.

### bitWidth 계산

`calcBitWidth(size)` — 주어진 인덱스 공간 `[0, size-1]`을 표현하는 최소 비트 수.

```typescript
calcBitWidth(640)   // → 10  (2^10 = 1024 ≥ 640)
calcBitWidth(1024)  // → 10
calcBitWidth(1025)  // → 11
```

`WeightedIndex.size`에서 결정론적으로 파생되므로 별도 저장 불필요.

### 변환 프리미티브 4종

| 변환 | encode | decode | 자기역원 | 변동 파라미터 |
|------|--------|--------|:--------:|-------------|
| XOR | `xorObfuscate(id, w, key)` | 동일 함수 | ✅ | key (정수, 하위 w비트만 사용) |
| Rotate | `rotateLeft(id, w, amount)` | `rotateRight(token, w, amount)` | ✗ | amount (회전 거리) |
| Reverse | `reverseBits(id, w)` | 동일 함수 | ✅ | 없음 (결정론적) |
| Hex | `toHex(id, w)` / `fromHex(hex, w)` | — | — | — (직렬화 전용) |

- **XOR**: `id ⊕ (key & mask)`. Self-inverse — 두 번 적용하면 원본 복원. 단일 (평문, 암호문) 쌍으로 key 역산 가능
- **Rotate**: 순환 비트 회전. `amount % bitWidth`로 정규화. 0은 항등 변환
- **Reverse**: 비트 순서 반전. 파라미터 없이 결정론적 — 누구나 역산 가능

### 직렬화 형식 3종

| 형식 | 함수 | 출력 길이 | 용도 |
|------|------|----------|------|
| Hex | `toHex`/`fromHex` | `ceil(w/4)` chars | URL, 헤더, DB 컬럼 — 소문자 hex |
| UUID | `toUUID`/`fromUUID` | 36 chars (8-4-4-4-12) | UUID 호환 필수 시스템 연동 |
| NanoId | `toNanoId`/`fromNanoId` | `ceil(w/6)` chars | 최소 길이 URL-safe 토큰 (base64url) |

UUID 변형: `toStructuredUUID(fields)` / `fromStructuredUUID(token, bitWidths)` — 여러 필드를 비트 패킹하여 dash 구분 compact 토큰 생성.

```typescript
// version(4bit) + namespace(8bit) + id(10bit) = 22bit → 6 hex chars
toStructuredUUID([
  { value: 2, bitWidth: 4 },
  { value: 7, bitWidth: 8 },
  { value: 42, bitWidth: 10 },
])
// → "2070-a8"
```

### 변환 합성 (compose)

`compose(...transforms)` — 여러 `ObfuscateTransform`을 왼쪽→오른쪽으로 체이닝. 각 변환이 전단사면 합성도 전단사.

```typescript
type ObfuscateTransform = (id: number, bitWidth: number) => number;

// encode 체인
const enc = compose(
  (id, w) => rotateLeft(id, w, 3),
  (id, w) => xorObfuscate(id, w, 0xA3),
);
// decode 체인 — 역순 + 역변환
const dec = compose(
  (id, w) => xorObfuscate(id, w, 0xA3),  // XOR은 자기역원
  (id, w) => rotateRight(id, w, 3),       // rotateLeft의 역
);
// 라운드트립: dec(enc(id, w), w) === id
```

빈 compose는 항등 변환 반환.

## 소스 위치

- `packages/weighted-index/src/protocol/pack-format.ts` (formatHex, parseHex, hexBoundary, hexCeil, hexFloor)
- `packages/weighted-index/src/obfuscate/` (난독화 모듈 전체)
  - `bit-width.ts` (calcBitWidth)
  - `xor.ts`, `rotate.ts`, `reverse.ts` (변환 프리미티브)
  - `hex.ts`, `uuid.ts`, `nanoid.ts` (직렬화 형식)
  - `compose.ts` (변환 합성)
  - `index.ts` (public re-export)
