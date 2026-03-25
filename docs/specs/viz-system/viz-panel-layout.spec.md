---
def:
  id: viz-panel-layout
  scope: ui
  aspect: layout
  depth: specification
  lifecycle: approved
  tags: [tier-frontend]
  links:
    - target: viz-panels-spec
      type: refines
---

# Viz 패널 레이아웃

## 목적 ^purpose

viz-web의 scenario selector, event log, verdict panel을 하나의 보조 패널 시스템으로 배치하는 레이아웃 규칙을 정리한다.

## 패널 구성

- scenario selector는 현재 trace/session 문맥을 바꾸는 상단 제어 지점이다.
- event log는 시간 순서 이벤트를 탐색하는 세로 중심 패널이다.
- verdict panel은 시나리오 판정과 실패 원인을 요약하는 우측 보조 패널이다.

## 통합 제약

- 세 패널은 main 레이아웃과 독립 스크롤 경계를 가져야 한다.
- 패널 간 정보 전달은 공용 상태를 통해 이뤄지고, 직접 DOM 결합은 피한다.
