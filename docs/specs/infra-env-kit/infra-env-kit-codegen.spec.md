---
def:
  id: infra-env-kit-codegen
  type: spec
  tier: system
  level: leaf
  scope: flow
  aspect: pipeline_flow
  depth: specification
  lifecycle: approved
  layer: operation
  svc: infra-env-kit
  tags: [infra, codegen, runtime]
  links:
    - target: infra-env-kit-system
      type: refines
    - target: infra-engine-pipeline
      type: depends_on
sources:
  - packages/infra-env-kit/src/codegen.ts
  - packages/infra-env-kit/src/discovery-client.ts
---

# infra-env-kit codegen

## 목적 ^purpose

서비스 배포 후 해당 서비스와 그 service prefixes를 소비하는 downstream service들의 connection/env artifact를 생성하는 post-deploy codegen flow다.

## 구성 ^overview

- `runPostDeployCodegen`은 TypeScript connection module과 `.env.<service>.<env>` 파일을 생성한다.
- target service를 명시하지 않으면 deployed service의 `ownedPrefixes`와 다른 service의 `consumedPrefixes`를 비교해 dependent service를 역추적한다.
- config JSON은 명시 `configPath` 또는 infra-engine config directory에서 읽는다.
- `createEnvRegistryDiscoveryClient`는 registry-service API를 `EnvDiscoveryClient` interface로 감싼다.

## 제약 ^constraint

- codegen은 배포 결과를 변경하지 않고 artifact만 쓴다.
- deployed service를 discovery에서 찾지 못하거나 owned prefix가 없으면 downstream env target은 빈 목록이 된다.
