# 인덱싱 시스템 벤치마크

> encode/decode 성능, 차원 확장 한계, cross-index 종단 탐사, 정보 디코딩 파이프라인, 리소스 사용량의 실측 데이터.

테스트 환경: Node.js, vitest, Apple Silicon
테스트 파일:
- `packages/weighted-index/src/bench.test.ts` — 좌표 encode/decode, 차원 확장 한계, calcAddressRanges
- `packages/weighted-index/src/bench-cross-index.test.ts` — cross-index 종단 좌표 탐사
- `packages/weighted-index/src/bench-resource.test.ts` — WeightedIndex 메모리, range 캐시 크기
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

## 결론

| 관심사 | 안전 범위 | 병목 가능성 |
|---|---|---|
| 좌표 encode/decode | 52차원까지 수백만~수천만 ops/s | 없음 |
| 정보 디코딩 (MetaCodec) | 12차원에서도 ~650ns | **없음** — 차원당 ~40ns 추가 |
| 엔트리 수 증가 | 500개/dim에서도 ~210ns | 없음 — Map O(1) |
| cross-index 종단 | 4레벨 대규모에서 ~400ns | 없음 |
| calcAddressRanges | 연속 제약은 안전 | 비연속 OR은 사전 계산 + containsAddress O(log n)으로 해결 |
| WI 인스턴스 메모리 | 52차원에서도 ~4KB | 없음 — 100개 동시 보유 ~106KB |
| MetaCodec 메모리 | 8D×50에서도 ~94KB | 없음 — entries 수에 비례하나 KB 수준 |
| DecodeMap 와이어 | 3D×500에서도 ~13KB | 없음 — gzip 시 50~70% 압축 |
| range 캐시 메모리 | 4,608 ranges에서 ~342KB | 없음 — MB 미만 |
