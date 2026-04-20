---
def:
  tier: component
  id: bench-range-calc
  address: def_document:v2:343171
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [performance]
  links:
    - target: range-query-spec
      type: depends_on
    - target: wi-hex-ops
      type: depends_on
---

# 벤치마크 — calcAddressRanges + BigInt/UUID

## 목적 ^purpose

calcAddressRanges 범위 연산의 처리량과 BigInt/UUID 직렬화 성능 측정.

## 구성 ^overview

- **calcAddressRanges 성능**: 연속 제약은 1.8M~2.4M ops/s, 비연속 OR 다중 차원 조합 시 범위 수가 곱으로 폭발하여 6D 복합 OR(4,608 ranges)는 898 ops/s까지 하락
- **사전 계산 최적화**: 복합 OR은 빌드 타임 1회 계산(~1ms) + 런타임 `containsAddress` O(log n) binary search 패턴으로 해결하며, 4,608 ranges 캐시도 ~342KB로 메모리 부담 미미
- **BigInt mixed-radix**: Number 대비 encode ~3x, decode ~2x 느리지만 8D에서도 17M+ ops/s로 병목 아님
- **UUID pack 성능**: BigInt `simPackUUIDBig`(7.5M ops/s)가 Number 버전(1.7M ops/s)보다 ~4x 빠름 — 비트 연산 단일 경로가 char 배열 조합보다 효율적
- **레이아웃 계산**: `dimMaxBig`는 BigInt 정밀 계산으로 Number 대비 ~20x 느리나, 단발 호출(UI 갱신)용이므로 무관
- **UUID 문자열 변환**: `toUUID`/`fromUUID` 라운드트립 ~2.4M ops/s(420ns), 필드 수 증가 시 선형 감소하나 6필드에서도 1.4M ops/s
- **E2E 종합**: BigInt 경로(encodeBig→packUUIDBig→parse→decodeBig)가 2.3M ops/s로 Number 경로(1.4M ops/s)보다 빠름 — `simPackUUIDBig` 비트 연산 효율 덕분

---

## 1. calcAddressRanges

연속 제약은 빠르지만, 비연속 OR 제약이 여러 차원에 겹치면 범위 수가 곱으로 폭발.

| 시나리오 | 범위 수 | ops/s |
|---|---|---|
| 1차원 고정, 나머지 wildcard (12D) | 1 | 1.8M |
| 단일값 x 2차원 (3D) | 1 | 2.4M |
| 범위 x 2차원 (3D) | 3 | 1.0M |
| OR 다중값 x 2차원 (3D) | 25 | 370K |
| 6D 복합 OR | 4,608 | 898 |

연속 제약 = 수백만 ops/s. 비연속 OR 다수 = 주의 필요.

### 최적화: 사전 계산 + 단면 매트릭스

비연속 OR 조합 폭발은 **빌드 타임 1회 비용으로 격리**할 수 있다.

```
┌─────────────────────────────────────────────────────┐
│ 빌드 타임 (1회)                                      │
│                                                     │
│  calcAddressRanges(shape, complexConstraints)        │
│    -> ranges: [number, number][]   (e.g. 4,608개)   │
│    -> ~1ms (허용 가능)                                │
│                                                     │
│  ranges를 단면 매트릭스(lookup table)로 캐시          │
└────────────────────┬────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────┐
│ 런타임 (매 요청)                                     │
│                                                     │
│  containsAddress(address, cachedRanges)              │
│    -> O(log n) binary search                         │
│    -> 수천만 ops/s                                    │
└─────────────────────────────────────────────────────┘
```

**패턴:**

1. 서버 기동 시 또는 스키마 변경 시 `calcAddressRanges`로 필요한 범위를 미리 계산
2. 결과를 `[number, number][]` 배열로 캐시 (단면 매트릭스)
3. 런타임에는 `containsAddress(address, ranges)`로 O(log n) 판정만 수행

이 방식이면 6D 복합 OR (4,608 ranges)도 빌드 타임 ~1ms + 런타임 판정 수십ns로 해결된다.

### calcAddressRanges 캐시 메모리

| 범위 수 | 이론적 크기 | 실측 |
|---|---|---|
| 1 | 88 B | < 1 KB |
| 25 | 1.4 KB | ~18 KB |
| 4,608 | 273 KB | ~342 KB |
| 10,000 | 547 KB | -- |

Range 캐시는 `[number, number][]` 배열. 4,608개 범위를 캐싱해도 ~342KB로 메모리 부담 미미.

---

## 2. BigInt / UUID 직렬화

### BigInt mixed-radix encode/decode — Number 대비

| 구성 | Number encode | BigInt encode | encode 비율 | Number decode | BigInt decode | decode 비율 |
|---|---|---|---|---|---|---|
| 3D (10x20x50) | 94M ops/s | 29M ops/s | 3.3x | 58M ops/s | 32M ops/s | 1.8x |
| 4D (16^4) | 67M ops/s | 27M ops/s | 2.5x | 46M ops/s | 26M ops/s | 1.8x |
| 6D (5^6) | 60M ops/s | 23M ops/s | 2.7x | 42M ops/s | 21M ops/s | 2.0x |
| 8D (10x8x6x5x4x3x3x2) | 51M ops/s | 17M ops/s | 3.0x | 33M ops/s | 18M ops/s | 1.9x |

