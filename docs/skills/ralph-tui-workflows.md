---
name: ralph-tui-workflows
description: "ralph-tui skill 묶음 운영 가이드. PRD 생성부터 tracker별 작업 생성까지 어떤 skill을 어떤 순서로 쓰는지 정리한다."
---

# Ralph TUI Workflows

ralph-tui 계열 skill은 요구사항을 먼저 구조화하고, 그 결과를 tracker별 입력 형식으로 변환하는 두 단계로 나뉜다.

## 전체 흐름

1. `ralph-tui-prd`
   기능 설명을 PRD로 정리하고 quality gates를 포함한다.
2. 실행 표면 선택
   tracker가 무엇인지에 따라 아래 중 하나를 고른다.
   `ralph-tui-create-json`
   `ralph-tui-create-beads`
   `ralph-tui-create-beads-rust`

## 어떤 변환 skill을 쓸까

| 상황 | skill | 출력 |
|------|-------|------|
| tracker 없이 JSON 입력으로 바로 실행 | `ralph-tui-create-json` | `prd.json` |
| beads CLI (`bd`) 사용 | `ralph-tui-create-beads` | beads epic + child tasks |
| beads-rust (`br`) 사용 | `ralph-tui-create-beads-rust` | beads-rust epic + child tasks |

## 운영 원칙

- PRD 단계에서 quality gates를 반드시 묻는다.
- story는 한 iteration 안에 끝낼 수 있을 만큼 작아야 한다.
- tracker 선택은 PRD 작성 후가 아니라 변환 직전에 확정한다.

## 빠른 링크

- skill 파일
  `skills/ralph-tui-prd/SKILL.md`
  `skills/ralph-tui-create-json/SKILL.md`
  `skills/ralph-tui-create-beads/SKILL.md`
  `skills/ralph-tui-create-beads-rust/SKILL.md`
- catalog 문서
  `docs/specs/skill-catalog/ralph-tui-skill-group.md`
  `docs/specs/skill-catalog/skill-ralph-tui-prd.spec.md`
  `docs/specs/skill-catalog/skill-ralph-tui-create-json.spec.md`
  `docs/specs/skill-catalog/skill-ralph-tui-create-beads.spec.md`
  `docs/specs/skill-catalog/skill-ralph-tui-create-beads-rust.spec.md`
