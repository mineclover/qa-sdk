---
def:
  id: qa-sdk-core-system
  type: spec
  tier: system
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: core
  tags: [structural, runtime]
  links:
    - target: weighted-index-system
      type: depends_on
    - target: indexing-core-system
      type: depends_on
    - target: index-meta-system
      type: depends_on
    - target: sdk-system
      type: depends_on
    - target: platform-chain-system
      type: depends_on
    - target: platform-core-spec
      type: refs
    - target: storage-system
      type: refs
    - target: meta-semantic-system
      type: refs
    - target: bdd-contract-system
      type: refs
    - target: system-data-flow
      type: refs
    - target: wi-api
      type: refs
    - target: sdk-api-surface
      type: refs
sources:
  - packages/core/package.json
  - packages/core/specs/README.md
  - packages/core/src/index.ts
  - packages/core/src/catalog/index.ts
  - packages/core/src/catalog/runtime.ts
  - packages/core/src/types/record.ts
  - packages/core/src/types/envelope.ts
  - packages/core/src/types/service-identity.ts
  - packages/core/src/types/graph.ts
  - packages/core/src/types/verdict.ts
  - packages/core/src/ports/record-store.port.ts
  - packages/core/src/ports/trace-store.port.ts
  - packages/core/src/ports/session-store.port.ts
  - packages/core/src/ports/transmission-store.port.ts
  - packages/core/src/ports/scenario-spec-store.port.ts
  - packages/core/src/ports/verdict-store.port.ts
  - packages/core/src/schema/record.schema.ts
  - packages/core/src/schema/scenario.schema.ts
  - packages/core/src/bdd-contract/compile-scenario.ts
  - packages/core/src/pipe/index.ts
  - packages/core/src/meta-semantic/index.ts
  - packages/core/src/standards/index.ts
  - packages/core/src/platform/index.ts
  - docs/specs/platform-chain/platform-core-spec.md
  - docs/specs/platform-chain/platform-chain-system.md
  - docs/specs/ingest/record.spec.md
  - docs/specs/ingest/trace.spec.md
  - docs/specs/ingest/session-spec.md
  - docs/specs/ingest/transmission.spec.md
  - docs/specs/ingest/scenario.spec.md
  - docs/specs/ingest/verdict.spec.md
  - docs/specs/storage-system/storage-system.md
  - docs/specs/storage-system/graph.spec.md
  - docs/specs/storage-system/scenario-spec-store.spec.md
  - docs/specs/storage-system/utils.spec.md
  - docs/specs/meta-semantic/meta-semantic-system.spec.md
  - docs/specs/bdd-system/bdd-contract-system.spec.md
  - docs/specs/system/system-data-flow.spec.md
  - docs/specs/indexing-core-system/indexing-core-system.md
  - docs/specs/index-meta-system/index-meta-system.md
  - docs/specs/index-meta-system/sdk-system.md
  - docs/specs/weighted-index-system.spec.md
---

# QA-SDK Core System

## 목적 ^purpose

전체 QA-SDK 시스템에서 공통으로 사용되는 catalog runtime, 이벤트/전송/서비스 타입, 저장 포트, schema, pipe/meta-semantic/standard helper의 root export를 소유한다. downstream 패키지는 `@qa-sdk/core`, `@qa-sdk/core/catalog`, `@qa-sdk/core/platform`, `@qa-sdk/core/coordinates/*`를 소비하지만, core는 downstream 패키지에 의존하지 않는 foundation boundary다.

## 구성 ^overview

- `platform-core-spec`: `@qa-sdk/core` root package의 좁은 public export와 서비스 전용 `@qa-sdk/core/platform` export.
- `ingest/*`, `storage-system/*`: `EventRecord`, `TransmissionEnvelope`, `QaSession`, `Trace`, `ScenarioSpec`, `SpecGraph`, `RuntimeGraph`, `VerdictReport`와 저장 포트 계약.
- `bdd-contract-system`: Given/When/Then 기반 행동 계약 타입, schema, ScenarioSpec/PipeGraph compile.
- `meta-semantic-system`: Module/Data/Pipe IR, extraction pipeline, nesting bridge, spacetime UID.
- `weighted-index-system`: 주소 압축/해석의 수학적 core.
- `indexing-core-system`: 좌표계 기반 원리, schema layer, traversal, table system.
- `index-meta-system`: index metadata registry, codec, resolver, SDK 시나리오.
- `sdk-system`: public SDK API surface, constants, dimension view.
- `platform-chain-system`: platform runtime 공통 codec/context/logger/sdk 계약.
- `wi-api`, `sdk-api-surface`: 외부 소비자가 직접 사용하는 core public API.

## 검증 ^validation

```bash
corepack pnpm --filter @qa-sdk/core build
corepack pnpm --filter @qa-sdk/core typecheck
corepack pnpm --filter @qa-sdk/core test
corepack pnpm def:check
corepack pnpm arch:feedback
```
