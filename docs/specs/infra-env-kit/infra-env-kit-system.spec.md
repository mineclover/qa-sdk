---
def:
  id: infra-env-kit-system
  type: spec
  tier: layout
  owner_system: infra-env-kit
  scope: interface
  aspect: cli_contract
  depth: overview
  lifecycle: approved
  layer: operation
  svc: infra-env-kit
  tags: [infra, runtime, contract, structural]
  links:
    - target: shared-utility-group
      type: refines
    - target: infra-engine-pipeline
      type: depends_on
    - target: infra-env-kit-env-bridge
      type: refs
    - target: infra-env-kit-export-surface
      type: refs
    - target: infra-env-kit-codegen
      type: refs
    - target: infra-env-kit-validation
      type: refs
  sources:
    - packages/infra-env-kit/src/index.ts
    - packages/infra-env-kit/src/cli.ts
---

# infra-env-kit system

## 목적 ^purpose

`infra-engine`의 runtime/deploy 책임에서 환경 공급 책임을 분리하여 `.env`, TypeScript service connection module, docker-compose override를 생성하는 supply package다.

## 구성 ^overview

- `infra-env-kit-env-bridge`: service config와 dependency connection을 environment variables로 변환한다.
- `infra-env-kit-export-surface`: `infra-env env|ts|compose` 명령과 file writer orchestration을 제공한다.
- `infra-env-kit-codegen`: deploy 후 service connection module과 dependent service env file을 생성한다.
- `infra-env-kit-validation`: bridge/export/codegen/discovery behavior를 테스트로 고정한다.

## 책임 경계 ^constraint

- 이 패키지는 service deployment를 수행하지 않는다.
- service discovery의 원본은 registry/infra-engine 쪽이며, 이 패키지는 `EnvDiscoveryClient` interface를 통해 읽기만 한다.
- `infra-engine`은 운영/배포/관측 surface이고, `infra-env-kit`은 환경 공급 surface다.
