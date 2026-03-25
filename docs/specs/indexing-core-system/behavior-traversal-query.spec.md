---
def:
  id: behavior-traversal-query
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: behavior-traversal-axis
      type: depends_on
    - target: behavioral-traversal
      type: refines
---

# 행위 축 탐색 - 질의와 내부 모델

## 목적 ^purpose

행위 축 탐색의 질의 패턴, DSL, 내부 모델, 설계 포인트를 정리해 실제 탐색 API가 어떤 제약을 따라야 하는지 설명한다.

## 질의 계층

- query pattern은 관계를 읽는 관점별 탐색 템플릿이며, DSL은 이를 선언적으로 조합하는 표면이다.
- 내부 모델은 질의 DSL을 실행 계획으로 바꾸고, 단일 원천 추적과 이어지는 경로를 보존해야 한다.
- 핵심 정의는 "정의된 관계만 탐색한다"는 제약을 유지하는 데 있다.

## 설계 포인트

- 이 계층은 아직 목표 스펙 성격이 강하므로, 구현 단계와 다음 단계 작업을 함께 문서화한다.
- 설계 포인트에는 질의 비용, 관계 생성 전략, 추적성 유지 방식이 포함된다.
- 후속 구현은 축/관계 정체성을 다루는 `behavior-traversal-axis`를 전제로 한다.
