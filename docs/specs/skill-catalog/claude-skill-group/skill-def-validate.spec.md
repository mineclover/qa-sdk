---
def:
  tier: component
  id: skill-def-validate
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [validation]
  links:
    - target: claude-skill-group
      type: refines
    - target: skill-def-audit
      type: traces_to
sources:
  - skills/def-validate/SKILL.md
---

# Skill — def-validate

## 탐색 ^navigation

skill-catalog-system > claude-skill-group > **skill-def-validate**

## 목적 ^purpose

definition-catalog validate 오류와 경고를 유형별로 분류하고, 우선순위에 따라 수정하는 검증 루틴이다.

## 사용 맥락 ^context

frontmatter, contains/refines 링크, level, aspect, code-boundary 오류를 해소해야 할 때 사용한다.

## 피드백 규칙 ^feedback

- validator green만으로 L3 workflow가 안전하다고 보지 않는다. 탐색/doctor/smoke 결과를 함께 확인한다.
- suppression이 필요하면 먼저 suppression rule 문서를 갱신한다.

## 관련 소스

- `skills/def-validate/SKILL.md`

