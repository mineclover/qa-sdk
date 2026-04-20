---
def:
  tier: component
  id: skill-def-split
  address: def_document:v2:68799
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [generated]
  links:
    - target: claude-skill-group
      type: refines
    - target: skill-def-level
      type: depends_on
    - target: skill-def-link
      type: depends_on
---


## 탐색 ^navigation

skill-catalog-system > claude-skill-group > **skill-def-split**

형제: `skill-def-topdown` · `skill-def-bottomup` · `skill-def-context` · `skill-def-audit` · `skill-def-explore` · `skill-def-knowledge` · `skill-def-level` · `skill-def-new` · `skill-def-link` · `skill-def-state`

## 목적 ^purpose

비대한 leaf 문서를 module + leaf 구조로 재편해, 문서가 다시 탐색 가능한 크기와 의미 단위를 갖도록 만드는 분할 스킬이다.

## 사용 맥락 ^context

audit에서 leaf-too-long 경고가 나오거나 한 문서 안에 여러 하위 개념이 섞여 읽기 순서가 무너졌을 때 사용한다.

## 설계 의도 ^intent

원본 leaf를 같은 docId의 module overview로 바꾸고 하위 leaf를 만드는 패턴을 고정해,
링크 안정성을 유지하면서도 구조만 개선하게 한다.

## 피드백 규칙 ^feedback

- 분할 후 다시 비대해지는 문서가 반복되면 분할 기준 예시를 더 구체화한다.
- 분할 직후 links 보강이 자주 필요하면 def-link 연계 순서를 더 강하게 권장한다.

## 주의사항 ^caveat

분할은 단순 파일 쪼개기가 아니라 개념 구조 재정의다.
하위 문서 경계를 잘못 잡으면 module만 늘고 이해도는 더 낮아질 수 있다.

## 관련 소스

- `skills/def-split/SKILL.md`
