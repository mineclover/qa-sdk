---
def:
  id: nest-service-template
  type: spec
  tier: system
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: cli
  tags: [template, structural, entry-point]
  links:
    - target: nest-service-kit
      type: depends_on
    - target: service-definition-standard
      type: depends_on
    - target: architecture-revealing-code-convention
      type: depends_on
    - target: nest-service-template-rule
      type: traces_to
    - target: nest-service-template-test
      type: traces_to
sources:
  - packages/cli/src/templates/nest-service-template.ts
  - packages/cli/src/commands/init.ts
  - packages/cli/src/commands/init.test.ts
---

# Nest Service Template

## 목적 ^purpose

`qa-sdk init --nest-service <path>`가 modular-monolith service의 최소 시작 구조를 같은 방식으로 생성하도록 스캐폴드 behavior를 정의한다.

## 생성 구조 ^overview

기본 생성 파일:

- `package.json`, `tsconfig.json`, `vitest.config.ts`, `README.md`
- `src/main.ts`, `src/app.module.ts`, `src/config/env.ts`
- `src/health/*`
- `src/domains/example/api/*`
- `src/domains/example/application/*`
- `src/domains/example/infrastructure/*`

기본 wiring:

- service entrypoint는 `bootstrapNestService`를 사용한다.
- env parsing은 `db-bootstrap`의 `dbEnvSchema`를 확장한다.
- example application service는 `ProjectQueryPort`와 `EventPublisherPort`에만 의존한다.
- example infrastructure module은 `NoopEventPublisher`와 static query adapter를 placeholder로 제공한다.

## Scaffold intent ^constraint

- 이 템플릿은 service boundary를 완성하지 않는다. 실제 bounded context 이름, adapter, event transport, docs family는 생성 후 서비스가 소유한다.
- generated `tsconfig.json`은 workspace root 기준 relative `extends`를 사용한다.
- package name 기본값은 target path의 leaf 이름을 기준으로 `@qa-sdk/<service>`를 만든다.
- scaffold는 service root index 후보가 되는 `main.ts`와 `AppModule`을 먼저 만든 뒤 하위 domain tree를 배치한다.
