# 인코딩/디코딩 파이프라인

> entity ID ↔ PK 문자열 전체 경로를 한 곳에서 정의한다.
> 각 단계가 어떤 패키지의 어떤 메서드에 의해 수행되는지, 어떤 정보가 필요한지를 명시한다.

관련 문서:
- 레이어 분리 원리: [`foundation.md`](foundation.md) §3
- 수학 엔진: [`weighted-index/core.spec.md`](weighted-index/core.spec.md)
- 스키마 레이어: [`index-meta/registry.spec.md`](index-meta/registry.spec.md)
- 프로토콜/포맷: [`weighted-index/pack-format.spec.md`](weighted-index/pack-format.spec.md)
- 외부 소비 (DecodeMap): [`index-meta/resolver.spec.md`](index-meta/resolver.spec.md)

---

## 레이어 구성

```
┌─────────────────────────────────────────────────────────────┐
│  프로토콜 레이어  (weighted-index: semantic-address)         │
│  PK 문자열 ↔ SemanticAddress { schema, version, index }     │
├─────────────────────────────────────────────────────────────┤
│  주소 게이트웨이  (index-meta: MetaRegistry)                 │
│  serialize/parse + 레지스트리 검증                            │
├─────────────────────────────────────────────────────────────┤
│  정보 해석 레이어  (index-meta: MetaCodec)                   │
│  entity ID ↔ VersionedValue                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 내부 위임: LabelRegistry + PrefixCodec (weighted-index) │
│  │ entity ID ↔ 1-based index ↔ 1차원 정수                 │ │
│  └────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  수학 레이어  (weighted-index: WeightedIndex)                │
│  정수 value ↔ n차원 좌표 (가중 나눗셈/곱셈)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 인코딩 파이프라인: entity ID → PK 문자열

```
{ role: "editor", action: "write", resource: 30 }
  │
  │ ① entity → 좌표          MetaCodec.encode()
  │   idToIndex.get("editor") → 2    (LabelRegistry 위임)
  │   idToIndex.get("write")  → 2
  │   idToIndex.get(30)       → 3
  │
  ▼
coords = [2, 2, 3]
  │
  │ ② 좌표 → 정수            WeightedIndex.encodeUnsafe()
  │   weights = [9, 3, 1]      (shape [3,3,3]에서 유도)
  │   (2-1)×9 + (2-1)×3 + (3-1)×1 = 14
  │
  ▼
VersionedValue { indexId: "perm", versionId: "v1", value: 14 }
  │
  │ ③ VV → SemanticAddress   fromVersionedValue()
  │   { schema: "perm", version: "v1", index: 14 }
  │
  │ ④ SA → PK 문자열         AddressConverter.serialize()
  │   schema  → schemas["perm"] = 1 → hex "0001"
  │   version → versions["v1"]  = 1 → hex "01"
  │   index   → 14              → hex "0e" (right-aligned)
  │
  ▼
"00010100-0000-0000-0000-00000000000e"
```

### 메서드 참조

| 단계 | 패키지 | 메서드 | 입력 → 출력 |
|---|---|---|---|
| ① | index-meta | `MetaCodec.encode(entityIds)` | `Record<string, EntityId>` → `VersionedValue` |
| ② | weighted-index | `PrefixCodec.encodeFromIds()` (MetaCodec 내부) | entity ID → 좌표 → `number` |
| ③ | weighted-index | `fromVersionedValue(vv)` | `VersionedValue` → `SemanticAddress` |
| ④ | weighted-index | `AddressConverter.serialize(addr, protocol)` | `SemanticAddress` → `string` |

**합성**: `reg.serialize(codec.encode(entityIds))` = ①+②+③+④.

---

## 디코딩 파이프라인: PK 문자열 → entity ID

```
"00010100-0000-0000-0000-00000000000e"
  │
  │ ④' hex 파싱              AddressConverter.parse()
  │   rawHex[0..4] = "0001" → schemas 역매핑 → "perm"
  │   rawHex[4..6] = "01"   → versions 역매핑 → "v1"
  │   rawHex[뒤]   = "0e"   → parseInt(16)    → 14
  │
  ▼
SemanticAddress { schema: "perm", version: "v1", index: 14 }
  │
  │ ③' SA → VV               toVersionedValue()
  │   { indexId: "perm", versionId: "v1", value: 14 }
  │
  │   ✓ 레지스트리 검증       MetaRegistry.parse() 내부
  │     indexId "perm" 존재 확인
  │     versionId "v1" 존재 확인
  │     value 14 < wi.size(27) 확인
  │
  ▼
VersionedValue { indexId: "perm", versionId: "v1", value: 14 }
  │
  │ ② shape 결정 + 좌표 복원
  │   IndexDef["perm"].dims = ["role", "action", "resource"]
  │   IndexVersion["perm/v1"] → snapshots → entries.length
  │   shape = [3, 3, 3]
  │
  │   WeightedIndex([3,3,3]).decode(14)
  │     weights = [9, 3, 1]
  │     14 ÷ 9 = 1 나머지 5  → coord[0] = 2
  │      5 ÷ 3 = 1 나머지 2  → coord[1] = 2
  │      2 ÷ 1 = 2 나머지 0  → coord[2] = 3
  │
  ▼
