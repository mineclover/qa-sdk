---
def:
  id: df-dev-decisions
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [decision]
  links:
    - target: df-vector-analysis
      type: depends_on
    - target: df-system
      type: implements
---
# 일상 개발 의사결정 플로우

## 목적 ^purpose

개발자가 매일 마주치는 작업 수준 의사결정을 구조화한 5개 FlowSchema + 6개 자동 정책. 라우터가 결정 유형을 분류하고 적절한 하위 플로우로 자동 연결한다.

## 구성 ^overview

- **DECISION_ROUTER**: 8유형 분류 (test/scope/stabilization/architecture/feature-lookup/sprint/coordinate/custom) → urgency → reversibility → 하위 플로우 자동 시작
- **TEST_NEEDED_FLOW**: 변경성격 → 영향범위 → 커버리지 → 판정. 자동: docs→불필요, 리팩터+국소+충분→불필요, 신규+시스템→E2E
- **SCOPE_EXPANSION_FLOW**: 완성도 → 피드백 → 부채 → 판정. 자동: 미완성+수요없음→보류
- **STABILIZATION_FLOW**: 버그빈도 → 성능 → 코드품질 → 판정. 자동: 버그높음→개선필요
- **ARCHITECTURE_DECISION_FLOW**: 대안목록 → 트레이드오프 → 전환비용 → 최종선택
- **DEV_DECISION_UNITS**: 각 플로우별 주제/목적/성공기준/fallback 정의
