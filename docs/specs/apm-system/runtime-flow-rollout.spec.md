---
def:
  id: runtime-flow-rollout
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  tags: [tier-system]
  links:
    - target: runtime-flows-spec
      type: refines
---

# 런타임 흐름 도입 규칙

## 목적 ^purpose

운영 흐름 문서에서 빠른 참조가 필요한 심볼 요약, 구현 현황, 단계별 도입 순서를 분리해 런타임 변경 관리 규칙을 정리한다.

## 운영 참조

- 심볼 요약은 동기/비동기/디버깅 경로를 구분하는 운영자용 축약 표다.
- 구현 현황은 경로별 완료/보류 범위를 기록해 도입 순서를 결정하는 기준이 된다.
- 신규 기능은 가장 좁은 경로부터 붙이고, 공통 모듈화는 경로 안정화 이후에 한다.

## 도입 순서

- 저장과 검증이 닫힌 뒤 집계, 디버깅, 최적화 순으로 범위를 넓혀야 관측 공백을 줄일 수 있다.
- 경로를 늘릴 때는 런타임 비용보다 장애 시 되돌리기 쉬운지 먼저 본다.
