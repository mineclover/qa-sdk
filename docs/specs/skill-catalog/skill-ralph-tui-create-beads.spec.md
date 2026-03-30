---
def:
  id: skill-ralph-tui-create-beads
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
    - target: skill-ralph-tui-create-json
      type: refines
---


## 탐색 ^navigation

skill-catalog-system > ralph-tui-skill-group > **skill-ralph-tui-create-beads**

형제: `skill-ralph-tui-prd` · `skill-ralph-tui-create-json` · `skill-ralph-tui-create-beads-rust`

## 목적 ^purpose

PRD를 beads epic과 child task 세트로 변환해, ralph-tui가 tracker 기반으로 작업을 순차 실행할 수 있게 한다.

## 사용 맥락 ^context

beads(`bd`)를 tracker로 사용하는 환경에서 PRD를 작업 단위로 쪼개고 의존 관계까지 설정해야 할 때 사용한다.

## 설계 의도 ^intent

HEREDOC 기반 CLI를 기본 경로로 삼아 설명 본문에 백틱이나 셸 특수문자가 있어도 안전하게 task를 생성한다.
story 크기를 한 iteration 안에 끝낼 수 있도록 강제해 에이전트 컨텍스트 초과를 막는다.

## 피드백 규칙 ^feedback

- 스토리가 반복적으로 너무 커서 후속 수정이 필요하면 story sizing 규칙을 더 보수적으로 만든다.
- dependency 누락이 잦으면 schema → backend → UI 기본 순서를 더 강하게 권장한다.

## 주의사항 ^caveat

single-quoted HEREDOC를 지키지 않으면 description 본문이 셸에서 깨질 수 있다.

## 관련 소스

- `skills/ralph-tui-create-beads/SKILL.md`
