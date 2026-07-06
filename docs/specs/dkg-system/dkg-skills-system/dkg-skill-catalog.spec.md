---
def:
  id: dkg-skill-catalog
  tier: system
  address: def_document:v2:342171
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [structural, decision, entry-point, cross-scope]
  links:
    - target: dkg-node-types
      type: refs
    - target: dkg-edge-types
      type: refs
    - target: dkg-skill-catalog-types
      type: contains
    - target: dkg-skill-catalog-registry
      type: contains
    - target: dkg-system
      type: depends_on
sources:
  - packages/dkg/src/dkg.types.ts
  - packages/dkg/src/bootstrap.ts
  - packages/demo-dkg-config/src/index.ts
  - packages/dkg/src/skills/trace.ts
  - packages/dkg/src/skills/service-explorer.ts
  - packages/dkg/src/skills/skill-chain.ts
  - packages/spec-core/src/dkg/index.ts
  - packages/cli/src/commands/dkg.ts
---
# Skill 카탈로그


## 탐색 ^navigation

dkg-system > dkg-skills-system > **dkg-skill-catalog**

형제: `dkg-skill-cascade` · `dkg-skill-migrator` · `dkg-skill-version-event` · `dkg-skill-decision`

## 목적 ^purpose

DKG skill을 등록/조회/실행하는 카탈로그. 각 skill의 targetKinds, specialization, category(read/write/analysis/chain)를 관리한다.

## 구성 ^overview

- `dkg-skill-catalog-types`: SkillNode 타입, 카테고리 분류, 전문화(Specialization) 메커니즘, DKG 등록 체계
- `dkg-skill-catalog-registry`: 39개 skill 전체 목록 + CLI 연결 상태 + 구현 소스 매핑
