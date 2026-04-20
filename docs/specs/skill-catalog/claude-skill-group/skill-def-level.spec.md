---
def:
  tier: component
  id: skill-def-level
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [entry-point, cross-scope, structural]
  links:
    - target: claude-skill-group
      type: refines
    - target: definition-level
      type: depends_on
---
# /def-level — 분해 레벨 관리


## 탐색 ^navigation

skill-catalog-system > claude-skill-group > **skill-def-level**

형제: `skill-def-topdown` · `skill-def-bottomup` · `skill-def-context` · `skill-def-audit` · `skill-def-explore` · `skill-def-knowledge` · `skill-def-new` · `skill-def-link` · `skill-def-split` · `skill-def-state`

## 목적 ^purpose

문서의 전체-부분 분해 구조에서의 위치(system/area/unit/module/leaf)를 선언하고, contains 자식과의 일관성을 검증한다.

## 정의 ^defines

- level 선언/검증 워크플로우
- 분해 판단 기준 (150줄, 2+ scope 혼재)

## 소비 ^consumes

- definition-level (분해 레벨 정의)
- def-split (분해 시 연계)
- def-audit (level 불일치 감지)

## 관련 소스

- `skills/def-level/SKILL.md` — skill 구현
