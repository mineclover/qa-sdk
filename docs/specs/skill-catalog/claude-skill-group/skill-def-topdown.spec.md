---
def:
  tier: component
  id: skill-def-topdown
  address: def_document:v2:68800
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
    - target: skill-def-bottomup
      type: traces_to
  sources:
    - skills/def-topdown/SKILL.md

---


## 탐색 ^navigation

skill-catalog-system > claude-skill-group > **skill-def-topdown**

형제: `skill-def-bottomup` · `skill-def-context` · `skill-def-audit` · `skill-def-explore` · `skill-def-knowledge` · `skill-def-level` · `skill-def-new` · `skill-def-link` · `skill-def-split` · `skill-def-state`

## 목적 ^purpose

시스템이나 그룹 문서에서 시작해 하위 멤버의 purpose/overview를 조립함으로써, 문서 집합을 상위 개념에서 하위 개념 순으로 이해하게 하는 스킬이다.

## 사용 맥락 ^context

특정 그룹의 전체 구조를 빠르게 설명해야 하거나,
문서 ID는 알지만 하위 멤버의 의미와 읽기 순서를 아직 모를 때 사용한다.

## 설계 의도 ^intent

contains 관계를 따라 조립하되 scope 순서로 정렬해, 같은 그룹 안에서도 제약→데이터→기능 같은 읽기 흐름이 드러나게 한다.
개별 문서를 무작위로 읽는 방식보다 시스템 설명 품질이 안정적이다.

## 피드백 규칙 ^feedback

- 같은 그룹을 반복해서 조립하면 overview 문서의 구성 설명이 부족하다는 신호로 본다.
- topdown 후 context나 bottomup으로 자주 이어지면 그룹 문서에 더 강한 진입 링크를 추가한다.

## 주의사항 ^caveat

topdown은 시스템 설명용이다. 실제 수정 전 세부 영향 확인은 context나 bottomup으로 내려가야 한다.

## 관련 소스

- `skills/def-topdown/SKILL.md`
