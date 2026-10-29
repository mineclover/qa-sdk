---
def:
  tier: component
  id: dx-lifecycle-contract
  address: def_document:v2:136322
  scope: flow
  aspect: user_scenario
  depth: specification
  lifecycle: approved
  layer: operation
  svc: index-meta
  tags: [contract, runtime, versioning]
  links:
    - target: resolver-spec
      type: refines
    - target: dx-lifecycle-group
      type: refines
sources:
  - packages/index-meta/src/meta-resolver.ts
  - packages/index-meta/src/meta-codec.ts
  - packages/index-meta/src/index-sdk.ts
  - packages/index-meta/src/codegen.ts
  - packages/index-meta/src/index.ts
  - packages/index-meta-workers/src/index.ts
  - packages/index-meta/src/meta-resolver.test.ts
  - packages/index-meta/src/meta-codec.test.ts
---

# Index Meta DX - 출력 계약

## 목적 ^purpose

index-meta DX에서 와이어 포맷, 타입 추론, 제약 조건이 어떤 출력 계약을 만들어야 하는지 정리한다.

## 상태

implemented

## 출력 표면

| 표면 | 구현 | 계약 |
|------|------|------|
| DecodeMap | `MetaResolver.getDecodeMap()` / `MetaCodec.toDecodeMap()` | indexId, versionId, shape, size, dims, optional address config를 포함하는 독립 decode 번들 |
| Range/Dataset | `getDimRange()` / `getIndexRange()` / `getDataset()` | snapshot/version별 entries, activeIndices, capacity, headroom을 노출하는 read model |
| SDK constants | `IndexSDK.constants()` / `IndexClient.constants()` | 예약 토큰과 inactive entry를 제외한 enum-like 상수 객체 |
| SDK wire value | `IndexClient.encode()` / `decode()` / `matchRanges()` / `toDecodeMap()` | VersionedValue와 DB range query에 필요한 숫자 주소 계약 |
| type codegen | `generateTypes()` | MetaRegistryInput의 dim entry union, index coord interface, version union을 TypeScript 문자열로 생성 |
| schema lint/diff | `lintSchema()` / `formatSchemaDiff()` | schema headroom, unreferenced dim, invalid ref, duplicate entry, diff report를 developer-facing diagnostic으로 반환 |

## 제약

- DX 계약은 "쉽다"보다 "헷갈리지 않는다"를 우선한다.
- resolver bundle과 runtime decode는 같은 `MetaRegistryInput` snapshot에서 나와야 한다.
- `MetaResolver.getDecodeMap()`과 `MetaCodec.toDecodeMap()`은 같은 코어 데이터를 반환해야 하며, 이 일관성은 `meta-resolver.test.ts`가 검증한다.
- `generateTypes()`는 runtime bundle을 대신하지 않는다. 타입 문자열을 생성하지만 decode/encode truth는 `MetaCodec`과 `MetaResolver`의 DecodeMap 계약이다.
- package-local CLI 명령을 전제하지 않는다. tool entry는 `index-meta`/`index-meta-workers` exports와 `index-meta/client` 경량 entrypoint다.