coords = [2, 2, 3]
  │
  │ ①' 좌표 → entity         MetaCodec.decode()
  │   entries["role/v1"][2-1]     = "editor"    (PrefixCodec.decodeToIds 위임)
  │   entries["action/v1"][2-1]   = "write"
  │   entries["resource/v1"][3-1] = 30
  │
  ▼
{ role: "editor", action: "write", resource: 30 }
```

### 메서드 참조

| 단계 | 패키지 | 메서드 | 입력 → 출력 |
|---|---|---|---|
| ④' | weighted-index | `AddressConverter.parse(input)` | `string` → `SemanticAddress` |
| ③' | weighted-index | `toVersionedValue(addr)` | `SemanticAddress` → `VersionedValue` |
| ✓ | index-meta | `MetaRegistry.parse()` 내부 검증 | indexId/versionId 존재 + value 범위 |
| ②' | weighted-index | `PrefixCodec.decodeToIds()` (MetaCodec 내부) | `number` → 좌표 → entity ID |
| ①' | index-meta | `MetaCodec.decode(vv)` | `VersionedValue` → `Record<string, EntityId>` |

**합성**: `codec.decode(reg.parse(pk))` = ④'+③'+✓+②'+①'.

---

## 각 단계에 필요한 정보의 위치

| 단계 | 필요한 정보 | 정보의 위치 | 없으면 |
|---|---|---|---|
| ④/④' hex 파싱 | format, schemas/versions 숫자 매핑 | **AddressConfig** | indexId/versionId를 알 수 없음 |
| ③/③' VV ↔ SA 변환 | 필드명 매핑만 (schema↔indexId 등) | **코드 내 고정** (어댑터 함수) | — |
| ✓ 레지스트리 검증 | 등록된 index/version 목록, wi.size | **MetaRegistry** | 잘못된 값이 통과할 수 있음 |
| ② shape 결정 | IndexDef.dims, IndexVersion.snapshots, entries.length | **MetaRegistry** (createCodec 시) | 좌표 복원 불가 |
| ②' 좌표 복원 | shape → weights (가중 나눗셈) | **WeightedIndex** (shape에서 유도) | — |
| ①/①' entity 매핑 | entries, idToIndex | **MetaCodec** (DecodeMap에 번들링) | 좌표는 있으나 의미를 모름 |

### UUID는 어디까지 자기 설명적인가

UUID 자체에 인코딩된 정보:

```
00010100-0000-0000-0000-00000000000e
├──┤├┤                          ├──┤
 │   │                           └── index: 14 (what)
 │   └── version: 1 → "v1" (when)
 └── schema: 1 → "perm" (which)
```

- **which** (어떤 인덱스인지) — UUID에서 추출 가능
- **when** (어떤 버전인지) — UUID에서 추출 가능
- **what** (정수 값) — UUID에서 추출 가능
- **meaning** (그 값이 무엇을 의미하는지) — **MetaCodec (또는 DecodeMap) 필수**

정수 값 `14`는 shape `[3,3,3]`에서 좌표 `[2,2,3]`이지만, shape `[4,3,3]`에서는 좌표 `[2,1,3]`이다. 정수 자체에는 shape 정보가 없으며, shape은 DecodeMap의 entries 길이에서 결정된다. MetaCodec은 이 DecodeMap을 번들로 받아 독립적으로 해석한다.

### 외부 시스템에 디코딩 데이터 전달: MetaResolver

외부 시스템(DB, 프론트엔드, 마이크로서비스)이 MetaRegistry 없이 디코딩하려면 shape + entries 데이터가 필요하다. `MetaResolver.getDecodeMap()`이 이 번들을 생성한다.

```ts
const resolver = new MetaResolver(registry);
const map = resolver.getDecodeMap("perm", "v1");
// → { shape: [3,3,3], size: 27, dims: [{dimId, entries}, ...], address? }

// 외부에서 MetaCodec으로 독립 decode:
const codec = new MetaCodec(map);
const ids = codec.decodeValue(14);
// { role: "editor", action: "write", resource: 30 }
```

`DecodeMap`에 `address`가 포함되면 UUID 파싱 → value 추출 → 좌표 복원 → entity 매핑까지 전체 파이프라인을 외부에서 자립적으로 수행할 수 있다. MetaCodec은 DecodeMap 하나로 동작하므로 MetaRegistry가 불필요하다.

버전 range 조회(`getIndexRange`, `getDimRange`)와 전체 데이터셋 내보내기(`getDataset`)는 [`index-meta/resolver.spec.md`](index-meta/resolver.spec.md) 참조.

---

## 프로토콜 간 변환

인코딩/디코딩과 독립적으로, 동일한 SemanticAddress를 다른 프로토콜로 변환할 수 있다.

```
            AddressConverter.convert(input, toProtocol)

"perm:v1:14"  ──colon──┐
                        │
"wi://perm/v1/14"  ──uri──┤
                          ├── SemanticAddress { schema: "perm", version: "v1", index: 14 }
"perm-v1-14"  ──compact──┤
                          │
"00010100-...-000e" ──uuid──┤
                            │
"010100000000000e" ──int64──┘
```

이 변환은 순수하게 `weighted-index`의 `AddressConverter`가 수행한다. MetaRegistry의 encode/decode와는 무관하며, SemanticAddress의 세 필드(schema, version, index)만으로 동작한다.

---

## 합성 메서드 요약

| 메서드 | 경로 | 설명 |
|---|---|---|
| `MetaCodec.encode(entityIds)` | ①→② | entity ID → VersionedValue |
| `MetaCodec.decode(vv)` | ②'→①' | VersionedValue → entity ID |
| `MetaCodec.decodeValue(value)` | ②'→①' | value → entity ID (검증 없이) |
| `MetaRegistry.serialize(vv, protocol?)` | ③→④ | VersionedValue → 프로토콜 문자열 |
| `MetaRegistry.parse(input, protocol?)` | ④'→③'→✓ | 프로토콜 문자열 → VersionedValue (검증 포함) |
| `MetaRegistry.createCodec(indexId, versionId)` | — | 특정 version 코덱 생성 |
| `AddressConverter.convert(input, toProtocol)` | 파싱→직렬화 | 프로토콜 간 변환 (레지스트리 무관) |
