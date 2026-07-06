---
def:
  tier: component
  id: skill-def-link
  address: def_document:v2:68797
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [generated]
  links:
    - target: claude-skill-group
      type: refines
    - target: skill-def-audit
      type: traces_to
    - target: skill-def-new
      type: depends_on
sources:
  - skills/def-link/SKILL.md
---


## 탐색 ^navigation

skill-catalog-system > claude-skill-group > **skill-def-link**

형제: `skill-def-topdown` · `skill-def-bottomup` · `skill-def-context` · `skill-def-audit` · `skill-def-explore` · `skill-def-knowledge` · `skill-def-level` · `skill-def-new` · `skill-def-split` · `skill-def-state`

## 목적 ^purpose

고아 문서나 links가 빈약한 리프 문서에 적절한 authored link를 추가해, 문서 그래프의 의미 연결을 복구하는 스킬이다.

## 사용 맥락 ^context

audit에서 links 없는 문서가 잡히거나, 새 문서를 만들었는데 어떤 관계로 연결해야 할지 애매할 때 사용한다.

## 설계 의도 ^intent

synthetic 관계가 아니라 authored link를 중심으로 문서 의미를 연결하게 만드는 것이 목적이다.
`contains`, `depends_on`, `refines`, `constrains`의 읽는 법을 분리해 링크 의미가 섞이지 않도록 한다.

## 피드백 규칙 ^feedback

- 같은 link type 혼동이 반복되면 선택 규칙과 예시를 더 앞단으로 끌어올린다.
- orphan가 특정 영역에 몰리면 해당 그룹 overview의 contains 구조를 재검토한다.

## 주의사항 ^caveat

“사용한다”와 “소속된다”를 혼동해 `depends_on`과 `contains`를 바꿔 쓰면 문서 구조가 왜곡된다.

## 관련 소스

- `skills/def-link/SKILL.md`
