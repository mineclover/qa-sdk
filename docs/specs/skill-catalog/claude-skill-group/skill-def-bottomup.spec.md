---
def:
  id: skill-def-bottomup
  address: def_document:v2:68795
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [generated]
  links:
    - target: claude-skill-group
      type: refines
    - target: skill-def-topdown
      type: traces_to
    - target: skill-def-context
      type: depends_on
---


## 탐색 ^navigation

skill-catalog-system > claude-skill-group > **skill-def-bottomup**

형제: `skill-def-topdown` · `skill-def-context` · `skill-def-audit` · `skill-def-explore` · `skill-def-knowledge` · `skill-def-level` · `skill-def-new` · `skill-def-link` · `skill-def-split` · `skill-def-state`

## 목적 ^purpose

특정 문서 변경이 상위 overview와 주변 authored link에 어떤 영향을 미치는지 역추적해, 수정 전 blast radius를 파악하게 하는 스킬이다.

## 사용 맥락 ^context

리프 문서나 계약 문서를 수정하기 전에 어떤 문서가 같이 읽혀야 하는지 확인할 때 사용한다.

## 설계 의도 ^intent

파일 경로나 추측이 아니라 authored link와 contains 구조를 기준으로 영향 범위를 읽게 한다.
변경 전 역추적을 먼저 하면 수정 후 깨진 설명을 뒤늦게 보수하는 비용을 줄일 수 있다.

## 피드백 규칙 ^feedback

- 영향 범위가 지나치게 넓게 나오면 그룹 분할이나 authored link 재정비 후보로 기록한다.
- 자주 조회되는 문서는 topdown/context 진입점으로 승격하는 신호로 본다.

## 주의사항 ^caveat

author link가 빈약하면 blast radius도 과소평가될 수 있다.
역추적 결과는 런타임 호출 그래프가 아니라 문서 그래프상의 영향 범위를 뜻한다.

## 관련 소스

- `skills/def-bottomup/SKILL.md`
