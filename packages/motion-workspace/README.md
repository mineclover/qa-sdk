# motion-workspace

`motion-workspace`는 `motion-content` 위에 놓이는 headless workspace 계층이다.

## 책임

- 온라인 에디터용 workspace snapshot schema
- workspace parse / serialize / validate / migrate
- `MotionEditorSession` 기반 headless controller
- 브라우저 셸과 CLI가 공통으로 사용할 수 있는 비-DOM orchestration

## 계약 경계

| 계약 | schemaVersion | 책임 |
|------|---------------|------|
| `MotionCompositionDocumentV1` | `qa-sdk.motion-composition/v1` | portable composition JSON. runtime/editor가 공통으로 해석하는 문서 envelope |
| `MotionWorkspaceSnapshotV1` | `qa-sdk.motion-workspace/v1` | composition document + source metadata + revision + persisted editor state |

- `MotionWorkspaceSnapshotV1.document`는 기존 `MotionCompositionDocumentV1` envelope를 그대로 보존한다.
- `source`는 preset, storage key, import path 같은 provenance metadata만 담는다.
- `editor`는 `values`, `selection`, `viewport`, `loop`, `playbackRate`만 round-trip 한다.
- dock layout, theme 같은 editor-local preference는 workspace snapshot에 넣지 않고 셸 로컬 저장소 경계에 남긴다.

## 포함하지 않는 것

- GSAP runtime 계약
- DOM editor shell
- HTTP client
- 서버 HTTP endpoint

## 패키지 경계

- `motion-content`는 composition/runtime core에 남는다
- `motion-workspace`는 persistence-aware workspace orchestration만 담당한다
- 원격 API 호출은 `motion-workspace-client`
- 서버 구현은 `@qa-sdk/motion-workspace-service`
