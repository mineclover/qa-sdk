---
def:
  id: nest-service-template-rule
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: cli
  tags: [template, architecture, convention]
  links:
    - target: nest-service-template
      type: constrains
    - target: nest-service-kit-rule
      type: depends_on
    - target: service-definition-standard
      type: depends_on
  sources:
    - packages/cli/src/templates/nest-service-template.ts
    - packages/cli/src/commands/init.ts
    - packages/cli/src/commands/init.test.ts
    - packages/cli/src/commands/index-usage.test.ts
---

# Nest Service Template — Scaffold Rule

## 목적 ^purpose

`qa-sdk init --nest-service`가 생성하는 baseline을 어디까지 믿고, 어디서부터 서비스별 구현/문서화로 넘겨야 하는지 정의한다.

## 규칙 ^constraint

- 템플릿은 monorepo 안의 package root를 기준으로 사용한다.
- generated example domain은 placeholder다. 실제 서비스는 bounded context 이름과 adapter implementation으로 교체한다.
- generated service는 최소 service system/rule/test 또는 equivalent closure evidence를 추가해야 한다.
- `ProjectQueryPort`, `EventPublisherPort` 같은 public contract는 유지하되 구현체는 서비스별로 교체한다.
- `NoopEventPublisher`는 smoke baseline일 뿐이며, 운영 환경에서는 outbox 또는 broker adapter로 교체한다.
- `qa-sdk init --nest-service`는 code scaffold만 수행한다. selector root, closure, event taxonomy는 생성 후 문서/검증 루프에서 닫는다.

## 검증 ^consumes

```bash
corepack pnpm --filter @qa-sdk/cli test -- init.test.ts index-usage.test.ts
corepack pnpm --filter @qa-sdk/cli typecheck
corepack pnpm --filter @qa-sdk/cli build
qa-sdk docs closure nest-service-template
```
