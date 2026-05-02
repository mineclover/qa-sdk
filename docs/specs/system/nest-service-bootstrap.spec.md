---
def:
  id: nest-service-bootstrap
  type: spec
  tier: system
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  svc: nest-service-kit
  tags: [runtime, observability, structural]
  links:
    - target: nest-service-kit
      type: refines
    - target: nest-service-kit-rule
      type: traces_to
    - target: nest-service-kit-test
      type: traces_to
    - target: nest-service-bootstrap-rule
      type: traces_to
    - target: nest-service-bootstrap-cases
      type: traces_to
    - target: nest-service-bootstrap-test
      type: traces_to
---
sources:
  - packages/nest-service-kit/src/bootstrap.ts
  - packages/nest-service-kit/src/logger.ts

# Nest Service Bootstrap

## 목적 ^purpose

Nest 서비스 entrypoint가 같은 방식으로 Fastify app, telemetry, CORS, shutdown, port-conflict warning을 연결하도록 표준화한다.

## 구성 ^overview

- `bootstrapNestService`: `NestFactory.create()`와 `FastifyAdapter`를 감싼 bootstrap helper.
- `telemetryEnv`: `otelEnvSchema` 기반 env parse 후 `initTelemetry()`를 호출한다.
- `ServiceLogger`: service boot/shutdown/logging에 필요한 최소 logger surface.
- `useWebSocketAdapter`: 필요할 때만 `@nestjs/platform-ws`를 lazy-load 한다.

## 운영 규칙 ^constraint

- `bootstrapNestService`는 `main.ts` 같은 service entrypoint가 소유한다. domain module, application service, adapter provider 안에서 `NestFactory.create()`를 직접 호출하지 않는다.
- shutdown hook과 telemetry flush는 bootstrap 단계에서 일괄 관리한다.
- WebSocket adapter는 opt-in이다. 기본 bootstrap이 `@nestjs/platform-ws` 설치를 강제하면 안 된다.
- logger는 `info`, `warn`, `error` surface를 제공해야 한다.
