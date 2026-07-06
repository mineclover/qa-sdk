---
def:
  tier: component
  id: skill-def-doctor
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [diagnostics]
  links:
    - target: claude-skill-group
      type: refines
    - target: skill-def-validate
      type: depends_on
    - target: skill-def-audit
      type: depends_on
  sources:
    - skills/def-doctor/SKILL.md

---

# Skill — def-doctor

## 탐색 ^navigation

skill-catalog-system > claude-skill-group > **skill-def-doctor**

## 목적 ^purpose

definition-catalog의 validate, sync, coverage, aspect, annotation 상태를 한 번에 확인하는 통합 진단 진입점이다.

## 사용 맥락 ^context

신규 contributor onboarding, 구조 변경 전후, PR 전 최종 점검에서 가장 먼저 실행한다.

## 피드백 규칙 ^feedback

- doctor 결과가 green인데 workflow-smoke가 실패하면 L3 탐색 회귀로 보고 `semantic-change` 체크리스트를 수행한다.
- 반복되는 annotation 오류는 `@def.boundary`와 `@def.doc` 주석 정비 후보로 본다.

## 관련 소스

- `skills/def-doctor/SKILL.md`

