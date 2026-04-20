---
def:
  tier: component
  id: skill-ralph-tui-prd
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [planning]
  links:
    - target: ralph-tui-skill-group
      type: refines
    - target: skill-ralph-tui-create-json
      type: traces_to
    - target: skill-ralph-tui-create-beads
      type: traces_to
---


## 탐색 ^navigation

skill-catalog-system > ralph-tui-skill-group > **skill-ralph-tui-prd**

형제: `skill-ralph-tui-create-json` · `skill-ralph-tui-create-beads` · `skill-ralph-tui-create-beads-rust`

## 목적 ^purpose

기능 아이디어를 ralph-tui가 실행 가능한 PRD 형식으로 구조화해, 요구사항 수집과 품질 게이트 정의를 같은 문서 안에서 완료한다.

## 사용 맥락 ^context

새 기능을 바로 구현하지 말고 먼저 요구사항을 정제해야 할 때,
특히 후속 단계에서 beads나 `prd.json`으로 변환할 계획이 있을 때 사용한다.

## 설계 의도 ^intent

질문을 한 번에 몰아붙이지 않고 적응형으로 나눠서 물어,
PRD가 실제 구현 가능한 범위와 품질 게이트를 포함하도록 유도한다.

## 피드백 규칙 ^feedback

- 품질 게이트가 비어 있는 PRD가 자주 나오면 질문 템플릿을 더 강하게 만든다.
- 후속 변환 단계에서 누락이 반복되면 PRD 섹션 구조를 보강한다.

## 주의사항 ^caveat

이 스킬은 PRD 생성이 목적이며 구현 시작 신호가 아니다.
질문 라운드를 생략하면 후속 tracker 변환 품질이 크게 떨어진다.

## 관련 소스

- `skills/ralph-tui-prd/SKILL.md`
