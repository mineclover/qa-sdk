---
def:
  tier: component
  id: dx-lifecycle-tooling
  address: def_document:v2:136324
  scope: flow
  aspect: user_scenario
  depth: specification
  lifecycle: approved
  layer: operation
  svc: index-meta
  tags: [entry-point, runtime, versioning]
  links:
    - target: index-codec-spec
      type: refines
    - target: dx-lifecycle-group
      type: refines
sources:
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

# Index Meta DX - 도구 동선

## 목적 ^purpose

index-meta 사용자가 package entrypoint, SDK, resolver, codegen export를 통해 주소 공간을 소비 가능한 형태로 고정하는 도구 동선을 정리한다.

## 상태

implemented

## DX 흐름

- 문제 정의는 "원시 주소 공간을 사람이 다룰 수 있는 형태로 바꾼다"는 요구에서 출발한다.
- `MetaRegistryInput`이 입력 snapshot이다. 이 snapshot에서 `createIndexSDK`, `MetaResolver`, `generateTypes`가 같은 schema 의미를 읽는다.
- `index-meta/client`는 브라우저/Edge/Node.js 소비자용 경량 entrypoint다. SDK, core codec/resolver, errors/types를 export하고 SQL adapter는 포함하지 않는다.
- `index-meta`와 `index-meta/workers`는 store, migration, API payload, codegen까지 포함하는 운영/서버 entrypoint다.
- 사용자는 메타데이터를 직접 조합하기보다, 일관된 도구 흐름을 따라 안전한 기본값을 얻어야 한다.

## 단계

1. schema snapshot을 `MetaRegistryInput`으로 고정한다.
2. 앱 소비자는 `createIndexSDK(input)`으로 version-pinned `IndexClient`를 만들고 encode/decode/matchRanges/constants를 사용한다.
3. 외부 서비스/저장소 소비자는 `MetaResolver.getDecodeMap()` 또는 `getDecodeMapBundle()`로 registry 없는 decode bundle을 전달받는다.
4. 타입 산출물이 필요하면 `generateTypes(input)`을 사용하고, `lintSchema(input)`으로 schema-level diagnostic을 확인한다.
5. schema diff를 사람이 읽는 출력으로 바꿀 때는 `formatSchemaDiff()`를 사용한다.

## 운영 포인트

- DX는 단일 명령의 편의보다 "같은 입력에서 같은 출력이 나오는가"를 우선한다.
- package-local bin CLI를 전제하지 않는다. package.json의 public export map과 source exports가 현재 도구 동선의 authoritative surface다.
- SDK, resolver, codegen은 모두 `index-codec-spec`이 제공하는 VersionedValue/DecodeMap 해석 모델과 어긋나지 않아야 한다.
- 와이어 포맷과 타입 추론 같은 소비자 계약은 `dx-lifecycle-contract`에서 이어서 다룬다.
