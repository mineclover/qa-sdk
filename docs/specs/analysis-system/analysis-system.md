---
def:
  id: analysis-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [observability, entry-point]
  links:
    - target: analysis-prefix
      type: contains
    - target: analysis-self-check
      type: contains
    - target: analysis-convergence
      type: contains
    - target: analysis-intent-link
      type: contains
    - target: analysis-cooccurrence
      type: contains
    - target: analysis-transition
      type: contains
---
# 분석 시스템

## 목적 ^purpose

수집된 이벤트 데이터를 기반으로 시스템 건강 상태, 좌표 수렴, prefix 공출현 패턴, 상태 전이를 분석하는 관측 레이어.

## 구성 ^overview

6개 정의: Prefix(의미 재사용 단위), Self-Check(건강 상태), Convergence(수렴/낭비 감지), IntentLink(공출현 조건), Co-occurrence(세션 패턴), TransitionSpec(상태 전이).
