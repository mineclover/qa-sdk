---
def:
  id: platform-context-spec
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: context
  tags: [runtime, structural, observability]
  links:
    - target: platform-chain-system
      type: refines
    - target: platform-core-spec
      type: depends_on
sources:
  - packages/context/src/index.ts
  - packages/context/src/qa-context.ts
  - packages/context/src/catalog-provider.ts
  - packages/context/scripts/smoke.mjs
  - packages/sdk/src/qa-context.test.ts
  - packages/sdk/src/context.test.ts
---
# @qa-sdk/context — QA 컨텍스트 프로바이더

## 목적 ^purpose

서비스/SDK가 사용하는 catalog, service identity, address_context 생성 규칙을 통합 제공한다. 정적 catalog 또는 registry-backed `CatalogProvider`를 통해 catalog를 공급하고, `ServiceBootConfig`/환경값에서 service context를 자동 파생한다.

소스: `packages/context/src/qa-context.ts`, `packages/context/src/catalog-provider.ts`, `packages/sdk/src/qa-context.test.ts`, `packages/context/scripts/smoke.mjs`

## 정의 ^defines

- QaContext — 통합 컨텍스트 객체
- createQaContext() — 컨텍스트 팩토리
- createQaContextAsync() — CatalogProvider 기반 async context 생성
- createCatalogProvider() — local catalog 또는 registry URL 기반 catalog provider
- track() / readContext() — prefix dims와 `address_context` 상호 변환
- useDsl() — 지정된 DSL bundle member prefix만 track하는 세션 경계

## 경계 ^boundary

- `createQaContext()`는 catalog가 없으면 실패한다. 자동 demo fallback은 `createCatalogProvider()`의 local provider 경로가 담당한다.
- `service`, `env`, `region`, `namespace`는 `serviceConfig`가 있으면 그 값을 우선하고, 없으면 기존 config/env 값을 사용한다.
- registry provider는 fetch 실패 시 local `demo-snapshot` fallback을 시도하되, local snapshot도 없으면 실패한다.

## 소비 ^consumes

- @qa-sdk/core — Catalog, CatalogProvider, ServiceBootConfig

## 관련 소스

- `packages/context/src/qa-context.ts` — QaContext 구현
- `packages/context/src/catalog-provider.ts` — CatalogProvider
