---
def:
  id: operational-ontology-behavior-plane
  type: spec
  tier: layout
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: draft
  layer: operation
  svc: operational-ontology
  tags: [structural, runtime]
  links:
    - target: operational-ontology-system
      type: refines
    - target: operational-ontology-schema-validation
      type: refs
    - target: operational-ontology-production-factory
      type: refs
    - target: operational-ontology-prompt-artifact-generation
      type: refs
    - target: operational-ontology-simulation
      type: refs
    - target: operational-ontology-control-flow
      type: refs
    - target: operational-ontology-branch-handling
      type: refs
---

# Operational Ontology Behavior Plane

## 목적 ^purpose

operational ontology의 System behavior를 조망한다. 이 plane은 validation, production factory, prompt artifact generation, simulation, control/branch behavior를 묶지만 Component data vocabulary와 Interface contract를 직접 소유하지 않는다.

## 구성 ^overview

- `operational-ontology-schema-validation`
- `operational-ontology-production-factory`
- `operational-ontology-prompt-artifact-generation`
- `operational-ontology-simulation`
- `operational-ontology-control-flow`
- `operational-ontology-branch-handling`

