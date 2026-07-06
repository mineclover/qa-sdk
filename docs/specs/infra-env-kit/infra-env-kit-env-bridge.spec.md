---
def:
  id: infra-env-kit-env-bridge
  type: spec
  tier: component
  level: leaf
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: operation
  svc: infra-env-kit
  tags: [infra, contract]
  links:
    - target: infra-env-kit-system
      type: refines
    - target: infra-config-stage
      type: depends_on
sources:
  - packages/infra-env-kit/src/types.ts
  - packages/infra-env-kit/src/env-bridge.ts
---

# infra-env-kit env bridge

## 목적 ^purpose

infra config의 service settings와 dependency connection 정보를 runtime process가 소비할 수 있는 environment variable map으로 변환하는 data bridge다.

## 구성 ^overview

- `EnvDiscoveryClient`는 service URL, tier, owned/consumed prefixes, deployment metadata를 읽는 최소 interface다.
- `configToEnvVars`는 primitive config 값을 uppercase env key로 변환한다.
- `extractServiceEnv`는 특정 service의 own config env만 추출한다.
- `resolveConnectionEnv`는 `depends_on` connection endpoint를 `<SERVICE_ID>_URL` env key로 변환한다.

## 제약 ^constraint

- `depends_on`, `gates`, `health_path`는 infra 내부 control key이므로 env var로 export하지 않는다.
- nested object는 env var로 자동 flatten하지 않는다. 필요한 값은 infra config에서 명시 primitive로 노출해야 한다.
