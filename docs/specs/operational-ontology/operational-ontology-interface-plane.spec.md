---
def:
  id: operational-ontology-interface-plane
  type: spec
  tier: layout
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: draft
  layer: mediation
  svc: operational-ontology
  tags: [structural, contract]
  links:
    - target: operational-ontology-system
      type: refines
    - target: operational-ontology-persistence-cli
      type: refs
    - target: operational-ontology-pack-interface
      type: refs
    - target: operational-ontology-runtime-interface
      type: refs
    - target: operational-ontology-package-architecture
      type: refs
    - target: operational-ontology-visualization-web
      type: refs
    - target: operational-ontology-web
      type: refs
    - target: operational-ontology-ssot-navigation-guide
      type: refs
    - target: operational-ontology-rdf-bridge
      type: refs
---

# Operational Ontology Interface Plane

## 목적 ^purpose

operational ontology의 Interface/DSL 소비 표면과 package/web/bridge 조망을 묶는다. 이 plane은 system을 어떻게 소비하고 외부와 연결하는지 설명하며, runtime behavior와 data vocabulary를 직접 소유하지 않는다.

## 구성 ^overview

- `operational-ontology-pack-interface`
- `operational-ontology-persistence-cli`
- `operational-ontology-runtime-interface`
- `operational-ontology-package-architecture`
- `operational-ontology-visualization-web`
- `operational-ontology-web`
- `operational-ontology-ssot-navigation-guide`
- `operational-ontology-rdf-bridge`