BigInt encode는 Number 대비 **~3x 느림**, decode는 **~2x 느림**. 8D에서도 17M+ ops/s로 병목 아님.

### BigInt UUID pack — simPackUUIDBig vs simPackUUID

| 변형 | ops/s | ns/op |
|---|---|---|
| Number simPackUUID | 1.7M | 584ns |
| BigInt simPackUUIDBig | 7.5M | 133ns |
| BigInt huge (16^29-1) | 7.8M | 128ns |

BigInt 버전이 **~4x 빠름** — Number 버전은 char 배열 조합, BigInt 버전은 비트 연산 단일 경로.
MAX_SAFE_INTEGER 초과 인덱스에서도 성능 변화 없음.

### BigInt 레이아웃 계산

**clampShape — bigint vs number 모드:**

| budget | Number ops/s | BigInt ops/s | 비율 |
|---|---|---|---|
| 13 (Number 안전) | 18M | 18M | 1.0x |
| 20 (BigInt 필요) | 23M | 4M | 5.7x |
| 29 (UUID 전체) | 21M | 3.4M | 6.2x |

**dimMax 변형 비교:**

| 시나리오 | dimMaxForBudget | dimMaxBig | dimMaxApprox |
|---|---|---|---|
| budget=10, others=100 | 95M ops/s | 8.9M ops/s | 96M ops/s |
| budget=20, others=1K | 85M ops/s | 5.4M ops/s | 31M ops/s |
| budget=29, others=1M | 98M ops/s | 4.6M ops/s | 33M ops/s |

dimMaxBig는 BigInt 정밀 계산으로 **~20x 느림**. 하지만 단발 호출(UI 갱신)용이므로 무관.

**computeLayoutViewModel:**

| 모드 | ops/s | ns/op |
|---|---|---|
| Number | 1.3M | 798ns |
| BigInt | 480K | 2,092ns |

BigInt 모드가 **~2.6x 느림** — 내부에서 clampShape + dimMaxBig 누적.

**BigInt 유틸리티:**

| 함수 | ops/s | ns/op |
|---|---|---|
| utilizationBig | 5.5M | 183ns |
| maxProductBig | 11M | 90ns |

### UUID 문자열 변환

**toUUID / fromUUID:**

| bitWidth | toUUID | fromUUID | 라운드트립 |
|---|---|---|---|
| 8bit | 4.3M ops/s | 2.5M ops/s | 2.5M ops/s |
| 16bit | 4.2M ops/s | 2.4M ops/s | 2.4M ops/s |
| 24bit | 4.4M ops/s | 2.3M ops/s | 2.1M ops/s |
| 30bit | 4.4M ops/s | 2.4M ops/s | 2.4M ops/s |

bitWidth에 거의 영향 없음. 라운드트립 **~2.4M ops/s (420ns)**.

**toStructuredUUID / fromStructuredUUID:**

| 구성 | encode | decode | 라운드트립 |
|---|---|---|---|
| 3필드 (22bit) | 4.8M ops/s | 6.2M ops/s | 2.7M ops/s |
| 4필드 (48bit) | 3.8M ops/s | 4.5M ops/s | 2.0M ops/s |
| 6필드 (64bit) | 2.7M ops/s | 3.1M ops/s | 1.4M ops/s |

필드 수에 선형 감소. 6필드 라운드트립에서도 **~1.4M ops/s (714ns)**.

### UUID 필드 pack/unpack

| 연산 | ops/s | ns/op |
|---|---|---|
| createUUIDLayout (4슬롯) | 12M | 83ns |
| planLayout (3필드) | 5.1M | 195ns |
| packUUID (4필드) | 2.0M | 488ns |
| unpackUUID (4필드) | 3.8M | 264ns |
| pack+unpack 라운드트립 | 1.3M | 763ns |

### 포맷 유틸리티

| 함수 | ops/s | ns/op |
|---|---|---|
| formatHex (UUID) | 5.8M | 171ns |
| parseHex (UUID) | 7.8M | 128ns |
| hexBoundary | 27~33M | 30~37ns |
| hexCeil | 30~38M | 26~33ns |
| hexFloor | 29~41M | 24~34ns |

### 종합 E2E (4D: 100x200x50x80)

| 경로 | ops/s | ns/op |
|---|---|---|
| Number: encode -> packUUID -> unpackUUID -> decode | 1.4M | 710ns |
| BigInt: encodeBig -> packUUIDBig -> parse -> decodeBig | 2.3M | 441ns |
| BigInt huge (100K^4 > 2^53) | 1.8M | 551ns |

BigInt E2E가 오히려 빠른 이유: simPackUUIDBig가 비트 연산 단일 경로로 Number 배열 조합보다 효율적.
