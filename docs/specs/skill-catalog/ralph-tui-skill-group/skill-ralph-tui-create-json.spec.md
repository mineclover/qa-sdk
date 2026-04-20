---
def:
  tier: component
  id: skill-ralph-tui-create-json
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
---


## 탐색 ^navigation

skill-catalog-system > ralph-tui-skill-group > **skill-ralph-tui-create-json**

형제: `skill-ralph-tui-prd` · `skill-ralph-tui-create-beads` · `skill-ralph-tui-create-beads-rust`

## 목적 ^purpose

PRD를 `ralph-tui run --prd`가 바로 실행할 수 있는 평면 `prd.json` 구조로 변환해, 요구사항 문서와 실행 입력 사이의 변환 비용을 없앤다.

## 사용 맥락 ^context

PRD는 이미 있고 tracker 없이 JSON 입력으로 ralph-tui를 돌리고 싶을 때 사용한다.

## 설계 의도 ^intent

root-level flat JSON 형식을 강제해 downstream 파서가 복잡한 래핑 구조를 해석하지 않도록 한다.
품질 게이트를 각 story acceptance criteria에 주입해 실행 기준이 story마다 분산되지 않게 한다.

## 피드백 규칙 ^feedback

- story dependency 누락이 반복되면 변환 규칙에 선행/후행 감지 예시를 추가한다.
- 잘못된 JSON shape가 자주 나오면 anti-pattern 섹션을 더 앞단으로 끌어올린다.

## 주의사항 ^caveat

`prd` 래퍼나 `tasks` 배열 같은 비표준 구조를 만들면 ralph-tui 입력 계약이 깨진다.

## 관련 소스

- `skills/ralph-tui-create-json/SKILL.md`
