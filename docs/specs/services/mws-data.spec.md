---
def:
  id: mws-data
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: operation
  svc: motion-workspace-service
  tags: [tier-infra]
  links:
    - target: motion-workspace-service-spec
      type: refines
---
# Motion Workspace Service — data/domain_data

## 목적 ^purpose

워크스페이스 영속 데이터. SQLite 기반 workspace snapshot, revision 이력.
