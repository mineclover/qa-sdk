---
def:
  tier: component
  id: skill-def-explore
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [entry-point, cross-scope, structural]
  links:
    - target: claude-skill-group
      type: refines
    - target: definition-catalog-spec
      type: depends_on
    - target: definition-frontmatter-metadata-system
      type: depends_on
sources:
  - skills/def-explore/SKILL.md
---
# /def-explore — 시스템 구조 탐색


## 탐색 ^navigation

skill-catalog-system > claude-skill-group > **skill-def-explore**

형제: `skill-def-topdown` · `skill-def-bottomup` · `skill-def-context` · `skill-def-audit` · `skill-def-knowledge` · `skill-def-level` · `skill-def-new` · `skill-def-link` · `skill-def-split` · `skill-def-state`

## 목적 ^purpose

qa-sdk 시스템의 문서 체계를 탐색하고 이해하는 가이드. 시스템 철학, E/C/I/S + L/P 책임, frontmatter metadata option system, 분류 체계, 서비스 구조를 안내한다.

## 정의 ^defines

- 탐색 진입점 (guide, topdown, search, context)
- 시스템 영역별 규모 요약
- frontmatter option catalog 진입점 (`definition-frontmatter-metadata-system`, `definition-metadata-*`)

## 소비 ^consumes

- definition-catalog (문서 체계)
- definition-taxonomy (분류 축)
- definition-frontmatter-metadata-system (metadata option catalog)
- CLI def 서브커맨드 (guide, topdown, search, context)

## 관련 소스

- `skills/def-explore/SKILL.md` — skill 구현
