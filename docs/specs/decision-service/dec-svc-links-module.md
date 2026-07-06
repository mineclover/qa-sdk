---
def:
  tier: component
  id: dec-svc-links-module
  address: def_document:v2:138496
  scope: flow
  aspect: relation
  depth: implementation
  lifecycle: approved
  layer: operation
  svc: decision-service
  tags: [ decision]
  links:
    - target: decision-service-system
      type: refines
    - target: decision-definition-bridge
      type: implements
sources:
  - packages/decision-service/src/modules/links/links.module.ts
  - packages/decision-service/src/modules/links/links.service.ts
  - packages/decision-service/src/modules/links/links.controller.ts
  - packages/decision-service/scripts/services.test.ts
---
# Decision Service — Links Module

## 목적 ^purpose

의사결정 인스턴스와 문서의 연결을 추적. "이 결정이 이 문서를 만들었다/변경했다/승인했다" 관계를 DB에 기록하여, 양방향 추적(결정→문서, 문서→결정)을 가능하게 한다.

## 구성 ^overview

- `LinksService`: link, findByInstance, findByDoc, unlink
- `LinksController`: REST CRUD (/links)
- link_type: created(생성), modified(변경), deprecated(폐기), approved(승인)
- definition-service 참조: 문서 존재 확인 (fail-open — 문서가 나중에 만들어질 수 있음)
- flow_links 테이블: (instance_id, doc_id, link_type) UNIQUE
