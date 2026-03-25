---
def:
  id: dkg-skill-catalog
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  tags: [tier-system]
  links:
    - target: dkg-node-types
      type: depends_on
    - target: dkg-edge-types
      type: depends_on
---
# Skill 카탈로그

## 목적 ^purpose

DKG skill을 등록/조회/실행하는 카탈로그. 각 skill의 targetKinds, specialization, category(read/analysis/chain)를 관리한다.
