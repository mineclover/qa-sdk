---
def:
  id: docs-explorer-spec
  address: def_document:v2:1025
  scope: ui
  aspect: component
  depth: overview
  lifecycle: approved
  layer: experience
  tags: []
  links:
    - target: definition-catalog-spec
      type: depends_on
---
# Docs Explorer

## 목적 ^purpose

definition-catalog 기반 문서 탐색기 웹 UI. 453건 이상의 스펙 문서를 scope/layer/lifecycle 필터로 탐색하고, 문서 간 링크 그래프를 시각화한다.

## 구성 ^overview

- definition-catalog 데이터를 소비하여 트리/그래프 뷰 제공
- 소스: `packages/docs-explorer/`
