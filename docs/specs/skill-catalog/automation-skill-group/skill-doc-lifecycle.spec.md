---
def:
  tier: component
  id: skill-doc-lifecycle
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [documentation]
  links:
    - target: automation-skill-group
      type: refines
    - target: skill-spec-lifecycle
      type: depends_on
sources:
  - skills/doc-lifecycle/SKILL.md
  - docs/specs/system/doc-type-convention.spec.md
---

# Skill — doc-lifecycle

## 탐색 ^navigation

skill-catalog-system > automation-skill-group > **skill-doc-lifecycle**

## 목적 ^purpose

spec/rule/todo/test/cases/memo/plan 문서의 생성, 승격, 상태 조회, 정합성 검증을 표준화한다.

## 사용 맥락 ^context

새 authoring family를 만들거나 TODO를 spec/memo로 승격해야 할 때 사용한다.

## 피드백 규칙 ^feedback

- `.todo.md` 완료 항목이 오래 남으면 prune 또는 memo 전환 후보로 본다.
- `.rule.md`/`.cases.md`가 spec 없이 생기면 family authority 누락으로 본다.

## 관련 소스

- `skills/doc-lifecycle/SKILL.md`
- `docs/specs/system/doc-type-convention.spec.md`

