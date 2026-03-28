---
def:
  id: decision-service-system
  address: def_document:v2:68620
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: operation
  svc: decision-service
  tags: [structural, entry-point, tier-infra, decision]
  links:
    - target: df-system
      type: depends_on
    - target: definition-service-system
      type: depends_on
    - target: decision-definition-bridge
      type: implements
    - target: dec-svc-data-model
      type: contains
    - target: dec-svc-schemas-module
      type: contains
    - target: dec-svc-instances-module
      type: contains
    - target: dec-svc-links-module
      type: contains
    - target: dec-svc-api-contract
      type: contains
    - target: dec-svc-state-model
      type: contains
    - target: dec-svc-constraints
      type: contains
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
