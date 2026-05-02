---
def:
  id: infra-engine-system-rule
  type: spec
  tier: component
  scope: constraint
  aspect: infra_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: infra-engine
  tags: [infra, devops, runtime]
  links:
    - target: infra-engine-system
      type: constrains
    - target: infra-engine-pipeline
      type: depends_on
    - target: infra-service-operations
      type: traces_to
---

# Infra Engine System — Consumption Rule

## 목적 ^purpose

`infra-engine-system`을 배포/검증/관측 자동화의 owner boundary로 소비할 때 확인해야 하는 규칙을 정의한다.

## 규칙 ^constraint

- pipeline stage 순서는 Config → Provision → Register → Verify → Observe를 따른다.
- Config/Provision/Register/Verify는 실패 시 pipeline rollback 정책을 따른다.
- Observe는 fail-open이다. 관측 실패가 배포 성공을 롤백하면 안 된다.
- service endpoint는 config → service-profile → skip 순서의 resolve chain을 따른다.
- source annotation은 `infra-engine-system`을 boundary로 사용한다. 임의 alias `infra-engine`을 만들지 않는다.
- provider-specific behavior는 provider adapter 문서로 분리하고, core pipeline은 provider-independent contract를 유지한다.

## 검증 ^consumes

```bash
pnpm --filter infra-engine test
pnpm --filter infra-engine build
qa-sdk def find-by-file packages/infra-engine/src/index.ts
qa-sdk docs closure infra-engine-system
```

