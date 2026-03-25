---
def:
  id: index-codec-spec
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
---

# MetaCodec 스펙

## 목적 ^purpose

DecodeMap 기반 독립 encode/decode 모듈.
MetaRegistry 없이 entity ID ↔ VersionedValue 변환을 수행한다.

패키지 인덱스: [README.md](README.md)
디코딩 파이프라인: [../pipeline.md](../pipeline.md)
운영 흐름: `[S2, A1]` encode · `[S5, A5, D1]` decode — [runtime-flows.spec.md](../../operations/runtime-flows.spec.md)

## 상태

implemented

---

## 설계 원칙

### 관심사 분리

```
MetaRegistry (주소 게이트웨이)          MetaCodec (정보 해석)
├── 스키마 관리 (dims, indices)         ├── encode(entityIds) → VersionedValue
├── 주소 직렬화 (serialize/parse)       ├── decode(vv) → entityIds
├── createCodec() → MetaCodec          └── decodeValue(value) → entityIds
└── 검증 (ID 유효성, value 범위)
```

- **MetaRegistry**는 전체 스키마를 보관하고 주소 직렬화를 담당한다.
- **MetaCodec**은 특정 index version에 특화되어 entity ID ↔ 1차원 주소 변환만 수행한다.
- MetaCodec은 `DecodeMap`(shape + entries) 하나로 동작한다. MetaRegistry 의존 없음.

### weighted-index 위임

MetaCodec은 내부적으로 `weighted-index`의 `LabelRegistry` + `PrefixCodec`에 위임한다.

```
DecodeMap
  ├── dims[].entries → LabelRegistry (entity ID ↔ 1-based index)
  └── shape + dims   → PrefixCodec (좌표 배열 ↔ 1차원 정수 + entity 기반 encode/decode)
```

로직 중복 없이 weighted-index의 검증된 구현을 재사용한다.

---

## 생성 경로

### 1. MetaRegistry.createCodec()

MetaRegistry가 내부 데이터에서 DecodeMap을 빌드해 MetaCodec을 생성한다.

```ts
const reg = new MetaRegistry(input);
const codec = reg.createCodec("perm", "v1");
```

### 2. DecodeMap으로 직접 생성

MetaResolver.getDecodeMap() 또는 JSON 전송된 DecodeMap으로 독립 생성.

```ts
// MetaResolver 경유
const resolver = new MetaResolver(reg);
const map = resolver.getDecodeMap("perm", "v1");
const codec = new MetaCodec(map);

// JSON 수신 후 독립 생성 (MetaRegistry 불필요)
const received: DecodeMap = JSON.parse(jsonFromServer);
const codec = new MetaCodec(received);
```

---

## API

```ts
class MetaCodec {
  constructor(map: DecodeMap)

  /** entity ID → VersionedValue */
  encode(entityIds: Record<string, EntityId>): VersionedValue

  /** VersionedValue → entity ID (indexId/versionId 일치 검증) */
  decode(vv: VersionedValue): Readonly<Record<string, EntityId>>

  /** value만으로 decode (검증 없이) */
  decodeValue(value: number): Readonly<Record<string, EntityId>>

  /** DecodeMap deep clone 반환 */
  toDecodeMap(): DecodeMap

  get indexId(): string
  get versionId(): string
  get size(): number
  get shape(): readonly number[]
}
```

---

## 에러 매핑

MetaCodec은 weighted-index의 에러를 index-meta 에러로 변환한다.

| weighted-index 에러 | → index-meta 에러 | 발생 조건 |
|---|---|---|
| `EntityNotFoundError` | `EntryNotFoundError` | entries에 없는 entity ID로 encode 시도 |
| `CoordError` | `ValidationError` | dim 누락 등 좌표 구성 오류 |

---

## 사용 패턴

### 기본 encode/decode

```ts
const codec = reg.createCodec("perm", "v1");
const vv = codec.encode({ role: "editor", action: "write" });
const ids = codec.decode(vv);
// { role: "editor", action: "write" }
```

### encode → serialize → parse → decode (PK 왕복)

```ts
const codec = reg.createCodec("perm", "v1");
const pk = reg.serialize(codec.encode(entityIds));       // entity → PK
const restored = codec.decode(reg.parse(pk));             // PK → entity
```

### decode → re-encode (버전 이동)

```ts
const v1 = reg.createCodec("perm", "v1");
const v2 = reg.createCodec("perm", "v2");

const ids = v1.decode(oldVV);    // v1에서 entity 추출
const newVV = v2.encode(ids);    // v2로 re-encode
```

### 독립 운용 (MetaRegistry 없이)

```ts
// 서버에서 DecodeMap 번들 수신
const map: DecodeMap = await fetch("/api/decode-map/perm/v1").then(r => r.json());
const codec = new MetaCodec(map);

// MetaRegistry 없이 decode
const ids = codec.decodeValue(valueFromDB);
```

---

## 불변성

- `decode()`, `decodeValue()` 반환값은 `Object.freeze()` 적용.
- `toDecodeMap()`은 `structuredClone`으로 deep copy 반환.
