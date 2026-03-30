---
def:
  id: platform-codec-spec
  level: leaf
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
---
# @qa-sdk/codec — dim-wire 인코딩

## 목적 ^purpose

WeightedIndex 기반 dim-wire 인코딩/디코딩과 typed SDK 패턴을 제공한다. Catalog의 축/prefix 정의를 wire format으로 변환.

## 정의 ^defines

- encodeDimWire() / decodeDimWire() — 차원 인코딩/디코딩
- TypedSdk — 타입 안전한 SDK 래퍼 (Catalog 타입에서 파생)
- createTypedSdk() — TypedSdk 팩토리

## 소비 ^consumes

- @qa-sdk/core — Catalog, PrefixDef, DimRef 타입
- weighted-index — WeightedIndex 인코딩 엔진

## 관련 소스

- `packages/codec/src/dim-wire.ts` — dim-wire 인코딩
- `packages/codec/src/typed-sdk.ts` — TypedSdk 패턴
