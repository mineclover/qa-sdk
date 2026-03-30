---
def:
  id: skill-cli-coord-commands
  address: def_document:v2:68790
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [generated]
  links:
    - target: cli-command-group
      type: refines
    - target: skill-cli-dkg-commands
      type: depends_on
---


## 탐색 ^navigation

skill-catalog-system > cli-command-group > **skill-cli-coord-commands**

형제: `skill-cli-def-commands` · `skill-cli-dkg-commands` · `skill-cli-flow-commands`

## 목적 ^purpose

좌표계의 핵심 연산을 CLI에서 바로 확인하게 해, axis/prefix 변경 전후의 인코딩·디코딩·해석 결과를 빠르게 검증하는 명령군이다.

## 사용 맥락 ^context

prefix를 새로 만들었거나 축 capacity를 바꾼 뒤 주소가 어떻게 해석되는지 확인할 때 사용한다.
문서 설명보다 실제 좌표값을 먼저 보고 싶을 때도 유용하다.

## 설계 의도 ^intent

좌표계 설명을 추상 이론이 아니라 구체적인 encode/decode 결과로 확인하게 만들어,
DKG 변경이 실제 주소 체계에 미치는 영향을 짧은 피드백 루프로 점검하게 한다.

## 피드백 규칙 ^feedback

- 같은 prefix에 대해 resolve와 impact가 반복되면 관련 DSL/axis 문서를 바로 여는 진입 링크를 보강한다.
- decode 결과가 자주 헷갈리는 prefix는 examples 섹션이나 CLI help 예시를 더 추가한다.

## 주의사항 ^caveat

CLI 출력은 현재 등록된 catalog 기준이다.
구버전 주소의 의미나 마이그레이션 가능성까지 단정하려면 DKG impact와 version history를 함께 봐야 한다.

## 관련 소스

- `packages/cli/src/commands/dx.ts`
