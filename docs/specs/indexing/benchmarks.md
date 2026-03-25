---
def:
  id: indexing-benchmarks
  scope: data
  aspect: system_data
  depth: validation
  lifecycle: deprecated
  tags: [performance]
  links:
    - target: index-codec-spec
      type: depends_on
    - target: resolver-spec
      type: depends_on
---

# 인덱싱 시스템 벤치마크

## 목적 ^purpose

encode/decode 성능, 차원 확장 한계, cross-index 종단 탐사, 정보 디코딩 파이프라인, 리소스 사용량의 실측 데이터.

테스트 환경: Node.js, vitest, Apple Silicon
테스트 파일:
- `packages/weighted-index/src/bench.test.ts` — 좌표 encode/decode, 차원 확장 한계, calcAddressRanges
- `packages/weighted-index/src/bench-cross-index.test.ts` — cross-index 종단 좌표 탐사
- `packages/weighted-index/src/bench-resource.test.ts` — WeightedIndex 메모리, range 캐시 크기
- `packages/weighted-index/src/bench-bigint-uuid.test.ts` — BigInt encode/decode/pack, UUID 직렬화, 레이아웃, 포맷 유틸
- `packages/index-meta/src/bench-info-decode.test.ts` — 정보 디코딩 파이프라인 (MetaCodec)
- `packages/index-meta/src/bench-resource.test.ts` — MetaCodec 메모리, DecodeMap 와이어 크기, cross-index 리소스

---

## 1. 차원 수 한계

`Number.MAX_SAFE_INTEGER` (2⁵³-1) 제약. 생성자에서 자동 검증.

| dimSize | 최대 d | 공간 크기 |
|---|---|---|
| 2 | **52** | 2⁵² = 4.5×10¹⁵ |
| 3 | **33** | 3³³ = 5.6×10¹⁵ |
| 10 | **15** | 10¹⁵ |
| 100 | **7** | 100⁷ = 10¹⁴ |

---

## 2. 좌표 encode/decode (WeightedIndex)

순수 수학 레이어. O(d) 곱셈/나눗셈.

### 차원 수 확장 (dimSize=2)

| d | 공간 크기 | encodeUnsafe | decodeToUnsafe |
|---|---|---|---|
| 4 | 16 | 59M ops/s | 38M ops/s |
| 8 | 256 | 64M ops/s | 13M ops/s |
| 16 | 65K | 38M ops/s | 12M ops/s |
| 32 | 4.3B | 20M ops/s | 8M ops/s |
| 52 | 4.5×10¹⁵ | 11M ops/s | 4.6M ops/s |

### dimSize 확장 (d=4 고정)

| dimSize | 공간 크기 | encodeUnsafe | decodeToUnsafe |
|---|---|---|---|
| 10 | 10K | 85M ops/s | 30M ops/s |
| 100 | 100M | 120M ops/s | 23M ops/s |
| 1000 | 10¹² | 109M ops/s | 14M ops/s |

차원 수에 선형 감소. dimSize 크기는 encode에 영향 없음, decode는 나눗셈 비용으로 소폭 감소.

---

## 3. Cross-index 종단 좌표 탐사

하위 인덱스 압축값이 상위 인덱스의 차원으로 편입될 때의 종단 decode/encode.

### 레벨 깊이별

| 깊이 | 구조 | 공간 크기 | encode E2E | decode E2E |
|---|---|---|---|---|
| 2레벨 | 3×4 → 12×5 | 60 | 17M ops/s | 17M ops/s |
| 3레벨 | → 60×8 | 480 | 5M ops/s | 9M ops/s |
| 4레벨 | → 480×4 | 1,920 | 5M ops/s | 13M ops/s |

### 대규모 시나리오

| 시나리오 | 구조 | decode E2E | decode zero-alloc |
|---|---|---|---|
| SaaS 권한 | 10×20×50 → 10K×100 = 1M | 21M ops/s | — |
| 4레벨 대규모 | 20×50 → 1K×10 → 10K×100 → 1M×5 = 5M | 12M ops/s | **16M ops/s** |

### flat vs nested (동일 6차원, 각 5)

