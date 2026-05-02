---
def:
  id: motion-workspace-system
  tier: system
  address: def_document:v2:68638
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  svc: motion-workspace-service
  tags: [motion, workspace, system]
  links:
    - target: motion-workspace
      type: contains
    - target: motion-workspace-client
      type: contains
---
# motion-workspace-system

## 목적 ^purpose

모션 콘텐츠 편집 워크스페이스 시스템. 도메인 라이브러리(motion-workspace), HTTP/WS 클라이언트(motion-workspace-client), API 서비스(motion-workspace-service)로 구성된다.

## 구성 ^overview

- **motion-workspace**: 도메인 계층 — 스키마, IO, 마이그레이션, headless controller
- **motion-workspace-client**: 중재 계층 — 타입 안전 HTTP + WebSocket 클라이언트
- **motion-workspace-service**: 운영 계층 — Hono 기반 REST + WS API 서비스 (port 3710)

## 서비스 런타임 구성 ^overview

`motion-workspace-service` 패키지는 다음 구성요소를 조립한다.

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

## 연관 스펙

- 서비스 구현 상세: [`motion-workspace-service-spec`](../motion-content/motion-workspace-service.spec.md)
- 클라이언트 상세: [`motion-workspace-client-spec`](../motion-content/motion-workspace-client.spec.md)
- 도메인 라이브러리: [`motion-workspace`](./motion-workspace.md)
