---
def:
  tier: component
  id: mws-api
  address: def_document:v2:412682
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: motion-workspace-service
  tags: [entry-point, contract, runtime]
  links:
    - target: motion-workspace-service-spec
      type: refines
sources:
  - packages/motion-workspace-service/src/app.ts
  - packages/motion-workspace-service/src/controller.ts
  - packages/motion-workspace-service/src/routes/workspaces.ts
  - packages/motion-workspace-service/src/ws-hub.ts
  - packages/motion-workspace-service/src/ws-protocol.ts
  - packages/motion-workspace-service/src/errors.ts
  - packages/motion-workspace-service/src/error-handler.ts
  - packages/motion-workspace-service/test/app.test.ts
  - packages/motion-workspace-service/test/ws-hub.test.ts
---
# Motion Workspace Service — interface/api_contract

## 목적 ^purpose

모션 워크스페이스 API 계약. workspace CRUD, 에디터 명령 적용, conflict 감지.

## 구성 ^overview

Motion Workspace Service — interface/api_contract의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
