---
def:
  id: platform-codec-spec
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: codec
  tags: [runtime, contract, structural]
  links:
    - target: platform-chain-system
      type: refines
    - target: platform-core-spec
      type: depends_on
sources:
  - packages/codec/src/index.ts
  - packages/codec/src/dim-wire.ts
  - packages/codec/src/typed-sdk.ts
  - packages/sdk/src/dim-wire.test.ts
  - packages/sdk/src/typed-sdk.test.ts
---
# @qa-sdk/codec — dim-wire 인코딩

## 목적 ^purpose

Catalog 기반 dim-wire codec과 `WeightedIndex` 기반 typed index SDK를 제공한다. `@qa-sdk/core`의 catalog 런타임 위에서 차원별 1-based wire map과 compile-time typed prefix encode/decode surface를 분리한다.

소스: `packages/codec/src/dim-wire.ts`, `packages/codec/src/typed-sdk.ts`, `packages/sdk/src/dim-wire.test.ts`, `packages/sdk/src/typed-sdk.test.ts`

## 정의 ^defines

- createDimWireCodec(catalog) — `encodeDims`, `decodeDims`, `addressToDims`, `dimsToAddress` 제공
- createIndexSDK(schema) — literal schema에서 prefix/axis/entry 타입을 보존하는 typed SDK 팩토리
- DimWireCodec — prefix 주소와 dim index map 사이의 변환 계약
- TypedIndexSDK — `encode(prefix, coord)`, `decode(prefix, address)` 타입 안전 계약

## 경계 ^boundary

- dim-wire는 table_ref가 아닌 고정 dim을 대상으로 한다.
- `prefix_ref` dim의 값 인코딩/디코딩은 `encodePrefixByValue()` / `decodePrefix()` 계열 책임이며, `encodeDims()` / `decodeDims()`는 명시적으로 거부한다.
- `createIndexSDK()`는 간단한 schema DSL에서 `WeightedIndex` shape를 만들며, full `Catalog` version/snapshot 관리는 `@qa-sdk/core`가 소유한다.

## 소비 ^consumes

- @qa-sdk/core — Catalog, PrefixDef, DimRef 타입
- weighted-index — WeightedIndex 인코딩 엔진

## 관련 소스

- `packages/codec/src/dim-wire.ts` — dim-wire 인코딩
- `packages/codec/src/typed-sdk.ts` — typed index SDK 패턴
