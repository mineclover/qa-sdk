---
def:
  tier: component
  id: monitor-data
  address: def_document:v2:343043
  scope: data
  aspect: system_data
  depth: overview
  lifecycle: approved
  layer: operation
  svc: monitor
  tags: [external]
  links:
    - target: monitor-service-spec
      type: refines
sources:
  - simulations/enterprise-pm/services/audit-browser-api/src/audit-explorer/infrastructure/adapters/audit-recorder-query.adapter.ts
  - simulations/enterprise-pm/services/audit-browser-api/src/audit-explorer/infrastructure/adapters/audit-recorder-query.adapter.test.ts
  - simulations/enterprise-pm/services/audit-browser-api/src/audit-explorer/infrastructure/adapters/graph-snapshot-query.adapter.ts
  - simulations/enterprise-pm/services/audit-browser-api/src/audit-explorer/infrastructure/adapters/graph-snapshot-query.adapter.test.ts
  - simulations/enterprise-pm/services/audit-browser-api/src/audit-explorer/infrastructure/adapters/graph-retention-insight.adapter.ts
  - simulations/enterprise-pm/services/audit-browser-api/src/audit-explorer/infrastructure/adapters/graph-retention-insight.adapter.test.ts
  - simulations/enterprise-pm/services/audit-browser-api/src/graph-explorer/infrastructure/adapters/graph-store-query.adapter.ts
  - simulations/enterprise-pm/services/audit-browser-api/src/graph-explorer/infrastructure/adapters/graph-store-query.adapter.test.ts
  - simulations/enterprise-pm/services/audit-browser-api/src/graph-explorer/application/events/graph-retention-event.ts
  - simulations/enterprise-pm/services/audit-browser-api/src/graph-explorer/application/events/graph-retention-event.test.ts
  - packages/authorization-monitor-web/public/authorization-graph-snapshot.json
---
# Monitor — data/system_data

## 목적 ^purpose

모니터링 시각화 데이터. 세션 집계, 트레이스 메타, 이벤트 스트림 버퍼.

## 구성 ^overview

Monitor — data/system_data의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
