---
def:
  tier: component
  id: motion-workspace-client-spec
  address: def_document:v2:412818
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: motion-workspace-client
  tags: [structural]
  links:
    - target: motion-workspace-spec
      type: depends_on
    - target: motion-workspace-service-spec
      type: depends_on
---
# Motion Workspace Client

## 목적 ^purpose

motion-workspace-service API에 대한 typed HTTP 클라이언트. workspace CRUD, 에디터 명령 적용, conflict 감지를 fetch 기반으로 제공한다. 브라우저와 Node.js 양쪽에서 사용 가능하며, `MotionWorkspaceClientError`로 상태 코드별 에러를 구조화한다.

## 구성 ^overview

- `MotionWorkspaceClient`: list, get, create, apply(command), delete
- `MotionWorkspaceClientError`: status + payload 구조화 에러
- Conflict 감지: `MotionWorkspaceConflictErrorShape` — revision 충돌 시 409 응답 파싱
- 소스: `packages/motion-workspace-client/src/`
