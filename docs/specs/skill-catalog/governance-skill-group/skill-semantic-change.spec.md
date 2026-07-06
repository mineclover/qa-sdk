---
def:
  tier: component
  id: skill-semantic-change
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [governance, validation]
  links:
    - target: governance-skill-group
      type: refines
  sources:
    - skills/semantic-change/SKILL.md

---

# Skill — semantic-change

## 탐색 ^navigation

skill-catalog-system > governance-skill-group > **skill-semantic-change**

## 목적 ^purpose

좌표계, 링크 구조, validator/traversal semantics 변경 시 L1-L4 cascade를 점검해 validator-green/UX-broken 회귀를 막는다.

## 사용 맥락 ^context

aspect/scope/tier/link 방향, domain root 파생, 대량 frontmatter migration을 바꿀 때 사용한다.

## 피드백 규칙 ^feedback

- `def validate`가 통과해도 `workflow-smoke`, `def doctor`, 핵심 topdown 탐색을 같이 확인한다.
- silent empty 탐색 결과가 나오면 단일 edge 의존을 의심하고 union traversal을 검토한다.

## 관련 소스

- `skills/semantic-change/SKILL.md`

