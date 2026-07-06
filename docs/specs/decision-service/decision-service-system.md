---
def:
  id: decision-service-system
  tier: layout
  address: def_document:v2:68620
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: operation
  svc: decision-service
  tags: [structural, entry-point, decision]
  links:
    - target: df-system
      type: depends_on
    - target: definition-service-system
      type: depends_on
    - target: decision-definition-bridge
      type: implements
    - target: dec-svc-data-model
      type: refs
    - target: dec-svc-schemas-module
      type: refs
    - target: dec-svc-instances-module
      type: refs
    - target: dec-svc-links-module
      type: refs
    - target: dec-svc-api-contract
      type: refs
    - target: dec-svc-state-model
      type: refs
    - target: dec-svc-constraints
      type: refs
sources:
  - packages/decision-service/src/main.ts
  - packages/decision-service/src/app.module.ts
  - packages/decision-service/src/database.module.ts
  - packages/decision-service/src/modules/schemas/schemas.module.ts
  - packages/decision-service/src/modules/instances/instances.module.ts
  - packages/decision-service/src/modules/links/links.module.ts
  - packages/decision-service/scripts/services.test.ts
---
# Decision Service — 시스템 개요

## 목적 ^purpose

FlowSchema와 FlowInstance를 DB로 관리하고, 의사결정과 문서의 연결(flow_links)을 추적하는 마이크로서비스. decision-flow 라이브러리의 런타임 데이터를 영속화하며, definition-service를 HTTP로 참조하여 문서 존재를 확인한다.

## 구성 ^overview

- NestJS + Fastify + SQLite, 포트 3800
- 3개 모듈: schemas, instances, links
- DB: flow_schemas + flow_instances + flow_links
- definition-service 참조: 문서 존재 확인 (fail-open)
- decision-flow 라이브러리 의존: FlowSchema/FlowInstance 타입 공유
