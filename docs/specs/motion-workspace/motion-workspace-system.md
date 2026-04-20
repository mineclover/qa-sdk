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
