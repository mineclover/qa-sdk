---
def:
  id: acceleration-spec
  address: def_document:v1:537
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [performance]
  links:
    - target: coord-foundation
      type: depends_on
---

# 하드웨어 가속 비전 — FPGA/PCIe 가속기를 위한 데이터 아키텍처

## 목적 ^purpose

현재 인덱싱 시스템의 구조적 특성이 왜 하드웨어 가속에 적합한지를 정리하고,
향후 FPGA/PCIe 가속기를 위한 인터페이스 확장 방향을 제시한다.
이 문서는 장기 로드맵이며, 현재 구현에 대한 설계 제약을 부과하지 않는다.

## 구성 ^overview

- **가속 적합성**: WeightedIndex encode/decode는 분기 없는 순수 곱셈/나눗셈/모듈러 연산이며, shape 불변 시 single-cycle encode 가능
- **현재 성능**: encode 22M ops/s, decode 8.3M ops/s, E2E 1.4M ops/s — FPGA 가속 시 수십 배 향상 여지
- **FPGA 경계 원칙**: 문자열은 절대 FPGA로 내려가지 않으며, CPU에서 정수로 정규화한 후에만 가속 경로에 진입
- **Write/Read 경로 분리**: Write는 Packed Key 생성, Read는 Packed Key 생성 + Cache Lookup + Policy를 FPGA 가속 대상으로 식별
- **3대 핵심 요소**: Resolver(문자열→정수 SSOT), Schema(불변 구조 보장), Encoder(분기 없는 순수 산술) — 세 가지가 맞으면 FPGA 가속은 인터페이스 추가 수준
- **로드맵 4단계**: P1 coord bypass API → P2 batch encode/decode → P3 binary axis format → P4 FPGA prototype (P1~P3는 FPGA 없이도 성능 최적화 가치 있음)
- **packed key 캐시 우위**: 고정 크기 정수로 해시 불필요, 정렬 가능, 결정론적이며 L1(process)→L2(distributed)→L3(DB) 계층 캐시에 최적

상태: `vision`

---

## 핵심 관점

> ❌ "어떻게 encode 할까"
> ✅ "어떻게 하면 encode 가능한 데이터 상태를 유지할까"

시스템의 핵심은 packed key 자체가 아니라 **packed key가 항상 안정적으로 생성 가능한 데이터 상태**다.

---

## 현재 시스템이 가속에 적합한 이유

### 1. 순수 산술 연산

WeightedIndex.encode/decode는 분기 없는 순수 곱셈/나눗셈/모듈러 연산이다.
shape가 정적이면 stride를 register에 올릴 수 있어 single-cycle encode가 가능하다.

현재 벤치마크:
- encode: 22M ops/s (32D, 45ns)
- decode: 8.3M ops/s (32D, 119ns)
- E2E encode→pack→unpack→decode: 1.4M ops/s (710ns)

### 2. 결정론적 key 생성

동일 shape + 동일 coords = 항상 동일 key (INV-1, INV-2).
FPGA에서 재현성이 보장된다.

### 3. 불변 데이터 구조

shape 확정 → weights는 불변 Float64Array.
entries 확정 → LabelRegistry는 불변 Map.
FPGA configuration이 런타임 변경 없이 유지된다.

### 4. 쓰기/읽기 경로 분리

비용이 큰 연산(calcAddressRanges 등)은 빌드 타임에 격리.
런타임은 사전 계산된 결과를 참조만 한다.
FPGA는 런타임 경로(encode/decode/lookup)만 가속하면 된다.

---

## 가속 대상 파이프라인

### Write Path

```
event 발생
  ↓
Resolver (resource_ref_id)        ← CPU: 문자열 → 정수 변환
  ↓
Axis Normalize                    ← CPU: coord 배열 생성
  ↓
Packed Key 생성                   ← FPGA 가속 대상
  ↓
Event 저장                        ← CPU/DB
  ↓
Async Aggregation                 ← CPU
```

### Read Path

```
Query 조건
  ↓
조건 → axis tuple                 ← CPU
  ↓
Packed Key 생성                   ← FPGA 가속 대상
  ↓
Cache Hit?                        ← FPGA BRAM 또는 CPU
  ↓
Lookup / Policy                   ← FPGA 가속 대상 (containsAddress)
```

### FPGA 경계

```
Host Side:
  normalized axis (정수 배열)
    ↓
  batch queue
    ↓
  PCIe write

FPGA:
  axis → packed key → lookup → result

Return:
  result → CPU
```

핵심: **문자열은 절대 FPGA로 내려가지 않는다.** 모든 것은 정수로 수렴한 후에만 가속 경로에 진입한다.

---

## 현재 구현과의 매핑

| 비전 레이어 | 현재 구현 | 갭 |
|---|---|---|
| Resolver Layer | MetaRegistry + PrefixDecoder + entryRefs | 없음 (SSOT) |
| Axis Normalizer | MetaCodec.encode() 내부의 name→coord 변환 | 경계 노출 필요 |
| Schema Registry | MetaRegistryInput + AddressConfig + capacity/headroom | 없음 |
| Vocabulary/Ref | DimSnapshot (string_enum/number_enum/index_ref) | 없음 |
| Key Encoder | WeightedIndex.encode() — 순수 산술 | batch API 필요 |
| Lookup/Policy | policy-resolver + gateFilterRanges + AddressRangeCache | L1/L2/L3 계층화 필요 |

