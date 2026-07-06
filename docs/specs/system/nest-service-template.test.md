---
def:
  id: nest-service-template-test
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: mediation
  svc: cli
  tags: [testing, template, structural]
  links:
    - target: nest-service-template
      type: refines
sources:
  - packages/cli/src/commands/init.test.ts
  - packages/cli/src/commands/index-usage.test.ts
---

# Nest Service Template — Validation Mapping

## 목적 ^purpose

`qa-sdk init --nest-service` scaffold behavior와 help surface를 어떤 테스트가 검증하는지 연결한다.

## 검증 매핑 ^defines

| 검증 표면 | 테스트 |
|-----------|--------|
| generated package files and dependencies | `packages/cli/src/commands/init.test.ts` |
| nested target path relative tsconfig | `packages/cli/src/commands/init.test.ts` |
| root help usage surface | `packages/cli/src/commands/index-usage.test.ts` |

## 검증 명령

```bash
corepack pnpm --filter @qa-sdk/cli test -- init.test.ts index-usage.test.ts
```
