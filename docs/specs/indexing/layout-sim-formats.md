---
def:
  id: layout-sim-formats
  address: def_document:v1:2673
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [tier-infra]
  links:
    - target: bigint-addressing
      type: depends_on
---

# 레이아웃 시뮬레이터 — 포맷 선택 및 인덱스 타입 가이드

## 목적 ^purpose

UUID만이 아닌 다양한 PackFormat에서 차원 배치를 시뮬레이션하고,
인덱스 저장 타입(Number vs BigInt)에 따른 도달 가능 범위를 시각화한다.

## 구성 ^overview

- **지원 포맷 5종**: int64(64bit), objectId(96bit), uuid(128bit), sha1(160bit), sha256(256bit) — 각 포맷별 hex chars와 Number 커버 범위가 다름
- **인덱스 타입 자동 결정**: indexBudget ≤ 13 hex chars(52bit)이면 Number 허용, 초과 시 BigInt 필수 — 수동 토글 불필요
- **BigInt 필수 근거**: Number는 2^53 직후부터 정밀도 손실 발생, BigInt는 128bit 전체를 정확히 표현하며 성능도 ~2x로 실용적
- **LayoutSimConfig 확장**: format 파라미터 추가로 totalChars가 포맷에서 자동 결정되고 indexBudget/indexType이 파생
- **구조 바 시각화**: Number 갭과 index fill ratio를 오버레이하여 실제 사용량 대비 인덱스 영역을 시각적으로 표현
- **Number 다중 결합 보류**: 116bit를 Number 청크로 분할하는 방식은 BigInt 나눗셈이 결국 필요하므로 복잡도 대비 이점 없음

## 1. 배경

레이아웃 시뮬레이터는 원래 UUID(128bit) 전용이었다.
BigInt 탐사 테스트(`layout-fit-bigint.test.ts`)를 통해 확인된 사실:

- Number(`2^53-1`)는 UUID index 예산(최대 128bit)의 극히 일부만 커버
- BigInt는 128bit 전체를 정확히 표현하며 성능도 Number 대비 ~2x로 실용적
- **결론: UUID 인덱스는 반드시 BigInt를 사용해야 한다**

이로부터 파생된 설계 필요:

1. UUID 외에 Number로 완전히 커버 가능한 포맷(int64 등)도 시뮬레이션 지원
2. 포맷 선택에 따라 index budget, effectiveMax, Number 갭이 자동 결정
3. 차원 슬라이더 최대 시 실제 사용량이 index 영역 위에 시각화

## 2. 지원 포맷

기존 `PackFormat` 시스템(`pack-format.ts`)의 5개 포맷:

| 포맷 | hex chars | bits | Number 커버 | 인덱스 타입 권장 |
|------|----------|------|-------------|---------------|
| int64 | 16 | 64 | 13ch까지 OK (budget ≤ 13이면 완전) | Number (budget ≤ 13) |
| objectId | 24 | 96 | 부분 | BigInt |
| uuid | 32 | 128 | 부분 | **BigInt 필수** |
| sha1 | 40 | 160 | 부분 | BigInt |
| sha256 | 64 | 256 | 부분 | BigInt |

### Number 완전 커버 조건

`indexBudget ≤ 13` hex chars (52 bits) 이면 `16^budget ≤ Number.MAX_SAFE_INTEGER`.

- int64 (16ch): prefix 3ch + budget 13ch → Number 완전 커버 가능
- uuid (32ch): prefix 3ch + budget 29ch → Number 불가, BigInt 필수

## 3. 인덱스 타입 가이드

### 원칙

```
indexBudget ≤ 13  →  Number 허용 (정밀도 손실 없음)
indexBudget > 13  →  BigInt 필수 (Number는 2^53 한계)
```

### 증명 (layout-fit-bigint.test.ts)

