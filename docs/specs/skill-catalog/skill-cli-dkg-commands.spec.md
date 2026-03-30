---
def:
  id: skill-cli-dkg-commands
  address: def_document:v2:68792
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [generated]
  links:
    - target: cli-command-group
      type: refines
    - target: dkg-skill-group
      type: depends_on
---


## 탐색 ^navigation

skill-catalog-system > cli-command-group > **skill-cli-dkg-commands**

형제: `skill-cli-def-commands` · `skill-cli-flow-commands` · `skill-cli-coord-commands`

## 목적 ^purpose

DKG 그래프를 조회하고, 변경을 관찰하고, 의사결정을 기록하는 명령군이다.
좌표계 설계를 감으로 바꾸지 않고 evidence와 graph 상태를 남기게 하는 운영 표면이다.

## 사용 맥락 ^context

축, prefix, domain, skill, service 구조를 바꾸기 전후에 구조 상태와 영향 범위를 확인할 때 사용한다.
`dkg decide`, `observe`, `claims`, `converge`, `overview` 같은 루프를 통해 설계 변경을 추적할 때도 유용하다.

## 설계 의도 ^intent

좌표계 변경을 코드 수정으로 바로 밀어 넣지 않고, graph에 기록된 변경 이유와 영향 분석을 먼저 보게 한다.
그래야 headroom, overlap, migration, ownership 같은 구조 제약이 빠지지 않는다.

## 피드백 규칙 ^feedback

- 같은 노드에 claim/observe/decide가 반복되면 해당 영역의 진입 문서와 명령 예시를 더 보강한다.
- converge 경고가 누적되는 영역은 DKG skill이나 guide 문서로 승격할 후보로 본다.

## 주의사항 ^caveat

DKG CLI는 구조 분석 도구이지 런타임 동작을 직접 수정하는 도구가 아니다.
graph 상태만 보고 실제 구현이 이미 따라갔다고 가정하면 안 된다.

## 관련 소스

- `packages/cli/src/commands/dkg.ts`
