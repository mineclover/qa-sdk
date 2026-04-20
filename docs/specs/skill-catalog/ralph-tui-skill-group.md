---
def:
  id: ralph-tui-skill-group
  tier: system
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: experience
  tags: [entry-point]
  links:
    - target: skill-ralph-tui-prd
      type: contains
    - target: skill-ralph-tui-create-json
      type: contains
    - target: skill-ralph-tui-create-beads
      type: contains
    - target: skill-ralph-tui-create-beads-rust
      type: contains
---


## 탐색 ^navigation

skill-catalog-system > **ralph-tui-skill-group**

형제: `claude-skill-group` · `automation-skill-group` · `dkg-skill-group` · `cli-command-group`

## 목적 ^purpose

ralph-tui 실행 전 단계의 PRD 작성과 작업 분해를 표준화하는 스킬 묶음이다.
요구사항 수집부터 tracker별 작업 생성까지 한 흐름으로 연결한다.

## 구성 ^overview

- `ralph-tui-prd` — 기능 설명을 PRD로 구조화
- `ralph-tui-create-json` — PRD를 `prd.json`으로 변환
- `ralph-tui-create-beads` — PRD를 beads 작업 세트로 변환
- `ralph-tui-create-beads-rust` — PRD를 beads-rust 작업 세트로 변환

## 선택 기준

tracker가 JSON 기반이면 `ralph-tui-create-json`,
기존 beads CLI면 `ralph-tui-create-beads`,
`br` 기반 beads-rust면 `ralph-tui-create-beads-rust`를 사용한다.

## 경계 ^boundary

이 문서는 ralph-tui 계열 skill의 메타 스펙이다.
- 실제 실행 지침은 `skills/ralph-tui-*/SKILL.md`
- 운영 순서는 `docs/skills/ralph-tui-workflows.md`

즉 PRD를 어떻게 만들고 어떤 tracker를 고를지의 이유를 문서화하는 계층이지,
tracker 생성 명령 자체를 담는 문서는 아니다.
