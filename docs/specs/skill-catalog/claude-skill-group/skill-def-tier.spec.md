---
def:
  tier: component
  id: skill-def-tier
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [taxonomy]
  links:
    - target: claude-skill-group
      type: refines
    - target: skill-def-level
      type: depends_on
    - target: definition-metadata-tier
      type: depends_on
  sources:
    - skills/def-tier/SKILL.md

---

# Skill — def-tier

## 탐색 ^navigation

skill-catalog-system > claude-skill-group > **skill-def-tier**

## 목적 ^purpose

definition-catalog 문서의 STC tier(system/layout/component/entry)를 결정하고 잘못된 tier drift를 줄인다. `tier` option 자체의 의미는 `definition-metadata-tier`가 소유하고, 이 skill은 적용 판단 절차를 소유한다.

## 사용 맥락 ^context

새 문서 생성, root/module 분리, layout/system 경계 변경 시 사용한다.

## 피드백 규칙 ^feedback

- tier 변경이 여러 문서에 전파되면 `semantic-change` 대상이다.
- level과 tier가 충돌하면 먼저 `def-level`로 분해 역할을 확정한다.
- tier option 의미가 애매하면 `definition-metadata-tier`를 먼저 확인한다.

## 관련 소스

- `skills/def-tier/SKILL.md`
