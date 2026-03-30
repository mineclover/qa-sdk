---
def:
  id: claude-skill-group
  level: module
  address: def_document:v2:68614
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: experience
  tags: [structural, entry-point, generated]
  links:
    - target: skill-def-boundary
      type: contains
    - target: skill-def-topdown
      type: contains
    - target: skill-def-bottomup
      type: contains
    - target: skill-def-context
      type: contains
    - target: skill-def-audit
      type: contains
    - target: skill-def-explore
      type: contains
    - target: skill-def-knowledge
      type: contains
    - target: skill-def-level
      type: contains
    - target: skill-def-new
      type: contains
    - target: skill-def-link
      type: contains
    - target: skill-def-split
      type: contains
    - target: skill-def-state
      type: contains
---


## 탐색 ^navigation

skill-catalog-system > **claude-skill-group**

형제: `automation-skill-group` · `ralph-tui-skill-group` · `dkg-skill-group` · `cli-command-group`

## 목적 ^purpose

definition-catalog를 읽고, 만들고, 분해하고, 상태를 관리하는 핵심 스킬 묶음이다.
문서 작업 전 탐색과 감사 루틴, boundary 구조화 루틴을 표준화해 스킬 간 사용 순서를 고정한다.

## 구성 ^overview

- `def-boundary`
- `def-topdown`
- `def-bottomup`
- `def-context`
- `def-audit`
- `def-explore`
- `def-knowledge`
- `def-level`
- `def-new`
- `def-link`
- `def-split`
- `def-state`

## 경계 ^boundary

이 문서는 `docs/specs/skill-catalog/` 계층의 메타 스펙이다.
- 실제 실행 지침은 `skills/def-*/SKILL.md`
- 운영 관점의 묶음 설명은 `docs/skills/`

즉 이 그룹 문서는 skill 자체가 아니라 skill 관계와 사용 목적을 설명한다.
