---
def:
  id: authorization-ontology-monitor-web
  type: knowledge
  knowledge_kind: concept
  scope: ui
  aspect: component
  depth: specification
  lifecycle: draft
  layer: experience
  tags: [security, structural]
  links:
    - target: authorization-ontology-system
      type: refines
    - target: authorization-ontology-auth-chain
      type: depends_on
    - target: authorization-ontology-application-enforcement
      type: depends_on
    - target: authorization-ontology-audit-layer
      type: depends_on
---

# Authorization Ontology Monitor Web — 권한 관측 독립 웹

## 목적 ^purpose

proxy route enforcement와 application middleware enforcement를 한 화면에서 비교하는 독립 웹 UI를 정의한다. 목표는 `platform-demo`의 범용 데모 표면에서 권한 관측 시각화를 분리해, authorization ontology 운영 화면을 별도 패키지로 발전시키는 것이다.

## 구성 ^overview

`@qa-sdk/authorization-monitor-web`는 다음을 시각화한다.

- Cerbos policy가 `proxy_route`와 `domain_resource`를 보호하는 구조
- proxy gate의 `proxy_route -> enforced_at -> nginx_proxy` 경로
- application gate의 `domain_resource -> enforced_at -> service_middleware` 경로
- decision observation의 `decision -> principal/resource/action/policy/enforcement` 경로

## 정의 ^defines

초기 구현은 브라우저 안전성을 위해 샘플 graph view model을 내장한다. `authorization-ontology` 런타임은 현재 `operational-ontology`의 Node API 의존성을 transitively 포함하므로, browser bundle에 직접 import하지 않는다.

monitor web은 `/authorization-graph-snapshot.json` 또는 `?graph=<url>`로 graph snapshot JSON을 읽을 수 있다. payload는 `AuthorizationOntologyGraph` 자체이거나 `{ graphId, snapshotId, graph }` 형태의 snapshot object일 수 있다. fetch 실패 시 내장 샘플 graph로 fallback한다.
