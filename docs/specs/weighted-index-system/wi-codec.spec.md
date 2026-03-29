---
def:
  id: wi-codec
  address: def_document:v2:68812
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: []
  links:
    - target: wi-api
      type: depends_on
---
# PrefixCodec + 직렬화 프로토콜

## 목적 ^purpose

시맨틱 주소(prefix:version:address)를 다양한 포맷으로 직렬화/파싱하는 코덱. colon, URI, compact, layout(UUID/hex) 프로토콜을 제공한다.

## 구성 ^overview

`AddressProtocol` 인터페이스를 구현하는 4+1개 프로토콜과 편의 함수로 구성된다.

- **텍스트 프로토콜 3종** — colon, URI, compact
- **바이너리 프로토콜** — layout (hex 컨테이너 기반, UUID/int64/커스텀)
- **편의 함수** — `detectProtocol`, `parseAddress`, `serializeAddress`, `convertAddress`

## AddressProtocol 인터페이스

```typescript
interface AddressProtocol {
  readonly name: string;
  test(input: string): boolean;       // 이 프로토콜의 문자열인지 판별
  serialize(addr: SemanticAddress): string;  // SemanticAddress → 문자열
  parse(input: string): SemanticAddress;     // 문자열 → SemanticAddress
}
```

## 텍스트 프로토콜 3종

| 프로토콜 | 형식 | 예시 | 용도 |
|----------|------|------|------|
| `colonProtocol` | `schema:version:index` | `perm:v1:42` | API, 로그, 디버깅 (정규 텍스트 프로토콜) |
| `uriProtocol` | `wi://schema/version/index` | `wi://perm/v1/42` | URL, 외부 참조, World Information URI |
| `compactProtocol` | `schema-version-index` | `perm-v1-42` | URL path segment, 파일명 |

감지 순서: URI(`wi://`) → colon(`:`) → compact(`-`). compact는 schema/version이 모두 hex-only이면 layout으로 간주되어 감지에서 제외된다.

## Layout 프로토콜

`createLayoutProtocol(opts)` — hex 컨테이너(UUID, int64, 커스텀)에 SemanticAddress를 packed하는 프로토콜 팩토리.

```
Layout 구조:
  [schema | version | ...gap... | index]        — 샤딩 없음
  [schema | version | shard | ...gap... | index] — 샤딩 있음
```

- Left fields(schema, version)는 char 0부터 오른쪽으로 배치
- Right field(index)는 끝에서 왼쪽으로 배치
- Gap은 zero-fill
- shard = `index % numShards` (자동 파생, 호출자 지정 불필요)

```typescript
const proto = createLayoutProtocol({
  format: PACK_FORMATS.uuid,
  schemaChars: 4, versionChars: 2,
  schemas: { perm: 1 }, versions: { v1: 1, v2: 2 },
});
proto.serialize({ schema: "perm", version: "v1", index: 42 });
// → "00010001-0000-0000-0000-00000000002a"
```

BigInt 버전: `createLayoutProtocolBig(opts)` — `SemanticAddressBig`(index가 bigint) 지원.

## VersionedValue / VersionedIndex 변환

| 함수 | 변환 |
|------|------|
| `fromVersionedIndex(vi)` | `VersionedIndex → SemanticAddress` |
| `toVersionedIndex(addr)` | `SemanticAddress → VersionedIndex` |
| `fromVersionedValue(vv)` | `VersionedValue → SemanticAddress` |
| `toVersionedValue(addr)` | `SemanticAddress → VersionedValue` |

## AddressConverter

`createAddressConverter(layouts)` — 여러 layout 프로토콜 간 변환기. 입력 문자열의 포맷을 자동 감지하고 지정 프로토콜로 변환.

## 편의 함수

| 함수 | 설명 |
|------|------|
| `detectProtocol(input)` | 프로토콜 이름 반환 (`"colon"`, `"uri"`, `"compact"`, `null`) |
| `parseAddress(input)` | 자동 감지 후 파싱 → SemanticAddress |
| `serializeAddress(addr, protocol)` | 지정 프로토콜로 직렬화 |
| `convertAddress(input, toProtocol)` | 프로토콜 간 변환 (감지 → 파싱 → 직렬화) |

## 정규 상수

- `CANONICAL_TEXT_PROTOCOL = "colon"` — API/로그 기본
- `CANONICAL_BINARY_PREFIX = "layout:"` — DB PK/바이너리 저장 기본

## 소스 위치

- `packages/weighted-index/src/protocol/semantic-address.ts`
- `packages/weighted-index/src/vocab/prefix-registry.ts` (PrefixCodec.serialize/parse)