| 방식 | encode | decode |
|---|---|---|
| flat | 123M ops/s (8ns) | 21M ops/s (47ns) |
| 2레벨 | 73M ops/s (14ns) | 15M ops/s (65ns) |
| 3레벨 | 55M ops/s (18ns) | 13M ops/s (74ns) |

레벨당 ~10ns 추가. 좌표 수준 cross-index는 병목 아님.

---

## 4. 정보 디코딩 파이프라인 (MetaCodec)

**핵심 측정**: integer → entity 이름까지의 전체 파이프라인.

### 레이어별 오버헤드 분리 (3D: 10×20×50 = 10,000)

```
decode 파이프라인:
L1  WI.decodeToUnsafe:     37M ops/s    27ns   ← 순수 수학
L1b WI.decode (safe):      21M ops/s    47ns   ← + 검증 + 배열 할당
L3  PrefixCodec.decode:     1.7M ops/s  604ns  ← + LabelRegistry Map lookup
L4v MetaCodec.decodeValue:  4.6M ops/s  219ns  ← + Object.freeze
L4  MetaCodec.decode:       5.2M ops/s  193ns  ← + VV 검증

encode 파이프라인:
L1  WI.encodeUnsafe:       149M ops/s     7ns
L3  PrefixCodec.encode:     6.8M ops/s  146ns
L4  MetaCodec.encode:       6.0M ops/s  167ns
```

**WI → MetaCodec 오버헤드: ~160ns** (Map lookup + 객체 생성)

### 차원 수 증가 시 스케일링

| 차원 수 | WI decode | MetaCodec decode | 오버헤드 | MetaCodec encode |
|---|---|---|---|---|
| 2 | 14ns | 156ns | 142ns | 126ns |
| 4 | 29ns | 246ns | 217ns | 206ns |
| 8 | 59ns | 416ns | 357ns | 323ns |
| 12 | 140ns | 653ns | 513ns | 478ns |

차원당 ~40ns 오버헤드 추가 (LabelRegistry lookup × d).

### 엔트리 수 증가 시 스케일링

| entries/dim | 공간 크기 | decode | encode |
|---|---|---|---|
| 5 | 125 | 185ns | 158ns |
| 50 | 125K | 200ns | 174ns |
| 500 | 125M | 211ns | 162ns |

**엔트리 수는 성능에 거의 영향 없음.** LabelRegistry가 Map 기반이므로 O(1) lookup.

### Cross-index 종단 정보 디코딩

| 시나리오 | 단일 decode | E2E decode | E2E encode |
|---|---|---|---|
| 소규모 2레벨 (60) | 153ns | 324ns | 286ns |
| SaaS 대규모 (1M) | 160~188ns | **409ns** | 335ns |

### 종합 워크로드 (10×20×50)

| 작업 | 성능 |
|---|---|
| encode | 5.8M ops/s (173ns) |
| decode | 5.3M ops/s (190ns) |
| matchRanges | 4.6M ops/s (216ns) |
| encode+decode+matchRanges | 1.6M ops/s (628ns) |

---

## 5. calcAddressRanges

연속 제약은 빠르지만, 비연속 OR 제약이 여러 차원에 겹치면 범위 수가 곱으로 폭발.

| 시나리오 | 범위 수 | ops/s |
|---|---|---|
| 1차원 고정, 나머지 wildcard (12D) | 1 | 1.8M |
| 단일값 × 2차원 (3D) | 1 | 2.4M |
| 범위 × 2차원 (3D) | 3 | 1.0M |
| OR 다중값 × 2차원 (3D) | 25 | 370K |
| 6D 복합 OR | 4,608 | 898 |

연속 제약 = 수백만 ops/s. 비연속 OR 다수 = 주의 필요.

### 최적화: 사전 계산 + 단면 매트릭스

비연속 OR 조합 폭발은 **빌드 타임 1회 비용으로 격리**할 수 있다.

```
┌─────────────────────────────────────────────────────┐
│ 빌드 타임 (1회)                                      │
│                                                     │
│  calcAddressRanges(shape, complexConstraints)        │
│    → ranges: [number, number][]   (e.g. 4,608개)    │
│    → ~1ms (허용 가능)                                │
│                                                     │
│  ranges를 단면 매트릭스(lookup table)로 캐시          │
└────────────────────┬────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────┐
│ 런타임 (매 요청)                                     │
│                                                     │
│  containsAddress(address, cachedRanges)              │
│    → O(log n) binary search                          │
│    → 수천만 ops/s                                    │
└─────────────────────────────────────────────────────┘
```

