---
def:
  id: prefix-metric_aggregate
  scope: data
  aspect: prefix_schema
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [generated]
  links:
    - target: prefix-service
      type: depends_on
source: packages/demo-snapshot/src/demo-catalog.ts:DEMO_CATALOG.prefixes.metric_aggregate
---

## 목적 ^purpose

<!-- 다차원 메트릭 집계 (metric_aggregate) — 4차원 observation prefix -->
<!-- 이 prefix가 존재하는 이유를 작성한다. 코드의 description을 복사하지 않는다. -->
<!-- 어떤 비즈니스/운영 질문에 답하기 위해 이 좌표 공간이 필요한가? -->

## 설계 근거 ^intent

<!-- 왜 이 차원 조합인가? 다른 후보 차원은 왜 제외했는가? -->
<!-- 이 prefix로 무엇을 관측/판단/제어하려는가? -->
<!-- 예: "사용자 행동과 시스템 응답의 교차점을 관측하여 전환율 저하 원인을 식별한다" -->

## 사용 맥락 ^context

<!-- 어떤 시나리오/서비스에서 이 prefix가 사용되는가? -->
<!-- IntentLink나 ScenarioSpec에서 이 prefix가 어떤 역할을 하는가? -->
<!-- 예: "checkout-flow IntentLink에서 page_view + endpoint + order_event와 함께 관측된다" -->

## 주의사항 ^caveat

<!-- 알려진 한계, 엣지 케이스, 마이그레이션 주의점 -->
<!-- 예: "v1→v2 전환 시 page axis headroom이 2로 좁다. capacity 확장 필요할 수 있다" -->

## 관련 소스

- packages/demo-snapshot/src/demo-catalog.ts:DEMO_CATALOG.prefixes.metric_aggregate
