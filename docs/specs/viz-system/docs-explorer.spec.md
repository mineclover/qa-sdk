---
def:
  tier: component
  id: docs-explorer-spec
  address: def_document:v2:1025
  scope: ui
  aspect: component
  depth: overview
  lifecycle: approved
  layer: experience
  svc: docs-explorer
  tags: [entry-point, frontend, cross-scope]
  links:
    - target: definition-catalog-spec
      type: depends_on
sources:
  - packages/definition-service/src/modules/docs/docs.service.ts
  - packages/definition-service/src/modules/graphql/doc.resolver.ts
  - packages/definition-service/src/modules/graph/graph.service.ts
  - packages/definition-catalog/src/registry.ts
---
# Docs Explorer

## 목적 ^purpose

definition-catalog 기반 문서 탐색 표면. definition-service의 docs/GraphQL query API가 scope/layer/lifecycle 필터와 문서 링크 그래프를 제공하고, UI 소비자는 이 읽기 모델을 탐색 표면으로 사용한다.

## 구성 ^overview

- definition-catalog 데이터를 소비하여 문서 목록, 상세, 링크/impact 그래프 조회 제공
- 소스: `packages/definition-service/src/modules/docs/`, `packages/definition-service/src/modules/graphql/`, `packages/definition-catalog/src/registry.ts`
