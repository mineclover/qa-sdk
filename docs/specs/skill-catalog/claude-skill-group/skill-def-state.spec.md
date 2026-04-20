---
def:
  tier: component
  id: skill-def-state
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [entry-point, cross-scope, structural]
  links:
    - target: claude-skill-group
      type: refines
    - target: definition-state-model
      type: depends_on
    - target: definition-harness
      type: depends_on
---
# /def-state — 유한 상태 관리


## 탐색 ^navigation

skill-catalog-system > claude-skill-group > **skill-def-state**

형제: `skill-def-topdown` · `skill-def-bottomup` · `skill-def-context` · `skill-def-audit` · `skill-def-explore` · `skill-def-knowledge` · `skill-def-level` · `skill-def-new` · `skill-def-link` · `skill-def-split`

## 목적 ^purpose

11개 상태 머신의 분포를 조회하고, 상태를 자동 파생하며, 머신 간 의존 관계를 시각화한다.

## 정의 ^defines

- `qa-sdk def state` CLI 워크플로우
- 문서 계층 4개 머신 로컬 파생
- 시스템 계층 7개 머신 외부 연결

## 소비 ^consumes

- definition-state-model (11개 머신 정의)
- definition-harness (의존/프로세스)
- harness-derive (파생 규칙)
- harness-cli (CLI 표면)

## 관련 소스

- `skills/def-state/SKILL.md` — skill 구현
- `cli/src/commands/def.ts:cmdState` — CLI 구현
