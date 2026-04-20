---
def:
  tier: component
  id: dec-svc-schemas-module
  address: def_document:v2:68865
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: operation
  svc: decision-service
  tags: [ decision]
  links:
    - target: decision-service-system
      type: refines
---
# Decision Service — Schemas Module

## 목적 ^purpose

FlowSchema의 CRUD를 담당. gate 구성(weight, cognitive phase, branches)을 DB에 영속화하여 CLI/에이전트가 스키마를 동적으로 조회·등록할 수 있게 한다.

## 구성 ^overview

- `SchemasService`: register(upsert), get, list, delete
- `SchemasController`: REST CRUD (/schemas)
- gate.weight: core / structural / tactical
- gate.phase: perceive / interpret / evaluate / decide / plan / execute / reflect
