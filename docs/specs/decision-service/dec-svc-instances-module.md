---
def:
  tier: component
  id: dec-svc-instances-module
  address: def_document:v2:68864
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
    - target: dec-svc-data-model
      type: depends_on
---
# Decision Service — Instances Module

## 목적 ^purpose

FlowInstance(의사결정 실행 이력)를 DB에 영속화하고 조회. CLI의 로컬 SQLite 역할을 서버로 이관하여 다중 클라이언트 간 공유 가능하게 한다.

## 구성 ^overview

- `InstancesService`: save(upsert), get, findBySchema, findByStatus, list(limit/offset)
- `InstancesController`: REST CRUD (/instances)
- status: active → completed / abandoned
- selections: gate 선택 이력 (evidence 포함)
- address: 선택 경로의 좌표 주소 (WeightedIndex 인코딩)
