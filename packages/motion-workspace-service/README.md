# @qa-sdk/motion-workspace-service

`@qa-sdk/motion-workspace-service`는 온라인 motion workspace 저장과 command 적용을 담당할 서버 패키지다.

## 책임

- workspace CRUD HTTP 표면
- revision 기반 optimistic concurrency
- server-side repository / persistence
- headless controller 위임

## 현재 상태

- SQLite 기반 기본 repository 구현이 포함된다
- `create/get/list/save/delete` 저장소 abstraction을 export한다
- save 경로는 `expectedRevision`과 `workspace.revision`을 분리해서 optimistic concurrency를 명시한다
- Hono 기반 `GET /health`, `GET /workspaces`, `GET /workspaces/:id`, `PUT /workspaces/:id`, `POST /workspaces/:id`, `DELETE /workspaces/:id` endpoint를 제공한다
- 오류 응답은 typed client가 그대로 읽을 수 있도록 top-level `{ code, message, ... }` JSON shape를 사용한다
