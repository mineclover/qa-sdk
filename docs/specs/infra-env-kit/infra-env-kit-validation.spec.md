---
def:
  id: infra-env-kit-validation
  type: spec
  tier: component
  level: leaf
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: infra-env-kit
  tags: [infra, testing]
  links:
    - target: infra-env-kit-system
      type: refines
    - target: infra-env-kit-env-bridge
      type: depends_on
    - target: infra-env-kit-export-surface
      type: depends_on
    - target: infra-env-kit-codegen
      type: depends_on
sources:
  - packages/infra-env-kit/__tests__/env-bridge.test.ts
  - packages/infra-env-kit/__tests__/export-command.test.ts
  - packages/infra-env-kit/__tests__/export-files.test.ts
  - packages/infra-env-kit/__tests__/codegen.test.ts
  - packages/infra-env-kit/__tests__/discovery-client.test.ts
---

# infra-env-kit validation

## 목적 ^purpose

env bridge 변환 규칙, CLI command dispatch, file export, registry discovery, post-deploy codegen behavior를 테스트로 고정한다.

## 구성 ^overview

- `env-bridge.test.ts`: skipped infra keys와 service env extraction reuse를 검증한다.
- `export-command.test.ts`: `env` command가 파일을 생성하는지 검증한다.
- `export-files.test.ts`: env/ts/compose writer가 artifact를 생성하는지 검증한다.
- `codegen.test.ts`: service connection module과 env file generation을 검증한다.
- `discovery-client.test.ts`: environment-specific service URL resolution을 검증한다.
