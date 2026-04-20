---
def:
  id: authorization-monitor-web
  type: spec
  level: leaf
  tier: component
  scope: ui
  aspect: component
  depth: specification
  lifecycle: draft
  layer: experience
  svc: authorization-monitor-web
  tags: [frontend, security, monitoring]
  links:
    - target: authorization-ontology-system
      type: refines
  source: packages/authorization-monitor-web
---

# @qa-sdk/authorization-monitor-web — 인가 경로 모니터

## 목적 ^purpose

proxy route enforcement와 application middleware enforcement를 한 화면에서 비교·감시하는 독립 웹 UI. authorization ontology의 실행 중 권한 판정 경로를 시각화해 두 경로 간 불일치(drift)를 즉시 감지할 수 있게 한다.
