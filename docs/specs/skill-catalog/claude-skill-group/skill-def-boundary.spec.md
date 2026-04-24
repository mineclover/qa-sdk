---
def:
  tier: component
  id: skill-def-boundary
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [generated]
  links:
    - target: claude-skill-group
      type: refines
    - target: skill-cli-def-commands
      type: depends_on
    - target: skill-def-context
      type: depends_on
    - target: skill-def-link
      type: depends_on
    - target: skill-def-state
      type: depends_on
---

## 탐색 ^navigation

skill-catalog-system > claude-skill-group > **skill-def-boundary**

형제: `skill-def-topdown` · `skill-def-bottomup` · `skill-def-context` · `skill-def-audit` · `skill-def-explore` · `skill-def-knowledge` · `skill-def-level` · `skill-def-new` · `skill-def-link` · `skill-def-split` · `skill-def-state`

## 목적 ^purpose

문서와 컨텍스트를 boundary 단위로 읽고, direct 구조와 transitive 영향 범위를 분리해서 다루게 만드는 스킬이다.

## 사용 맥락 ^context

provider 선언 순서가 로직상 중요하거나, 문서 시스템에서 바운더리와 결합 표현을 안정화해야 할 때 사용한다.
새 boundary를 정의할 때도 쓰지만, 이미 있는 문서 그래프를 "이게 하나의 경계인가" 관점으로 재구성할 때 특히 유용하다.

## 설계 의도 ^intent

문서 구조를 파일 위치나 구현 언어가 아니라 경계와 결합으로 읽게 만드는 것이 목적이다.
`boundary`는 구조 조회, `boundaryContext`는 작업 컨텍스트와 영향 범위 조회로 역할을 나눠 direct/transitive 판단을 섞지 않게 한다.

## 피드백 규칙 ^feedback

- boundary 조회 뒤 자주 `def-link`, `def-state`로 이어지면 skill 본문에 보완 순서를 더 강하게 적는다.
- transitive 조회에서 반복적으로 같은 외부 시스템이 inherited concern으로 보이면 boundary 문서의 purpose/overview와 coupling 링크를 재검토한다.

## 주의사항 ^caveat

boundary는 구조 단위이지 구현 파일 트리의 별칭이 아니다.
overview 문서에 business logic를 넣으면 state/interaction/validation 문서와 역할이 겹쳐 조회 품질이 나빠진다.

## 관련 진입점

- `qa-sdk def boundary <문서ID>`
- `qa-sdk def boundary-context <문서ID> --mode direct|transitive`
- `docs/specs/skill-catalog/cli-command-group/skill-cli-def-commands.spec.md`

`skills/def-boundary/SKILL.md`는 구현 SSOT이지만, 조회 진입점은 위 command 표면을 따른다.
