---
def:
  tier: component
  id: motion-workspace
  address: def_document:v2:68636
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  svc: motion-workspace
  tags: [domain, motion, workspace]
  links:
    - target: motion-workspace-system
      type: refines
---
# motion-workspace

## 목적 ^purpose

Workspace schema, IO, migration, headless controller를 제공하는 도메인 라이브러리. motion-content 에디터의 작업 상태(편집 상태, 뷰포트, 선택, 재생 설정)를 정의하고 관리한다.

## 구성 ^overview

- **MotionWorkspaceSnapshot**: workspace 전체 상태 스냅샷 (document + editor + revision + savedAt)
- **WorkspaceController**: headless 상태 머신 — open / save / undo / redo / updateEditor / applyDocumentOp
- **IO**: 파일 기반 load/save (JSON serialize/deserialize)
- **migrate()**: 스키마 버전 간 마이그레이션 (v1→v2 등)
- **MOTION_WORKSPACE_SCHEMA_V1 / V2**: 스키마 버전 상수

## 설계 결정 ^intent

- UI 프레임워크 독립적 headless controller — React/Vanilla/테스트 어디서든 사용
- 스냅샷 기반 영속 — diff가 아닌 전체 상태 저장으로 단순성 확보
- motion-content(composition document)를 감싸는 상위 계층
