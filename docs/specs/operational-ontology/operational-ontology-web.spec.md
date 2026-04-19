---
def:
  id: operational-ontology-web
  type: spec
  level: leaf
  scope: ui
  aspect: component
  depth: specification
  lifecycle: draft
  layer: experience
  svc: operational-ontology-web
  tags: [frontend, visualization]
  links:
    - target: operational-ontology-system
      type: refines
  source: packages/operational-ontology-web
---

# @qa-sdk/operational-ontology-web — operational ontology 탐색 UI

## 목적 ^purpose

operational ontology store와 snapshot을 브라우저에서 탐색·시각화하는 독립 웹 앱. pack/component/system 구조를 트리 + 그래프로 렌더링하고, readiness 상태·validation 결과를 실시간으로 확인할 수 있도록 한다.
