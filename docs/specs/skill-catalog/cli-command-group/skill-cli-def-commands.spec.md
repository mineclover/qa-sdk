---
def:
  tier: component
  id: skill-cli-def-commands
  address: def_document:v2:68791
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [generated]
  links:
    - target: cli-command-group
      type: refines
    - target: claude-skill-group
      type: depends_on
sources:
  - packages/cli/src/commands/def.ts
  - packages/cli/src/index.ts
  - packages/definition-data-source/src/local-data-source.ts
  - packages/definition-service/src/modules/docs/docs.controller.ts
  - packages/definition-service/src/modules/graph/graph.controller.ts
  - packages/definition-data-source/src/server-data-source.ts
---


## 탐색 ^navigation

skill-catalog-system > cli-command-group > **skill-cli-def-commands**

형제: `skill-cli-dkg-commands` · `skill-cli-flow-commands` · `skill-cli-coord-commands`

## 목적 ^purpose

definition-catalog 문서를 스캔하고, 읽고, 검증하고, 구조를 추적하는 명령군이다.
문서 작업을 편집 중심이 아니라 scan/context/boundary/audit 기반의 구조 작업으로 만들기 위한 표면이다.

## 사용 맥락 ^context

문서 작업 전후에 전체 구조를 점검하거나, 특정 문서의 맥락과 영향 범위를 확인할 때 사용한다.
`def-*` 스킬들이 내부적으로 기대하는 CLI 표면이기도 하다.
최근에는 `def get --address`, `def incoming|outgoing --address`, `def impact --address` 같은 address-first 조회도 포함한다.

## 설계 의도 ^intent

문서 그래프를 파일 브라우징이 아니라 authored link와 taxonomy 기준으로 읽게 만드는 것이 목적이다.
scan, context, boundary, audit, validate를 조합하게 해 사람이 임의로 파일 몇 개만 읽고 판단하는 편향을 줄인다.
`def.id`는 사람이 읽는 라벨로 유지하되, canonical address를 병행 노출해 시스템 키와 authoring label을 구분해서 보게 한다.

## 피드백 규칙 ^feedback

- 특정 문서에서 context/bottomup/audit가 반복되면 상위 overview와 authored link 구조를 재정비한다.
- validate 오류가 자주 같은 패턴으로 나오면 link-rules와 skill 문서를 함께 강화한다.
- 같은 명령을 `id`와 `address` 두 방식으로 반복 조회하게 되면 address-first surface나 reverse lookup을 더 보강할 후보로 본다.

## 주의사항 ^caveat

CLI 결과는 문서 그래프의 현재 상태를 읽는 것이지 설계 의사결정을 자동으로 대신하지 않는다.
scan이나 sync 없이 오래된 local datasource로 읽으면 최근 문서 변경이 반영되지 않을 수 있다.

## 관련 소스

- `packages/cli/src/commands/def.ts`
- `packages/cli/src/index.ts`
- `packages/definition-data-source/src/local-data-source.ts`
- `packages/definition-data-source/src/server-data-source.ts`
- `packages/definition-service/src/modules/docs/docs.controller.ts`
- `packages/definition-service/src/modules/graph/graph.controller.ts`
