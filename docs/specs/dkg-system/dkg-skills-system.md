---
def:
  id: dkg-skills-system
  level: module
  address: def_document:v1:536
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [structural, tier-system]
  links:
    - target: dkg-skill-cascade
      type: contains
    - target: dkg-skill-migrator
      type: contains
    - target: dkg-skill-version-event
      type: contains
    - target: dkg-skill-decision
      type: contains
    - target: dkg-skill-catalog
      type: contains
---

# DKG Skills 시스템

## 목적 ^purpose

DKG 그래프의 빈 곳을 자동으로 채우는 5개 skill. 종단 cascade, migrator 추론, VersionEvent 파생, Decision 템플릿, skill 카탈로그.

## 구성 ^overview

- `dkg-skill-cascade`: DKG 그래프에서 특정 노드 변경의 영향을 종단까지 추적하는 skill.
- `dkg-skill-migrator`: 축/prefix 변경 시 필요한 마이그레이션 경로를 자동 추론하는 skill.
- `dkg-skill-version-event`: 두 버전 간 diff에서 VersionEvent를 자동 생성하는 skill.
- `dkg-skill-decision`: 구조화된 의사결정 문서를 자동 생성하는 skill.
- `dkg-skill-catalog`: DKG skill을 등록/조회/실행하는 카탈로그.
