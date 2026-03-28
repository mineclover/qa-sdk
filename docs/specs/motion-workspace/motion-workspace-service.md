---
def:
  id: motion-workspace-service
  address: def_document:v2:68637
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  svc: motion-workspace-service
  tags: [operation, motion, service]
  links:
    - target: motion-workspace
      type: depends_on
---
# motion-workspace-service

## 목적 ^purpose

Workspace API 서비스. Hono 기반 HTTP + WebSocket 서버로, workspace의 CRUD와 실시간 동기화를 제공한다.

## 구성 ^overview

- **createApp()**: Hono 앱 팩토리 — controller + repository + WebSocket hub 조립
- **MotionWorkspaceController**: 비즈니스 로직 레이어 — list / get / create / save / delete
- **MotionWorkspaceRepository** (port): 영속 추상 인터페이스
- **SQLiteRepository**: SQLite 기반 구현체 (drizzle schema)
- **WorkspaceWsHub**: WebSocket 연결 관리 + workspace 단위 브로드캐스트
- **Health / Workspace routes**: REST 엔드포인트
- **ErrorHandler**: 일관된 에러 응답 형식

## 설계 결정 ^intent

- Controller + Repository 패턴 — 영속 계층 교체 가능 (SQLite → PostgreSQL 등)
- WebSocket hub은 인메모리 — 단일 인스턴스 기준, 스케일아웃 시 Redis pub/sub 전환
- Hono 선택: 경량, Edge 런타임 호환, middleware 체인