**패턴:**

1. 서버 기동 시 또는 스키마 변경 시 `calcAddressRanges`로 필요한 범위를 미리 계산
2. 결과를 `[number, number][]` 배열로 캐시 (단면 매트릭스)
3. 런타임에는 `containsAddress(address, ranges)`로 O(log n) 판정만 수행

이 방식이면 6D 복합 OR (4,608 ranges)도 빌드 타임 ~1ms + 런타임 판정 수십ns로 해결된다.
조합 폭발이 발생하는 쿼리를 자주 실행하는 것이 아니라, 한 번 계산하고 결과를 재사용하는 것이 핵심이다.

---

## 6. 리소스 사용량

테스트 파일:
- `packages/weighted-index/src/bench-resource.test.ts`
- `packages/index-meta/src/bench-resource.test.ts`

### WeightedIndex 인스턴스 메모리

| d | dimSize | 이론적 최소 | 실측 | 생성 시간 |
|---|---|---|---|---|
| 2 | 5 | 336 B | < 1 KB | 0.7 µs |
| 8 | 5 | 768 B | ~1 KB | 0.5 µs |
| 32 | 2 | 2.4 KB | ~2.1 KB | 2.7 µs |
| 52 | 2 | 3.8 KB | ~3.1 KB | 1.5 µs |

내부 구조: `weights(Float64Array, 8×d)` + `shapeBuf(Float64Array, 8×d)` + `shape(frozen)` + `labels(frozen)`.
52차원에서도 4KB 미만. 100개 동시 보유 시 ~106KB.

### MetaCodec 인스턴스 메모리

| 구성 | 총 entries | 코덱 메모리 | DecodeMap JSON | 생성 시간 |
|---|---|---|---|---|
| 3D×5 | 15 | 7.9 KB | 398 B | 3 µs |
| 3D×50 | 150 | 37 KB | 1.4 KB | 10 µs |
| 3D×500 | 1,500 | 41 KB | 13 KB | 95 µs |
| 8D×10 | 80 | 32 KB | 1.2 KB | 8 µs |
| 8D×50 | 400 | 94 KB | 3.7 KB | 28 µs |
| 12D×5 | 60 | 29 KB | 1.4 KB | 7 µs |

MetaCodec 내부: `DecodeMap(복사)` + `LabelRegistry(Map×2×d)` + `PrefixCodec` + `WeightedIndex`.
10개 독립 코덱 동시 보유 시 코덱당 ~21KB, 멀티 버전(v1~v5) 시 버전당 ~32KB.

### DecodeMap 와이어 크기 (JSON)

| 구성 | 총 entries | JSON 크기 |
|---|---|---|
| 3D×20 | 60 | 750 B |
| 3D×100 | 300 | 2.6 KB |
| 3D×500 | 1,500 | 13.2 KB |
| 8D×50 | 400 | 3.7 KB |
| 12D×5 | 60 | 1.4 KB |

와이어 크기는 entry ID 문자열 길이에 비례. 네트워크 전송 시 gzip으로 50~70% 압축 가능.

### Cross-index 계층 리소스

SaaS 2레벨 (perm 10×20×50 → access 10K×100 = 1M):
- perm DecodeMap: 1.3 KB
- access DecodeMap: 117.5 KB (perm_ref 10,000개가 비용의 대부분)
- 총 힙: ~2.7 MB

**비용의 핵심은 entries 배열 크기.** cross-index에서 하위 인덱스의 size가 상위 entries 수가 되므로, 하위 공간이 클수록 상위 DecodeMap이 커진다.

### calcAddressRanges 캐시 메모리

| 범위 수 | 이론적 크기 | 실측 |
|---|---|---|
| 1 | 88 B | < 1 KB |
| 25 | 1.4 KB | ~18 KB |
| 4,608 | 273 KB | ~342 KB |
| 10,000 | 547 KB | — |

