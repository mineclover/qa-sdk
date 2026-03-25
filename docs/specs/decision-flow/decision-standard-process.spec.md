---
def:
  id: decision-standard-process
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  tags: [decision]
  links:
    - target: decision-standard
      type: refines
---

# Decision Standard 프로세스

## 목적 ^purpose

새 요구사항이 들어왔을 때 기존 prefix 재사용과 신규 prefix 정의 중 어떤 경로를 택할지 판단하는 표준 프로세스를 정리한다.

## 표준 프로세스

- 먼저 시스템 정체성과 현재 prefix 집합을 보고 문제가 기존 좌표계 안에서 닫히는지 확인한다.
- 상황을 기존 변경과 신규 정의로 나누고, 각 경우에 필요한 설계 산출물을 구분한다.
- 프로세스는 복잡한 설계를 늘리기보다 DSL이 제어해야 할 경우의 수를 줄이는 방향으로 진행한다.
