---
def:
  tier: component
  id: motion-workspace-client
  address: def_document:v2:412681
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  svc: motion-workspace-client
  tags: [mediation, motion, client]
  links:
    - target: motion-workspace-system
      type: depends_on
    - target: motion-workspace
      type: depends_on
sources:
  - packages/motion-workspace-client/src/index.ts
  - packages/motion-workspace-client/src/client.ts
  - packages/motion-workspace-client/src/types.ts
  - packages/motion-workspace-client/src/ws-client.ts
  - packages/motion-workspace-client/src/client.test.ts
  - packages/motion-workspace-client/src/ws-client.test.ts
---
# motion-workspace-client

## 목적 ^purpose

motion-workspace-service API에 대한 타입 안전 HTTP + WebSocket 클라이언트 라이브러리. 서버 API 계약을 클라이언트 측에서 일관되게 소비할 수 있도록 중재한다.

## 구성 ^overview

- **MotionWorkspaceClient**: HTTP REST 클라이언트 — list / get / create / save / delete workspace
- **MotionWorkspaceWsClient**: WebSocket 실시간 동기화 클라이언트 — connect / subscribe / broadcast
- **WorkspaceListItem / WorkspaceSummary**: 응답 타입 정의
- 서버 baseUrl 기반 구성, fetch API 사용

## 설계 결정 ^intent

- 순수 HTTP + WebSocket — 프레임워크 무관 (Node.js, 브라우저 모두 사용 가능)
- motion-workspace 타입을 재사용하여 서버-클라이언트 간 계약 일치 보장
- WebSocket은 workspace 단위 구독 — 다수 사용자 동시 편집 지원 기반