Range 캐시는 `[number, number][]` 배열. 4,608개 범위를 캐싱해도 ~342KB로 메모리 부담 미미.

---

## 7. 브라우저 실행 검증 (레이아웃 시뮬레이터)

테스트 파일: `packages/platform-demo/src/pages/layout.ts`
검증 로직: `packages/weighted-index/src/layout-fit.ts` → `computeLayoutViewModel()`
테스트: `packages/weighted-index/src/layout-fit.test.ts`
접근: `http://localhost:5178/layout` → 인덱스 순차 진행 패널

### 설계 원칙: 테스트 우선, UI는 시각화만

모든 수치 계산은 `computeLayoutViewModel()` 순수 함수에서 수행하고,
UI는 리턴된 `LayoutViewModel`을 그대로 렌더링한다.
이 함수의 정합성은 Node.js 단위 테스트(`layout-fit.test.ts`)로 증명한다.

```
┌─────────────────────────────────────────────┐
│  layout-fit.test.ts (Node, vitest)          │
│  — 수학 불변식 증명                           │
│  — 모드별 정합성 검증                         │
│  — encode/decode 라운드트립                   │
└──────────────┬──────────────────────────────┘
               ↓ 증명된 순수 함수
┌─────────────────────────────────────────────┐
│  computeLayoutViewModel()                   │
│  — config + shape + mode → LayoutViewModel   │
│  — 모든 표시 값, 활용률, dimMax 한 벌 리턴    │
└──────────────┬──────────────────────────────┘
               ↓ 시각화만 담당
┌─────────────────────────────────────────────┐
│  layout.ts (브라우저 UI)                     │
│  — repaint 함수들이 ViewModel만 읽어서 렌더   │
│  — 자체 수치 계산 없음                        │
└─────────────────────────────────────────────┘
```

### 모드별 정합성 모델

UI에서 모든 숫자가 동일한 기준점(effective max)을 공유해야 모순이 없다.

**Number 모드** — 기준: `min(16^budget, MAX_SAFE_INTEGER)`

```
effectiveMax = 9.007 × 10^15  (budget=29일 때)
dimMax(i)    = floor(effectiveMax / 나머지곱)
utilization  = product / effectiveMax × 100
              → 슬라이더를 끝까지 올리면 100% 도달 가능
isCapped     = true  → "실제 UUID 용량: 10^34.9" 안내 표시
```

**BigInt 모드** — 기준: `16^budget` (UUID 실제 용량)

```
effectiveMax = 16^29 ≈ 8.5 × 10^34
dimMax(i)    = 16^budget / 나머지곱 (float 근사)
utilization  = product / 16^budget × 100
              → 전체 UUID 공간 대비 활용률
isCapped     = false
```

**정합성 불변식** (테스트로 증명):

| 불변식 | 설명 |
|---|---|
| `dims[i].sliderMax × productOfOthers ≤ effectiveMax` | 오버플로우 없음 |
| Number 모드에서 `utilization == 100%` 도달 가능 | dimMax까지 올리면 |
| BigInt `effectiveMax ≥ Number effectiveMax` | BigInt가 더 넓은 공간 |
| 동일 shape → BigInt `utilization ≤ Number utilization` | 분모가 더 크니까 |
| `simDecode(simEncode(coords)) == coords` | 라운드트립 |

### 시간 예산 배치 처리

`requestAnimationFrame` 기반. 프레임당 시간 예산(12ms) 내에서 최대한 처리 후 자동 중단.

```
┌─ 1 frame (16.67ms @60Hz) ──────────────────┐
│                                             │
│  while (elapsed < 12ms && count < cap) {    │
│    simDecode(shape, index)                  │
│    simPackUUID(...)                         │
│    count++                                  │
│    if (count % 64 === 0) check time         │
│  }                                          │
│                                             │
│  남은 ~4ms → DOM 갱신 + 브라우저 렌더         │
└─────────────────────────────────────────────┘
```

| 조작 | 효과 |
|---|---|
| 스킵 슬라이더 (0~60) | N프레임 건너뛰고 1프레임 연산. 육안 검증용 |
| 상한 슬라이더 (무제한~10M) | 프레임당 처리 상한. 무제한이면 시간 예산만 적용 |

