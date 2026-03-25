---
def:
  id: dkg-skills-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
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

5개 skill: analyzeImpact(종단 cascade), inferMigrator(마이그레이션 추론), VersionEvent.fromDiff(버전 이벤트 자동 파생), Decision.scaffold(의사결정 템플릿), Skill Catalog(skill 등록/조회).
