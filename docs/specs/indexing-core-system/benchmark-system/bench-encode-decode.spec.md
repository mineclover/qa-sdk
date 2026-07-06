---
def:
  tier: component
  id: bench-encode-decode
  address: def_document:v2:343170
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [performance]
  links:
    - target: wi-api
      type: depends_on
    - target: index-codec-spec
      type: depends_on
sources:
  - packages/weighted-index/src/bench.test.ts
  - packages/weighted-index/src/bench-cross-index.test.ts
  - packages/weighted-index/src/bench-resource.test.ts
  - packages/weighted-index/src/bench-bigint-uuid.test.ts
  - packages/index-meta/src/bench-info-decode.test.ts
  - packages/index-meta/src/bench-resource.test.ts
  - packages/weighted-index/src/index.ts
  - packages/weighted-index/src/math/weighted-index.ts
  - packages/weighted-index/src/math/weighted-index.test.ts
  - packages/weighted-index/src/math/calc.ts
  - packages/weighted-index/src/math/calc.test.ts
  - packages/weighted-index/package.json
  - packages/index-meta/src/meta-registry.ts
  - packages/index-meta/src/meta-registry.test.ts
  - packages/index-meta/src/meta-resolver.ts
  - packages/index-meta/src/meta-resolver.test.ts
  - packages/index-meta/src/meta-codec.ts
  - packages/index-meta/src/meta-codec.test.ts
  - packages/index-meta/src/address-protocol-manager.ts
  - packages/index-meta/src/address-protocol-manager.test.ts

---

# 벤치마크 — Encode/Decode 처리량

## 목적 ^purpose

WeightedIndex encode/decode 처리량과 차원 수 한계 측정.

## 구성 ^overview

- **차원 수 한계**: `Number.MAX_SAFE_INTEGER` (2^53-1) 제약 하에서 dimSize별 최대 차원 수 정의
- **WI 좌표 encode/decode**: 순수 수학 레이어(O(d) 곱셈/나눗셈) 성능 — 차원 수에 선형 감소, dimSize는 encode에 무영향
- **MetaCodec 파이프라인**: integer → entity 이름까지 전체 디코딩 레이어별 오버헤드 분리 (WI → PrefixCodec → MetaCodec)
- **WI→MetaCodec 오버헤드**: ~160ns (Map lookup + 객체 생성), 차원당 ~40ns 추가
- **엔트리 수 무관**: LabelRegistry가 Map 기반 O(1) lookup이므로 엔트리 수는 성능에 거의 영향 없음
- **종합 워크로드**: 10x20x50 공간에서 encode 5.8M ops/s, decode 5.3M ops/s, 전체 라운드트립 1.6M ops/s

---

## 1. 차원 수 한계

`Number.MAX_SAFE_INTEGER` (2^53-1) 제약. 생성자에서 자동 검증.

| dimSize | 최대 d | 공간 크기 |
|---|---|---|
| 2 | **52** | 2^52 = 4.5x10^15 |
| 3 | **33** | 3^33 = 5.6x10^15 |
| 10 | **15** | 10^15 |
| 100 | **7** | 100^7 = 10^14 |

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
| 52 | 4.5x10^15 | 11M ops/s | 4.6M ops/s |

### dimSize 확장 (d=4 고정)

| dimSize | 공간 크기 | encodeUnsafe | decodeToUnsafe |
|---|---|---|---|
| 10 | 10K | 85M ops/s | 30M ops/s |
| 100 | 100M | 120M ops/s | 23M ops/s |
| 1000 | 10^12 | 109M ops/s | 14M ops/s |

차원 수에 선형 감소. dimSize 크기는 encode에 영향 없음, decode는 나눗셈 비용으로 소폭 감소.

---

## 3. 정보 디코딩 파이프라인 (MetaCodec)

**핵심 측정**: integer -> entity 이름까지의 전체 파이프라인.

### 레이어별 오버헤드 분리 (3D: 10x20x50 = 10,000)

```
decode 파이프라인:
L1  WI.decodeToUnsafe:     37M ops/s    27ns   <- 순수 수학
L1b WI.decode (safe):      21M ops/s    47ns   <- + 검증 + 배열 할당
L3  PrefixCodec.decode:     1.7M ops/s  604ns  <- + LabelRegistry Map lookup
L4v MetaCodec.decodeValue:  4.6M ops/s  219ns  <- + Object.freeze
L4  MetaCodec.decode:       5.2M ops/s  193ns  <- + VV 검증

encode 파이프라인:
L1  WI.encodeUnsafe:       149M ops/s     7ns
L3  PrefixCodec.encode:     6.8M ops/s  146ns
L4  MetaCodec.encode:       6.0M ops/s  167ns
```

**WI -> MetaCodec 오버헤드: ~160ns** (Map lookup + 객체 생성)

### 차원 수 증가 시 스케일링

| 차원 수 | WI decode | MetaCodec decode | 오버헤드 | MetaCodec encode |
|---|---|---|---|---|
| 2 | 14ns | 156ns | 142ns | 126ns |
| 4 | 29ns | 246ns | 217ns | 206ns |
| 8 | 59ns | 416ns | 357ns | 323ns |
| 12 | 140ns | 653ns | 513ns | 478ns |

차원당 ~40ns 오버헤드 추가 (LabelRegistry lookup x d).

### 엔트리 수 증가 시 스케일링

| entries/dim | 공간 크기 | decode | encode |
|---|---|---|---|
| 5 | 125 | 185ns | 158ns |
| 50 | 125K | 200ns | 174ns |
| 500 | 125M | 211ns | 162ns |

**엔트리 수는 성능에 거의 영향 없음.** LabelRegistry가 Map 기반이므로 O(1) lookup.

### 종합 워크로드 (10x20x50)

| 작업 | 성능 |
|---|---|
| encode | 5.8M ops/s (173ns) |
| decode | 5.3M ops/s (190ns) |
| matchRanges | 4.6M ops/s (216ns) |
| encode+decode+matchRanges | 1.6M ops/s (628ns) |