| 테스트 | 증명 |
|--------|------|
| `MAX_SAFE_INTEGER + 1 === MAX_SAFE_INTEGER + 2` | Number는 2^53 직후부터 정밀도 손실 |
| `BigInt(MAX_SAFE_INTEGER) + 1n !== +2n` | BigInt는 정확 |
| BigInt encode/decode 라운드트립 (10^20 공간) | Number가 깨지는 영역에서 BigInt 정확 |
| BigInt decode 15.7M ops/s | Number 대비 ~2x, 실용적 |

### 시뮬레이터 동작

| 포맷 선택 | indexBudget | 인덱스 타입 | Number 갭 |
|-----------|------------|------------|-----------|
| int64, prefix=3ch | 13 | Number (auto) | 0 bits |
| int64, prefix=0ch | 16 | BigInt (auto) | 12 bits |
| uuid, prefix=3ch | 29 | BigInt (auto) | 63 bits |
| uuid, prefix=19ch | 13 | Number (auto) | 0 bits |

**자동 결정**: `indexBudget > 13`이면 BigInt 모드 강제. 수동 토글 불필요.

## 4. LayoutSimConfig 확장

기존:
```typescript
interface LayoutSimConfig {
  prefixChars: number;
  versionChars: number;
  shardChars: number;
  numDims: number;
}
```

확장:
```typescript
interface LayoutSimConfig {
  format: PackFormat | BuiltinFormatName;  // 포맷 선택
  prefixChars: number;
  versionChars: number;
  shardChars: number;
  numDims: number;
}
```

`format`에서 `totalChars`가 결정되고, 나머지는 기존과 동일:
```
indexBudget = format.chars - prefixChars - versionChars - shardChars
indexType   = indexBudget > 13 ? "bigint" : "number"
```

## 5. LayoutViewModel 확장

기존 `mode: "number" | "bigint"` 수동 토글 → **자동 결정**:

```typescript
interface LayoutViewModel {
  // ... 기존 필드 ...
  formatName: string;           // "uuid", "int64", ...
  formatChars: number;          // 포맷 전체 hex chars
  indexType: "number" | "bigint"; // indexBudget 기반 자동 결정

  // 차원 슬라이더 최대 시 index 영역 사용률
  indexFillRatio: number;       // product / effectiveMax (0~1), 구조 바 오버레이용
}
```

## 6. 구조 바 시각화 (UI 가이드)

Number 갭 + index fill 오버레이:

```
int64, prefix=3ch, budget=13ch, Number 모드:
┌────────────┬─────────────────────────────────────────────┐
│ prefix 3ch │              index 13ch                     │
│            │  ████████████████░░░░░░░░░░  (활용률 60%)    │
└────────────┴─────────────────────────────────────────────┘

uuid, prefix=3ch, budget=29ch, BigInt 모드:
┌────────────┬───────────────────┬────────────────────────┐
│ prefix 3ch │  Number 갭 63bit  │     index 53bit        │
│            │  (BigInt 사용)    │  ████░░░░  (활용 12%)   │
└────────────┴───────────────────┴────────────────────────┘
```

`indexFillRatio`는 `product / effectiveMax`로 계산.
구조 바의 index 세그먼트 안에 fill bar로 오버레이.

## 7. 구현 순서

1. `computeLayoutViewModel`에 `formatChars`, `indexType`, `indexFillRatio` 추가
2. `analyzeLayoutSim`에 `format` 파라미터 지원 (하위호환: 미지정 시 uuid)
3. 테스트: 포맷별 indexType 자동 결정 검증
4. UI: 포맷 선택 드롭다운, index fill 오버레이 (추후)

## 8. Number 다중 결합 (보류)

116bit index를 Number 청크 3개([53, 53, 10])로 분할하는 방식은
저장/전송에는 가능하나, mixed-radix encode/decode에서 전체 index에 대한
나눗셈이 필요하므로 결국 BigInt가 필요. BigInt가 ~2x 느린 수준이므로
추가 복잡도 대비 이점 없음. **보류**.
