---
def:
  tier: component
  id: index-arch-traceability
  address: def_document:v2:137351
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [runtime, observability, structural]
  links:
    - target: index-arch-layers
      type: depends_on
    - target: index-arch-group
      type: refines
sources:
  - packages/weighted-index/src/index.ts
  - packages/weighted-index/src/math/weighted-index.ts
  - packages/weighted-index/src/math/weighted-index.test.ts
  - packages/weighted-index/src/math/calc.ts
  - packages/weighted-index/src/math/calc.test.ts
  - packages/weighted-index/package.json
  - packages/weighted-index/src/vocab/label-registry.ts
  - packages/weighted-index/src/vocab/label-registry.test.ts
  - packages/weighted-index/src/vocab/prefix-registry.ts
  - packages/weighted-index/src/vocab/prefix-registry.test.ts
  - packages/weighted-index/src/vocab/partial-binder.ts
  - packages/weighted-index/src/vocab/partial-binder.test.ts
  - packages/weighted-index/src/protocol/semantic-address.ts
  - packages/weighted-index/src/protocol/semantic-address.test.ts
  - packages/weighted-index/src/protocol/pack-format.ts
  - packages/weighted-index/src/protocol/pack-format.test.ts
  - packages/weighted-index/src/protocol/capacity-planner.ts
  - packages/weighted-index/src/protocol/capacity-planner.test.ts
  - packages/index-meta/src/meta-registry.ts
  - packages/index-meta/src/meta-registry.test.ts
  - packages/index-meta/src/meta-resolver.ts
  - packages/index-meta/src/meta-resolver.test.ts
  - packages/index-meta/src/meta-codec.ts
  - packages/index-meta/src/meta-codec.test.ts
  - packages/index-meta/src/address-protocol-manager.ts
  - packages/index-meta/src/address-protocol-manager.test.ts
  - packages/spec-core/src/semantic-indexing-pack/index.ts
  - packages/spec-core/src/semantic-indexing-pack/types.ts
  - packages/spec-core/src/semantic-indexing-pack/manifest.ts
  - packages/spec-core/src/semantic-indexing-pack/classify.ts
  - packages/spec-core/src/semantic-indexing-pack/compatibility.ts
  - packages/spec-core/src/semantic-indexing-pack/report.ts
  - packages/spec-core/src/semantic-indexing-pack/grounding.ts
  - packages/spec-core/src/semantic-indexing-pack/semantic-indexing-pack.test.ts

---

# 인덱싱 아키텍처 - 검증과 추적성

## 목적 ^purpose

문서 스펙, 식별자 규약, 검증 파이프라인, 구현 상태 추적을 분리해 아키텍처 변경이 어떤 산출물에 전파되는지 설명한다.

## 문서 투영과 식별자 규약

- Document Spec은 설계 문서가 schema와 runtime 계약으로 투영되는 최소 단위를 정의한다.
- 식별자 규약은 축, prefix, runtime artifact가 같은 이름 체계를 공유하도록 강제한다.
- 이 규약이 어긋나면 codegen, registry, decode에서 서로 다른 의미를 읽게 된다.

## 검증 파이프라인

- 검증은 문서 -> schema -> runtime 순서로 내려가며, 역방향으로는 결과만 피드백한다.
- 추적성은 각 레이어 산출물이 어느 문서 근거에서 왔는지 되짚을 수 있어야 한다.
- 현재 구현 상태는 완료/초안/다음 단계 구분으로 관리하고, 주의사항은 이 경계가 깨질 때만 문서화한다.