---

## 인터페이스 확장 방향 (구현 필요 사항)

### 1. Axis Normalize ↔ Encode 경계 노출

현재 MetaCodec.encode()가 name lookup + stride 계산을 한 번에 수행한다.
FPGA 경계를 명확히 하려면 coord 배열을 명시적 중간 표현으로 분리해야 한다.

```
현재:  { role: "admin", action: "read" } → MetaCodec.encode() → packed int
비전:  { role: "admin" } → normalize → [1, 1] → encoder → packed int
                                         ↑
                                    FPGA 입력 경계
```

WeightedIndex.encode(coords)가 이미 정수 배열을 받으므로 경계는 존재하지만
API 표면에 노출되어 있지 않다.

필요: `MetaCodec.encodeCoords(coords: number[]): VersionedValue` bypass API.

### 2. Batch Encoding 인터페이스

FPGA의 핵심은 batch throughput. PCIe 전송 효율을 위해 batch API가 필요하다.

필요:
- `WeightedIndex.encodeBatch(coordsList: number[][]): number[]`
- `WeightedIndex.decodeBatch(indices: number[]): number[][]`
- `MetaCodec.encodeBatch(entityList: Record<string, EntityId>[]): VersionedValue[]`

참고: MetaCodec.decodeBatch()는 이미 존재.

### 3. Fixed-Width Binary Axis Format

현재 정수 배열의 직렬화가 JSON 기반이다.
FPGA DMA를 위해서는 고정 크기 바이너리 포맷이 필요하다.

shape가 정적이므로 각 axis의 bit width는 컴파일 타임에 결정 가능하다.
이 정보는 schema registry(AddressConfig)가 이미 가지고 있다.

필요:
- axis tuple의 fixed-width binary representation
- shape → bit layout 자동 도출
- ArrayBuffer 기반 batch 직렬화

---

## 시스템 불변조건과 가속 안전성

| 불변조건 | 현재 보장 메커니즘 | FPGA 영향 |
|---|---|---|
| ref_id 의미 변경 금지 | append-only entries + inactive flag | FPGA lookup table 갱신 불필요 (schema 불변) |
| prefix schema immutable | IndexVersion 고정 + 새 version 생성 | FPGA configuration 재로드 = version 변경 시만 |
| packed key deterministic | WeightedIndex 순수 산술 (INV-1/2) | FPGA 재현 가능 |
| axis 정규화 상태 유지 | encode() 입력 검증 | CPU에서 검증 후 FPGA에 전달 |

### 깨지는 케이스와 현재 방어

| 리스크 | 방어 | FPGA 고려 |
|---|---|---|
| ref_id 중복 생성 | DimSnapshot entries 유일성 검증 | CPU 레이어에서 차단 |
| schema 변경 | version immutability | FPGA bitstream 재로드 트리거 |
| axis 누락 | encode() 시 모든 dim 필수 | CPU에서 검증 후 전달 |
| resource rename | position 불변 + EntityId 기반 migration | FPGA 무관 (position 불변) |

---

## packed key가 최고의 캐시 키인 이유

1. **고정 크기**: shape이 확정되면 key 크기가 고정. 해시 불필요.
2. **정렬 가능**: 정수이므로 B-tree, range scan에 최적.
3. **결정론적**: 동일 입력 = 동일 key. 캐시 히트율 최대화.
4. **공간 효율**: 문자열 조합 대비 극단적 압축 (여러 차원 → 하나의 정수).

캐시 계층:
- L1 (process memory): packed_key → result
- L2 (distributed cache): packed_key → result
- L3 (DB): fallback

---

## 기술 스택 방향

| 관심사 | 현재 | 가속 시 |
|---|---|---|
| Resolver + Encoder | TypeScript (순수 산술) | CPU: TS / FPGA: PCIe 가속 |
| Ref Tables | 인메모리 (DimSnapshot) | PostgreSQL (ref tables) |
| Cache | CoalescingCache + EntryCache | Redis (L2) + FPGA BRAM (L1) |
| Event Stream | - | Kafka (비동기 집계) |
| Lookup/Policy | containsAddress O(log n) | FPGA BRAM parallel lookup |

---

## 이 구조의 본질

> **"모든 도메인 데이터를 정수 좌표계로 투영하고, 그 좌표를 canonical key로 사용하는 시스템"**

3개 핵심이 맞으면 FPGA 가속은 인터페이스 추가 수준이다:

1. **Resolver (identity)** — 문자열 → 정수 변환의 SSOT
2. **Schema (prefix + axis 정의)** — 불변 구조 보장
3. **Encoder (key 생성)** — 분기 없는 순수 산술

---

## 로드맵 의존성

이 비전은 다음 구현에 의존하지 않으며, 현재 설계의 자연스러운 확장이다:

| 우선순위 | 항목 | 설명 |
|---|---|---|
| P1 | coord bypass API | MetaCodec.encodeCoords() — normalize/encode 경계 노출 |
| P2 | batch encode/decode | WeightedIndex/MetaCodec batch API |
| P3 | binary axis format | ArrayBuffer 기반 고정 폭 직렬화 |
| P4 | FPGA prototype | PCIe 연동 PoC (encode + containsAddress) |

P1~P3는 FPGA 없이도 순수 성능 최적화로 가치가 있다.
