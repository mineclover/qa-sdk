---
def:
  id: dkg-edge-types
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  tags: [tier-system]
  links:
    - target: dkg-node-types
      type: depends_on
---
# DKG 엣지 유형

## 목적 ^purpose

DKG 노드 간 관계를 표현하는 18종 엣지 타입. 각 엣지는 설계 요소 간의 구조적 관계(composes, observes, contains, references 등)를 나타낸다.

## 구성 ^overview

18종: composes, observes, contains, references, produces, consumes, has-dim, has-entry, belongs-to, exports, imports, constrains, triggers, justifies, binds-to, classifies, violates, cascades.
