---
def:
  id: operational-ontology-observation-plane
  type: spec
  tier: layout
  scope: flow
  aspect: relation
  depth: overview
  lifecycle: draft
  layer: operation
  svc: operational-ontology
  tags: [structural, observability]
  links:
    - target: operational-ontology-system
      type: refines
    - target: operational-ontology-flow-corridor
      type: refs
    - target: operational-ontology-junction
      type: refs
    - target: operational-ontology-checkpoint
      type: refs
    - target: operational-ontology-observation-topology
      type: refs
    - target: operational-ontology-information-transmission
      type: refs
    - target: operational-ontology-lineage
      type: refs
---

# Operational Ontology Observation Plane

## 목적 ^purpose

operational ontology의 observation semantics를 조망한다. corridor, junction, checkpoint, transmission, lineage를 한 plane으로 묶어 관측 해석 경계를 안정화한다.

## 구성 ^overview

- `operational-ontology-flow-corridor`
- `operational-ontology-junction`
- `operational-ontology-checkpoint`
- `operational-ontology-observation-topology`
- `operational-ontology-information-transmission`
- `operational-ontology-lineage`

