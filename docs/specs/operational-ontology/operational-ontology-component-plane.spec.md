---
def:
  id: operational-ontology-component-plane
  type: spec
  tier: layout
  scope: data
  aspect: system_data
  depth: overview
  lifecycle: draft
  layer: domain
  svc: operational-ontology
  tags: [structural, data]
  links:
    - target: operational-ontology-system
      type: refines
    - target: operational-ontology-taxonomy-schema
      type: refs
    - target: operational-ontology-relation-category-schema
      type: refs
    - target: operational-ontology-core-model
      type: refs
    - target: operational-ontology-relation-taxonomy
      type: refs
    - target: operational-ontology-edge-assertion
      type: refs
    - target: operational-ontology-category-constraint
      type: refs
    - target: operational-ontology-traversal-coordinate
      type: refs
    - target: operational-ontology-data-facets
      type: refs
    - target: operational-ontology-persistence
      type: refs
---

# Operational Ontology Component Plane

## 목적 ^purpose

operational ontology의 Component vocabulary를 조망한다. 이 plane은 data shape, state-like vocabulary, relation/category/traversal coordinate, persistence shape를 묶지만 behavior를 소유하지 않는다.

## 구성 ^overview

- `operational-ontology-taxonomy-schema`
- `operational-ontology-relation-category-schema`
- `operational-ontology-core-model`
- `operational-ontology-relation-taxonomy`
- `operational-ontology-edge-assertion`
- `operational-ontology-category-constraint`
- `operational-ontology-traversal-coordinate`
- `operational-ontology-data-facets`
- `operational-ontology-persistence`

