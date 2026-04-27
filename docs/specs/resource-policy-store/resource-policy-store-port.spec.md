---
def:
  id: resource-policy-store-port
  type: spec
  tier: interface
  level: leaf
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: domain
  svc: resource-policy-store
  tags: [authorization, contract, structural]
  links:
    - target: resource-policy-store-system
      type: refines
    - target: permission-engine-spec
      type: implements
  sources:
    - packages/resource-policy-store/src/port.ts
---

# resource-policy-store port

## 목적 ^purpose

`ResourcePolicyRegistry` 소비자가 `permission-engine`과 store 패키지 양쪽을 직접 조합하지 않고, store package entrypoint에서 필요한 port 타입과 error 타입을 일관되게 import하도록 하는 interface boundary다.

## 구성 ^overview

- `ResourcePolicyRegistry`, `ResourcePolicy`, `ResourcePolicyState` 등 port 타입은 `permission-engine`에서 re-export한다.
- `DuplicatePolicyError`, `PolicyNotFoundError`도 동일 class identity를 유지한다.
- store 패키지는 별도 interface를 재정의하지 않는다.

## 관련 소스

- `packages/resource-policy-store/src/port.ts` — port/error re-export
- `packages/resource-policy-store/src/index.ts` — public package surface
- `packages/resource-policy-store/src/port.test.ts` — re-export identity smoke
