---
def:
  id: motion-workspace-spec
  level: module
  address: def_document:v2:68777
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: motion-workspace
  tags: [structural]
  links:
    - target: motion-content-contract
      type: refines
    - target: motion-workspace-client-spec
      type: contains
---
# Motion Workspace

## 목적 ^purpose

motion-content 기반 온라인 에디터의 workspace 스키마, IO(직렬화/역직렬화), 마이그레이션, headless 컨트롤러를 제공하는 라이브러리. 에디터 상태(values, selection, viewport, loop, playbackRate)를 영속 가능한 snapshot으로 관리하고, undo/redo를 포함한 세션 명령을 처리한다.

## 구성 ^overview

- `MotionWorkspaceController`: 세션 관리 + 명령 적용 + snapshot 생성 + dirty 추적
- `MotionWorkspaceSnapshotV1`: composition document + persisted editor state + source metadata
- IO: `createMotionWorkspaceSnapshot()` — JSON/문자열/객체 입력을 정규화하여 snapshot 생성
- Migration: `migrateMotionWorkspaceSnapshot()` — 스키마 버전 간 자동 마이그레이션
- 소스: `packages/motion-workspace/src/`
