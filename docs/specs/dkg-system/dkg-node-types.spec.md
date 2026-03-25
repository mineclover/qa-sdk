---
def:
  id: dkg-node-types
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  tags: [tier-system]
  links:
    - target: system-concepts
      type: depends_on
---
# DKG 노드 유형

## 목적 ^purpose

DKG 그래프를 구성하는 16종 노드 타입. 각 노드는 좌표 시스템의 하나의 설계 요소(축, prefix, 도메인, 서비스 등)를 나타낸다.

## 구성 ^overview

16종: prefix, axis, domain, dsl-bundle, service, category, table, dim, entry, observation, intent-link, scenario, skill, flow-schema, decision, metric.
DEMO_CATALOG에서 bootstrapDkg()로 자동 파생.
