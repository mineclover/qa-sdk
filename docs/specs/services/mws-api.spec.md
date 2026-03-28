---
def:
  id: mws-api
  address: def_document:v1:3224
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: motion-workspace-service
  tags: [tier-backend]
  links:
    - target: motion-workspace-service-spec
      type: refines
---
# Motion Workspace Service — interface/api_contract

## 목적 ^purpose

모션 워크스페이스 API 계약. workspace CRUD, 에디터 명령 적용, conflict 감지.
