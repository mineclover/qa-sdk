---
def:
  id: motion-workspace-service-spec
  level: module
  address: def_document:v2:68776
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  svc: motion-workspace-service
  tags: [ structural]
  links:
    - target: motion-workspace-spec
      type: depends_on
    - target: mws-api
      type: contains
    - target: mws-data
      type: contains
---
# Motion Workspace Service

## 목적 ^purpose

motion-workspace 라이브러리를 HTTP API로 노출하는 서비스. Hono 기반 controller + repository 패턴으로 workspace CRUD, 에디터 명령 적용, revision 기반 conflict 감지를 제공한다. `MotionWorkspaceController`(런타임)를 서버 측에서 관리하여 다중 클라이언트 간 상태 동기화를 보장한다.

## 구성 ^overview

- Controller: workspace CRUD + 명령 적용 라우트
- Repository: `MotionWorkspaceRepository` 포트 — workspace 영속 계층
- Error: `createInvalidRequestError`, `createMotionWorkspaceNotFoundError` — 구조화된 HTTP 에러
- Health: `/health` 엔드포인트
- 소스: `packages/motion-workspace-service/src/`
