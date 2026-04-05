---
def:
  id: cli-command-group
  level: module
  address: def_document:v2:68615
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: experience
  tags: [structural, entry-point, generated]
  links:
    - target: skill-cli-def-commands
      type: contains
    - target: skill-cli-dkg-commands
      type: contains
    - target: skill-cli-flow-commands
      type: contains
    - target: skill-cli-coord-commands
      type: contains
    - target: cli-command-registry-plan
      type: traces_to
---


## 탐색 ^navigation

skill-catalog-system > **cli-command-group**

형제: `claude-skill-group` · `automation-skill-group` · `ralph-tui-skill-group` · `dkg-skill-group`

## 목적 ^purpose

qa-sdk의 핵심 CLI 명령군(def, dkg, flow, coord) 4개를 묶어 어떤 작업 표면이 어떤 책임을 가지는지 빠르게 찾게 하는 카탈로그 진입점.

## 구성 ^overview

- `cli-def-commands`
  - definition-catalog 조회/검증/주소 기반 탐색
- `cli-dkg-commands`
  - DKG graph 조회, lifecycle audit, local/central audit forwarding
- `cli-flow-commands`
- `cli-coord-commands`

## 경계 ^boundary

이 문서는 CLI 명령군의 카탈로그 문서다.
- 실제 실행 표면은 `packages/cli/src/commands/*`
- skill 계열 정의는 `skills/`에 있고
- 운영 플레이북은 `docs/skills/`에 있다

최근 추가된 address-first definition 조회와 DKG audit trail 표면도 이 그룹에서 함께 찾을 수 있어야 한다.

즉 CLI command group은 skill 파일과 별도 층이며, 사용자 상호작용 표면을 메타 수준에서 정리한다.
