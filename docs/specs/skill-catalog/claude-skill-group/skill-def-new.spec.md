---
def:
  id: skill-def-new
  address: def_document:v2:68798
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [generated]
  links:
    - target: claude-skill-group
      type: refines
    - target: skill-def-context
      type: depends_on
    - target: skill-def-link
      type: traces_to
---


## 탐색 ^navigation

skill-catalog-system > claude-skill-group > **skill-def-new**

형제: `skill-def-topdown` · `skill-def-bottomup` · `skill-def-context` · `skill-def-audit` · `skill-def-explore` · `skill-def-knowledge` · `skill-def-level` · `skill-def-link` · `skill-def-split` · `skill-def-state`

## 목적 ^purpose

definition-catalog 규약을 따르는 새 문서를 안정적으로 시작하게 해, frontmatter와 목적/구성 마커 누락을 줄이는 생성 스킬이다.

## 사용 맥락 ^context

새 스펙, 가이드, knowledge 문서를 만들 때 사용한다.
특히 scope/aspect/depth를 정하는 순간부터 문서 계약을 맞춰야 할 때 유용하다.

## 설계 의도 ^intent

빈 파일에서 시작하면 frontmatter와 marker 누락이 흔하므로 생성 시점에 최소 구조를 강제한다.
이렇게 해야 이후 audit, split, link, state 스킬이 같은 전제를 공유할 수 있다.

## 피드백 규칙 ^feedback

- 생성 후 purpose 누락이나 links 누락이 반복되면 템플릿 안내를 더 강화한다.
- knowledge 문서 생성이 자주 이어지면 knowledge-kind 예시를 더 풍부하게 제공한다.

## 주의사항 ^caveat

문서를 만드는 것만으로 품질이 보장되지는 않는다.
생성 직후에는 context, link, audit 같은 후속 스킬로 구조를 정리해야 한다.

## 관련 소스

- `skills/def-new/SKILL.md`
