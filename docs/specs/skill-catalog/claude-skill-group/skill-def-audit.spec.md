---
def:
  tier: component
  id: skill-def-audit
  address: def_document:v2:68794
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [generated]
  links:
    - target: claude-skill-group
      type: refines
    - target: skill-def-link
      type: traces_to
    - target: skill-def-split
      type: depends_on
sources:
  - skills/def-audit/SKILL.md
---


## 탐색 ^navigation

skill-catalog-system > claude-skill-group > **skill-def-audit**

형제: `skill-def-topdown` · `skill-def-bottomup` · `skill-def-context` · `skill-def-explore` · `skill-def-knowledge` · `skill-def-level` · `skill-def-new` · `skill-def-link` · `skill-def-split` · `skill-def-state`

## 목적 ^purpose

definition-catalog 문서 집합의 품질 문제를 한 번에 드러내고, purpose·links·tags·level·contains 구조를 규칙 기반으로 점검하게 하는 감사 스킬이다.

## 사용 맥락 ^context

대규모 문서 수정 뒤 품질 회귀가 없는지 확인할 때,
혹은 링크 누락, multi-parent, level 불일치 같은 구조 문제를 정리할 때 사용한다.

## 설계 의도 ^intent

문서 품질을 취향이 아니라 규칙으로 관리하게 만드는 것이 목적이다.
개별 파일 감으로 고치는 대신 audit/validate/stats를 함께 보게 해 구조적 문제를 먼저 발견하게 한다.

## 피드백 규칙 ^feedback

- 같은 종류의 경고가 반복되면 skill 본문에 수정 패턴과 예시를 추가한다.
- leaf-too-long이나 multi-parent 경고가 누적되면 `def-split`, `def-link` 연계 순서를 더 강하게 권장한다.

## 주의사항 ^caveat

synthetic feedback 관계는 authored link를 대체하지 않는다.
감사 결과는 수정 후보 목록이지 자동 수정이 아니므로 cross-scope 같은 의도적 공유는 사람이 판별해야 한다.

## 관련 소스

- `skills/def-audit/SKILL.md`