성능 표시: `12.0ms에 4,000개 처리 (333.3K개/초)` — 배치 크기와 속도를 직관적으로 확인.

### Node.js 벤치마크와의 대응

| 브라우저 동작 | 대응하는 Node 벤치마크 | 기대 |
|---|---|---|
| `simDecode(shape, index)` | §2 좌표 decode | 4D 기준 ~30ns, 프레임 예산(16ms) 대비 무시 가능 |
| `simPackUUID(...)` | — (hex 포매팅) | ~100ns 수준, 병목 아님 |
| 배치 처리량 (12ms 예산) | — | ~1M+ ops/frame 기대 (연산만, DOM 제외) |
| DOM 테이블 갱신 (50행) | — | innerHTML 재생성이 주 비용. 스킵으로 조절 |

---

## 8. BigInt / UUID 직렬화

테스트 파일: `packages/weighted-index/src/bench-bigint-uuid.test.ts`

### BigInt mixed-radix encode/decode — Number 대비

| 구성 | Number encode | BigInt encode | encode 비율 | Number decode | BigInt decode | decode 비율 |
|---|---|---|---|---|---|---|
| 3D (10×20×50) | 94M ops/s | 29M ops/s | 3.3x | 58M ops/s | 32M ops/s | 1.8x |
| 4D (16⁴) | 67M ops/s | 27M ops/s | 2.5x | 46M ops/s | 26M ops/s | 1.8x |
| 6D (5⁶) | 60M ops/s | 23M ops/s | 2.7x | 42M ops/s | 21M ops/s | 2.0x |
| 8D (10×8×6×5×4×3×3×2) | 51M ops/s | 17M ops/s | 3.0x | 33M ops/s | 18M ops/s | 1.9x |

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

### 종합 E2E (4D: 100×200×50×80)

| 경로 | ops/s | ns/op |
|---|---|---|
| Number: encode → packUUID → unpackUUID → decode | 1.4M | 710ns |
| BigInt: encodeBig → packUUIDBig → parse → decodeBig | 2.3M | 441ns |
| BigInt huge (100K⁴ > 2^53) | 1.8M | 551ns |

BigInt E2E가 오히려 빠른 이유: simPackUUIDBig가 비트 연산 단일 경로로 Number 배열 조합보다 효율적.

---

## 결론

| 관심사 | 안전 범위 | 병목 가능성 |
|---|---|---|
| 좌표 encode/decode | 52차원까지 수백만~수천만 ops/s | 없음 |
| 정보 디코딩 (MetaCodec) | 12차원에서도 ~650ns | **없음** — 차원당 ~40ns 추가 |
| 엔트리 수 증가 | 500개/dim에서도 ~210ns | 없음 — Map O(1) |
| cross-index 종단 | 4레벨 대규모에서 ~400ns | 없음 |
| calcAddressRanges | 연속 제약은 안전 | 비연속 OR은 사전 계산 + containsAddress O(log n)으로 해결 |
| **BigInt encode/decode** | 8D에서 17M+ ops/s | **없음** — Number 대비 ~2-3x 느리나 절대 성능 충분 |
| **BigInt UUID pack** | 7.5M+ ops/s (Number보다 빠름) | **없음** — 비트 연산 단일 경로 |
| **BigInt clampShape/ViewModel** | 480K~3.4M ops/s | **없음** — UI 갱신 빈도(~60fps) 대비 충분 |
| **UUID 문자열 변환** | toUUID/fromUUID 라운드트립 ~2.4M ops/s | 없음 |
| **UUID 필드 pack/unpack** | pack+unpack 라운드트립 ~1.3M ops/s | 없음 |
| **포맷 유틸** | hexBoundary/hexCeil/hexFloor 27~41M ops/s | 없음 |
| WI 인스턴스 메모리 | 52차원에서도 ~4KB | 없음 — 100개 동시 보유 ~106KB |
| MetaCodec 메모리 | 8D×50에서도 ~94KB | 없음 — entries 수에 비례하나 KB 수준 |
| DecodeMap 와이어 | 3D×500에서도 ~13KB | 없음 — gzip 시 50~70% 압축 |
| range 캐시 메모리 | 4,608 ranges에서 ~342KB | 없음 — MB 미만 |
