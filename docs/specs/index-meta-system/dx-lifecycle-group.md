---
def:
  id: dx-lifecycle-group
  tier: system
  address: def_document:v2:137218
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  svc: index-meta
  tags: [structural, cross-scope]
  links:
    - target: dx-lifecycle-tooling
      type: contains
    - target: dx-lifecycle-contract
      type: contains
    - target: index-meta-system
      type: depends_on
sources:
  - docs/specs/index-meta-system/dx-lifecycle-group/dx-lifecycle-tooling.spec.md
  - docs/specs/index-meta-system/dx-lifecycle-group/dx-lifecycle-contract.spec.md
  - packages/index-meta/package.json
  - packages/index-meta/src/index-sdk.ts
  - packages/index-meta/src/client.ts
  - packages/index-meta/src/meta-resolver.ts
  - packages/index-meta/src/codegen.ts
  - packages/index-meta/src/index.ts
  - packages/index-meta/src/workers.ts
  - packages/index-meta/src/meta-resolver.test.ts
  - packages/index-meta/src/meta-codec.test.ts
---

# Index Meta DX 라이프사이클 그룹

## 목적 ^purpose

index-meta 개발자 경험 문서를 package entrypoint/API 동선과 출력 계약으로 분리해 SDK, resolver bundle, codegen export의 흐름을 단계별로 설명한다.

## 구성 ^overview

- `dx-lifecycle-tooling`: 문제 정의, package entrypoint, SDK 생성, resolver/codegen export 흐름을 정리한 문서.
- `dx-lifecycle-contract`: 와이어 포맷, 타입 추론, 제약 조건을 정리한 문서.

## 상태

implemented

## source-backed 경계

- `index-meta` 패키지 자체에는 bin CLI가 없다. 현재 DX 표면은 package export(`.`, `./client`, `./decode`, `./workers`)와 exported functions다.
- 브라우저/Edge 소비자는 `index-meta/client`에서 `createIndexSDK`, `MetaCodec`, `MetaResolver`, `PrefixDecoder`를 가져온다.
- Node.js/Workers 소비자는 main/workers entrypoint에서 store, migration, API payload, codegen 함수를 함께 소비한다.
- DecodeMap, range, dataset 출력 계약은 `MetaResolver`와 `MetaCodec` 테스트가 검증한다.

원본: `docs/specs/indexing/index-meta/dx-lifecycle.spec.md` (`dx-lifecycle-spec`)
