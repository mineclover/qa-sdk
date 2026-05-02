---
def:
  tier: component
  id: skill-def-knowledge
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
---
# /def-knowledge — 지식 문서 조회/생성


## 탐색 ^navigation

skill-catalog-system > claude-skill-group > **skill-def-knowledge**

형제: `skill-def-topdown` · `skill-def-bottomup` · `skill-def-context` · `skill-def-audit` · `skill-def-explore` · `skill-def-level` · `skill-def-new` · `skill-def-link` · `skill-def-split` · `skill-def-state`

## 목적 ^purpose

스펙(무엇)에 대응하는 지식(왜) 문서를 조회하거나, 없으면 생성을 유도한다. spec과 knowledge의 양방향 연결을 관리.

## 정의 ^defines

- "왜" 질문 흐름 (spec → incoming links → knowledge 탐색)
- 7종 knowledge_kind별 마커 가이드
- decision-flow → knowledge 승격 경로

## 소비 ^consumes

- definition-catalog (문서 체계, constrains 링크)
- def-new (knowledge 템플릿)
- decision-flow (반복 패턴 감지)

## 관련 소스

- `skills/def-knowledge/SKILL.md` — skill 구현
