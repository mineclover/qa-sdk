---
def:
  id: behavior-traversal-axis
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  svc: weighted-index
  tags: [tier-infra]
  links:
    - target: coordinate-states-spec
      type: depends_on
    - target: behavioral-traversal
      type: refines
---

# 행위 축 탐색 - 축과 관계 모델

## 목적 ^purpose

정적 좌표 타입 시스템 위에 행위 축을 어떻게 올리는지와 탐색의 최소 단위, 기본 관계를 정의해 동적 탐색의 전제를 고정한다.

## 타입 시스템과 행위 축

- 좌표 타입 시스템이 "무엇이 존재하는가"를 정의한다면, 행위 축은 "그 타입이 어떤 경로로 움직이는가"를 다룬다.
- 이 계층은 QA 시스템과 단일 원천 추적이 이미 존재한다는 전제 위에서만 의미가 있다.
- 최소 탐색 단위는 개별 이벤트보다 "관계가 성립하는 순간"에 가깝다.

## 기본 관계

- 문서는 4가지 기본 관계를 두고, 각 관계를 query pattern이 읽을 수 있는 연산으로 본다.
- 관계 정의는 상태 모델과 독립적이지 않으며 `coordinate-states-spec`에 기대어 해석된다.
- 이 문서는 축과 관계의 정체성을 다루고, 질의 DSL과 구현 모델은 `behavior-traversal-query`로 넘긴다.
