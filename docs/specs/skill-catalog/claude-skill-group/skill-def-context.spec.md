---
def:
  tier: component
  id: skill-def-context
  address: def_document:v2:68796
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [generated]
  links:
    - target: claude-skill-group
      type: refines
    - target: skill-def-bottomup
      type: traces_to
    - target: skill-def-topdown
      type: traces_to
---


## 탐색 ^navigation

skill-catalog-system > claude-skill-group > **skill-def-context**

형제: `skill-def-topdown` · `skill-def-bottomup` · `skill-def-audit` · `skill-def-explore` · `skill-def-knowledge` · `skill-def-level` · `skill-def-new` · `skill-def-link` · `skill-def-split` · `skill-def-state`

## 목적 ^purpose

문서 하나를 고치기 전에 상위/하위/제약/의존 정보를 모아, 수정 전 읽어야 할 맥락을 표준화하는 스킬이다.

## 사용 맥락 ^context

처음 보는 문서를 수정하거나, 최근 갱신된 문서를 이어서 작업할 때 사용한다.
`qa-sdk def sync` 후 context를 읽는 흐름을 기본으로 삼아 stale datasource 문제도 줄인다.

## 설계 의도 ^intent

문서 작업의 시작을 곧바로 편집이 아니라 맥락 수집으로 만들기 위한 스킬이다.
상하위 문서와 횡방향 링크를 함께 묶어 보여줘 문서 이해의 편향을 줄인다.

## 피드백 규칙 ^feedback

- context 조회 후 bottomup이나 audit로 자주 이어지면 권장 순서를 문서에 더 분명히 적는다.
- 반복 조회되는 문서는 상단 overview나 그룹 진입 링크를 보강할 후보로 본다.

## 주의사항 ^caveat

context는 읽기 순서를 돕는 것이지 설계 결정을 대신하지 않는다.
관계가 누락된 문서는 context 품질도 낮아질 수 있으므로 authored link 정비가 선행돼야 한다.

## 관련 소스

- `skills/def-context/SKILL.md`
