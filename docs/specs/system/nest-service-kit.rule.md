---
def:
  id: nest-service-kit-rule
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: nest-service-kit
  tags: [runtime, architecture, convention]
  links:
    - target: nest-service-kit
      type: constrains
    - target: service-definition-standard
      type: depends_on
    - target: architecture-revealing-code-convention
      type: depends_on
    - target: event-intent-definition-rule
      type: depends_on
---

# Nest Service Kit — Consumption Rule

## 목적 ^purpose

`@qa-sdk/nest-service-kit`을 서비스 bootstrap baseline으로 사용할 때 지켜야 하는 entrypoint, event, adapter 경계 규칙을 정의한다.

## 규칙 ^constraint

- service entrypoint는 `bootstrapNestService` 또는 동일 contract를 가진 bootstrap helper를 사용한다.
- `main.ts`가 bootstrap ownership을 가진다. application/domain layer는 Nest app 생성 책임을 가지지 않는다.
- application layer의 event publish는 `EventPublisherPort`를 통해서만 수행한다.
- production service는 `NoopEventPublisher`를 그대로 두지 않는다. outbox 또는 실제 transport adapter로 교체한다.
- semantic event는 가능하면 requester, behavior, request path, subject, effect, outcome context를 함께 채운다.
- WebSocket support는 opt-in이다. 사용하지 않는 서비스가 `@nestjs/platform-ws` 설치를 강제당하면 안 된다.

## 검증 ^consumes

```bash
pnpm --filter @qa-sdk/nest-service-kit typecheck
pnpm --filter @qa-sdk/nest-service-kit test
pnpm --filter @qa-sdk/nest-service-kit build
qa-sdk docs closure nest-service-kit
```
