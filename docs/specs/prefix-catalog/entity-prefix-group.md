---
def:
  id: entity-prefix-group
  address: def_document:v2:345088
  scope: data
  aspect: prefix_schema
  depth: overview
  lifecycle: approved
  layer: domain
  tags: [structural, entry-point, generated]
  links:
    - target: prefix-service
      type: contains
    - target: prefix-content
      type: contains
    - target: prefix-tracking
      type: contains
    - target: prefix-contract_check
      type: contains
    - target: prefix-execution_context
      type: contains
---

## 목적 ^purpose

서비스/콘텐츠 등 실체 prefix
category: entity에 해당하는 prefix를 모아 관리한다.

## 구성 ^overview

- `service`
- `content`
- `tracking`
- `contract_check`
- `execution_context`
