---
def:
  id: address-spec
  address: def_document:v1:2673
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [tier-infra]
  links:
    - target: meta-registry-spec
      type: depends_on
---

# Address 프로토콜 바인딩 스펙

## 목적 ^purpose

MetaRegistry의 VersionedValue를 UUID 등 고정 포맷 PK로 직렬화하는 설정과 동작 규칙.

디코딩 파이프라인: [../pipeline.md](../pipeline.md)
weighted-index 측 통합 문서: [../weighted-index/pack-format.spec.md](../weighted-index/pack-format.spec.md) §11

## 구성 ^overview

- **위임 원칙**: 프로토콜 변환 로직은 `weighted-index`의 `AddressConverter`에만 존재하며, MetaRegistry는 생성·위임·검증만 수행한다
- **AddressConfig**: `format`(uuid/int64), `schemaChars`, `versionChars`, `schemas`/`versions` 매핑으로 직렬화 형식을 정의한다
- **기본 프로토콜**: address 미설정 시 `colon`(`"perm:v1:42"`), uuid 설정 시 UUID 포맷, int64 설정 시 hex 포맷
- **검증 규칙**: indexId/versionId 매핑 필수, 값은 non-negative integer, 매핑 값 중복 불가
- **PK 디코딩**: UUID는 인덱스/버전 식별까지만 자기 설명적이며, 정수→엔티티 변환은 MetaRegistry(shape + entries)가 필수
- **BigInt 지원**: shape product > 2^53인 인덱스는 `serializeBig()`/`parseBig()`와 `createLayoutProtocolBig` 사용
- **프로토콜 변환**: `serialize(vv, protocol)` 호출로 colon, uuid, int64, uri 등 프로토콜 간 변환이 가능하다

## 참조

패키지 인덱스: [README.md](README.md)

## 상태

implemented

---

## 설계 원칙: weighted-index에 위임

프로토콜 변환 로직은 `weighted-index`의 `AddressConverter`에만 존재한다. MetaRegistry는:
- 생성자에서 `AddressConverter`를 생성하고 `createLayoutProtocol`로 layout 프로토콜을 등록
- `serialize`/`parse`에서 `AddressConverter`에 위임
- 파싱 결과에 대해 레지스트리 검증(indexId/versionId 존재, value 범위) 수행

MetaRegistry 자체는 직렬화/파싱 로직을 구현하지 않는다.

---

## AddressConfig

```ts
interface AddressConfig {
  format: PackFormat;                    // PACK_FORMATS.uuid, int64 등
  schemaChars: number;                   // indexId hex 자릿수
  versionChars: number;                  // versionId hex 자릿수
  schemas: Record<string, number>;       // indexId → 숫자 매핑
  versions: Record<string, number>;      // versionId → 숫자 매핑
}
```

## MetaRegistryInput 확장

```ts
interface MetaRegistryInput {
  dims: Record<string, DimInput>;
  indices: Record<string, IndexInput>;
  address?: AddressConfig;               // 선택적 프로토콜 바인딩
}
```

---

## Canonical Format

정규 형식이 `CANONICAL_TEXT_PROTOCOL = "colon"`, `CANONICAL_BINARY_PREFIX = "layout:"`로 지정되어 있다.
상세: [canonical-format.spec.md](canonical-format.spec.md)

## 기본 프로토콜 결정

| address 설정 | defaultProtocol | serialize(vv) 기본 출력 |
|---|---|---|
| 미설정 | `CANONICAL_TEXT_PROTOCOL` (`"colon"`) | `"perm:v1:42"` |
| `format: uuid` | `"layout:uuid"` | `"00010001-...-002a"` |
| `format: int64` | `"layout:int64"` | `"010100000000002a"` |

> **BigInt**: shape product > 2^53인 인덱스는 `serializeBig()`/`parseBig()`와 `createLayoutProtocolBig` 사용. 상세: [bigint-addressing.spec.md](../bigint-addressing.spec.md) §4

---

## 검증 규칙

| 규칙 | 에러 |
|---|---|
| 등록된 모든 indexId가 schemas에 매핑되어야 함 | `ValidationError` |
| 등록된 모든 versionId가 versions에 매핑되어야 함 | `ValidationError` |
| 매핑 값은 non-negative integer | `ValidationError` |
| schemas 매핑 값 중복 불가 | `ValidationError` |
| versions 매핑 값 중복 불가 | `ValidationError` |

---

## PK 디코딩 경로

UUID → entity ID 전체 디코딩 경로(4단계), 각 단계의 메서드·필요 정보·소속 패키지는 [`../pipeline.md`](../pipeline.md)에 정의되어 있다.

핵심: UUID는 **어떤 인덱스의 어떤 버전인지**까지만 자기 설명적이다. 정수 값이 무엇을 의미하는지는 MetaRegistry(shape + entries)가 반드시 필요하다.

---

## 사용 예시

```ts
import { PACK_FORMATS } from "weighted-index";

const registry = new MetaRegistry({
  dims: { /* ... */ },
  indices: { perm: { /* ... */ } },
  address: {
    format: PACK_FORMATS.uuid,
    schemaChars: 4, versionChars: 2,
    schemas: { perm: 1 }, versions: { v1: 1 },
  },
});

const codec = registry.createCodec("perm", "v1");

// entity ID → UUID PK (codec.encode + serialize)
const pk = registry.serialize(codec.encode({ role: "admin", action: "read" }));
// → "00010001-0000-0000-0000-000000000000"

// UUID PK → entity ID (parse + codec.decode)
codec.decode(registry.parse(pk));
// → { role: "admin", action: "read" }

// 프로토콜 간 변환
registry.serialize(codec.encode(ids), "uri");
// → "wi://perm/v1/0"
```
