---
def:
  tier: system
  id: motion-workspace-service
  address: def_document:v2:68637
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: deprecated
  svc: motion-workspace-service
  superseded_by: motion-workspace-system
  tags: [operation, motion, service]
  links:
    - target: motion-workspace-system
      type: traces_to
sources:
  - docs/specs/motion-workspace/motion-workspace-system.md
  - docs/specs/motion-content/motion-workspace-service.spec.md
  - packages/motion-workspace-service/src/app.ts
  - packages/motion-workspace-service/src/controller.ts
  - packages/motion-workspace-service/src/repository.ts
  - packages/motion-workspace-service/src/routes/workspaces.ts
  - packages/motion-workspace-service/src/ws-hub.ts
  - packages/motion-workspace-service/test/app.test.ts
  - packages/motion-workspace-service/test/repository.test.ts
---
# motion-workspace-service (deprecated)

## 목적 ^purpose

~~Workspace API 서비스. Hono 기반 HTTP + WebSocket 서버로, workspace의 CRUD와 실시간 동기화를 제공한다.~~

이 문서는 `motion-workspace-system` 과 좌표·범위가 중복되어 Phase 5a(2026-04-20) 에서 병합되었다. 서비스 런타임 구성과 설계 결정은 상위 시스템 문서로 흡수되었다.

- 신규 참조: [`motion-workspace-system`](./motion-workspace-system.md) — 시스템 overview + 서비스 런타임 구성
- 서비스 구현 스펙: [`motion-workspace-service-spec`](../motion-content/motion-workspace-service.spec.md) — controller / repository / error / health 등 세부 사양
