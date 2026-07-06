---
def:
  tier: component
  id: shopping-backend-api
  address: def_document:v2:412689
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: shopping-backend
  tags: [entry-point, contract, runtime]
  links:
    - target: shopping-backend-spec
      type: refines
sources:
  - packages/platform-demo-api/src/index.ts
  - packages/platform-demo-api/scripts/read-api.test.ts
  - packages/platform-demo-api/src/registry.ts
  - packages/platform-demo-api/src/demo-dashboard-read-model.ts
  - packages/platform-demo-api/package.json
---
# Shopping Backend — interface/api_contract

## 목적 ^purpose

platform-demo-api가 노출하는 쇼핑 백엔드 관련 read API 계약. service/permission/event 좌표 조회, scenario, grant-table, log seed 표면으로 쇼핑 백엔드 prefix와 권한/이벤트 상태를 관측한다.

## 구성 ^overview

Shopping Backend — interface/api_contract의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
