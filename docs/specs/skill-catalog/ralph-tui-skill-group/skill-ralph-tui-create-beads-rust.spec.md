---
def:
  tier: component
  id: skill-ralph-tui-create-beads-rust
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [planning]
  links:
    - target: ralph-tui-skill-group
      type: refines
    - target: skill-ralph-tui-prd
      type: depends_on
    - target: skill-ralph-tui-create-beads
      type: refines
---


## 탐색 ^navigation

skill-catalog-system > ralph-tui-skill-group > **skill-ralph-tui-create-beads-rust**

형제: `skill-ralph-tui-prd` · `skill-ralph-tui-create-json` · `skill-ralph-tui-create-beads`

## 목적 ^purpose

PRD를 beads-rust(`br`) tracker 입력으로 변환해, ralph-tui가 rust 기반 beads 워크플로우에서 바로 작업을 실행할 수 있게 한다.

## 사용 맥락 ^context

tracker가 beads-rust로 표준화되어 있고, `br` 명령으로 epic/child/dependency를 생성해야 할 때 사용한다.

## 설계 의도 ^intent

기존 beads(`bd`) 스킬과 역할은 같되 실행 표면만 `br`로 바꿔, tracker 차이를 skill 선택에서만 해결하도록 한다.

## 피드백 규칙 ^feedback

- `bd`와 `br` 혼동이 반복되면 tracker 선택 기준을 문서와 예시 모두에서 더 선명하게 적는다.
- rust tracker에서 생성 실패가 잦으면 CLI 예시를 최신 `br` 문법으로 바로 갱신한다.

## 주의사항 ^caveat

이 스킬은 `br` 전용이다. 기존 beads CLI 환경이면 `ralph-tui-create-beads`를 사용해야 한다.

## 관련 소스

- `skills/ralph-tui-create-beads-rust/SKILL.md`
