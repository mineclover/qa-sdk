---
def:
  id: sim-internal-network
  type: spec
  tier: system
  level: leaf
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: sim-internal-network
  tags: [simulator, network, guard, middleware]
  links:
    - target: system-libraries
      type: refines
  sources:
    - packages/sim-internal-network/src/hono-middleware.ts
    - packages/sim-internal-network/src/is-internal-ip.ts
    - packages/sim-internal-network/src/nestjs-guard.ts
---

# sim-internal-network

## 목적 ^purpose

시뮬레이션 admin/내부 endpoint 가 docker compose network 또는 loopback 같은 internal IP 에서만 호출 가능하도록 NestJS Guard 와 Hono middleware 양 프레임워크에 동일한 IP 검증 규칙을 SSOT 로 제공한다. 두 프레임워크 코드가 같은 `isInternalIp` 판정을 공유하기 때문에 boundary 가 한 곳에서 정의된다.

## 구성 ^overview

세 개 모듈로 구성된다.

- `is-internal-ip.ts` — `isInternalIp(addr)` 순수 판정 함수. docker network range 와 loopback 을 internal 로 인정한다.
- `nestjs-guard.ts` — `InternalIpGuard` (NestJS `CanActivate`). HTTP request 의 remote address 를 추출해 `isInternalIp` 로 검증한다.
- `hono-middleware.ts` — `internalIpMiddleware`, `InternalIpMiddlewareOptions`. Hono context 에서 동일 검증을 수행한다.

NestJS / Hono 는 모두 optional peer dependency — 본 패키지를 import 한 서비스만 해당 어댑터를 사용하도록 분리되어 있다.
