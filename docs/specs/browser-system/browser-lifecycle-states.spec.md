---
def:
  id: browser-lifecycle-states
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  tags: [tier-frontend]
  links:
    - target: browser-lifecycle-spec
      type: refines
---

# 브라우저 생명주기 상태

## 목적 ^purpose

QaMonitor의 상태 다이어그램과 단계별 계약을 분리해 브라우저 SDK가 언제 어떤 동작을 해도 되는지 명확히 한다.

## 상태 전이

- monitor는 생성, 초기화, 활성, 종료 같은 큰 상태를 분명히 가져야 한다.
- 단계별 계약은 transport 연결, trace/session 준비, 자동 수집 시작 순서를 보장해야 한다.
- 상태를 건너뛰는 초기화는 허용하지 않고, 잘못된 순서는 경고와 함께 무시하는 편이 안전하다.
