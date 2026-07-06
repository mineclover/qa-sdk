---
def:
  id: infra-env-kit-export-surface
  type: spec
  tier: interface
  level: leaf
  scope: interface
  aspect: cli_contract
  depth: specification
  lifecycle: approved
  layer: operation
  svc: infra-env-kit
  tags: [infra, cli, contract]
  links:
    - target: infra-env-kit-system
      type: refines
    - target: infra-discovery
      type: depends_on
sources:
  - packages/infra-env-kit/src/cli.ts
  - packages/infra-env-kit/src/export-command.ts
  - packages/infra-env-kit/src/export-files.ts
  - packages/infra-env-kit/src/env-file.ts
  - packages/infra-env-kit/src/typescript-module.ts
  - packages/infra-env-kit/src/docker-compose.ts
---

# infra-env-kit export surface

## 목적 ^purpose

`infra-env` CLI와 library writer API를 통해 service-specific `.env`, environment-wide TypeScript connection module, docker-compose override를 생성하는 interface boundary다.

## 구성 ^overview

- `infra-env env <serviceId> [env]`는 service env file을 생성한다.
- `infra-env ts [env]`는 service connection TypeScript module을 생성한다.
- `infra-env compose [env]`는 docker-compose override를 생성한다.
- `runSupplyExportCommand`는 CLI argument 해석과 writer dispatch를 담당한다.
- `writeEnvExport`, `writeTypescriptExport`, `writeDockerComposeExport`는 file output orchestration을 담당한다.

## 제약 ^constraint

- CLI 기본 registry URL은 `REGISTRY_URL` 또는 `http://localhost:3300`이다.
- `--pg-domain`은 허용된 domain 값만 받는다.
- output path는 `--out`으로 override할 수 있지만, 생성 content의 source는 discovery/config interface다.
