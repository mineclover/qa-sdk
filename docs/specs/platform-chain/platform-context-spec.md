---
def:
  id: platform-context-spec
  level: leaf
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
---
# @qa-sdk/context — QA 컨텍스트 프로바이더

## 목적 ^purpose

서비스/SDK가 사용하는 QA 컨텍스트(Catalog, 세션, 서비스 정보)를 통합 제공한다. CatalogProvider를 통해 런타임에 Catalog를 공급.

## 정의 ^defines

- QaContext — 통합 컨텍스트 객체
- createQaContext() — 컨텍스트 팩토리
- CatalogProvider 구현 (환경변수 fallback 지원)

## 소비 ^consumes

- @qa-sdk/core — Catalog, CatalogProvider, ServiceBootConfig

## 관련 소스

- `packages/context/src/qa-context.ts` — QaContext 구현
- `packages/context/src/catalog-provider.ts` — CatalogProvider
