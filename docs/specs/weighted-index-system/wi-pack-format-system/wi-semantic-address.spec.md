---
def:
  id: wi-semantic-address
  address: def_document:v2:342216
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [data, contract, structural]
  links:
    - target: wi-pack-format-def
      type: depends_on
---
# SemanticAddress

## 목적 ^purpose

프로토콜 독립적인 정보 좌표. schema(prefix ID) + version + index + shard로 구성되며, colon/URI/compact/layout 등 다양한 프로토콜로 직렬화된다.

## 구성 ^overview

SemanticAddress는 WeightedIndex가 좌표를 1D 정수로 압축한 결과에 "어떤 스키마의 어느 버전에서 압축된 값인가"라는 맥락을 부여하는 메타 레이어다.

- **SemanticAddress** — Number 기반 정보 좌표
- **SemanticAddressBig** — BigInt 기반 (2^53 초과)
- **VersionedValue** — 메타 레이어(index-meta) 관례 호환 타입
- **ShardingStrategy** — shard 라우팅 전략 (modulo)

## 타입 정의

```typescript
interface SemanticAddress {
  readonly schema:  string;   // 스키마 식별자 (= prefix ID)
  readonly version: string;   // 스키마 버전
  readonly index:   number;   // 인코딩된 정수 (0-based)
  readonly shard?:  number;   // 샤드 라우팅 힌트 (선택)
}

interface SemanticAddressBig {
  readonly schema:  string;
  readonly version: string;
  readonly index:   bigint;   // BigInt 인코딩 결과
  readonly shard?:  number;
}
```

## 관계 매핑

SemanticAddress는 다른 타입 체계와 동일한 정보를 담는다.

| SemanticAddress | VersionedIndex | VersionedValue |
|-----------------|----------------|----------------|
| `schema` | `prefix` | `indexId` |
| `version` | `v` | `versionId` |
| `index` | `id` | `value` |

변환 함수: `fromVersionedIndex`, `toVersionedIndex`, `fromVersionedValue`, `toVersionedValue`.

## 샤딩 전략

layout 프로토콜에서 shard 필드를 사용할 때 적용. 현재는 `modulo` 전략만 지원.

```typescript
type ShardingStrategy = {
  type: "modulo";
  chars: number;        // shard 필드 hex 자릿수
  numShards: number;    // 논리 샤드 수 (≥ 1)
};
// shard = index % numShards (자동 파생)
```

Layout 구조 변화:
- 미설정: `[schema | version | ··gap·· | index]`
- 설정 시: `[schema | version | shard | ··gap·· | index]`

## 직렬화 예시

동일한 SemanticAddress `{ schema: "perm", version: "v1", index: 42 }`:

```
colon       →  "perm:v1:42"
URI         →  "wi://perm/v1/42"
compact     →  "perm-v1-42"
layout:uuid →  "00010001-0000-0000-0000-00000000002a"
layout:int64 → "0001000100000042"
```

## 설계 원칙

- SemanticAddress는 프로토콜 독립적. 직렬화 형식은 AddressProtocol이 결정
- shard는 serialize 시 `index % numShards`로 자동 계산되어 hex에 삽입
- parse 시 hex에서 shard를 추출하여 반환
- schema/version의 숫자 매핑은 layout 프로토콜 생성 시 명시 (`schemas`, `versions`)

## 소스 위치

- `packages/weighted-index/src/protocol/semantic-address.ts`
