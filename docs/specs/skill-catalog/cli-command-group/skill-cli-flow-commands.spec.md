---
def:
  id: skill-cli-flow-commands
  address: def_document:v2:68793
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

skill-catalog-system > cli-command-group > **skill-cli-flow-commands**

형제: `skill-cli-def-commands` · `skill-cli-dkg-commands` · `skill-cli-coord-commands`

## 목적 ^purpose

의사결정 플로우를 시작하고 선택을 기록하며, 완료된 경로를 분석하게 하는 명령군이다.
반복되는 개발 판단을 개별 감이 아니라 gate/branch/evidence 구조로 남기게 만든다.

## 사용 맥락 ^context

테스트 필요 여부, 스코프 확장, 안정화, 아키텍처 결정처럼 반복적인 판단을 구조화할 때 사용한다.
이전 선택 분포나 자동 정책을 보고 싶을 때도 적합하다.

## 설계 의도 ^intent

판단 결과뿐 아니라 선택 과정 전체를 남겨, 나중에 trace와 compare로 핵심 전환점을 다시 읽게 하는 것이 목적이다.
같은 종류의 결정을 계속 텍스트 메모로 남기는 방식보다 재사용 가능한 패턴을 만들기 쉽다.

## 피드백 규칙 ^feedback

- 동일 플로우에서 자동 선택이 자주 뒤집히면 policy 학습 규칙을 재검토한다.
- trace/compare 사용이 많아지면 narrative와 core divergence 요약을 더 강화한다.

## 주의사항 ^caveat

flow CLI는 의사결정 기록과 분석을 돕는 도구다.
자동 정책이 있더라도 evidence가 빈약하면 사람 검토를 생략하면 안 된다.

## 관련 소스

- `packages/cli/src/commands/flow.ts`
