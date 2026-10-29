---
def:
  id: apm-codegen-system
  tier: system
  address: def_document:v2:68610
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: cli
  tags: [structural]
  links:
    - target: codegen-cli-contract
      type: contains
    - target: codegen-schema-output
      type: contains
    - target: snapshot-io-spec
      type: contains
    - target: codegen-core
      type: contains
    - target: apm-system
      type: depends_on
sources:
  - packages/cli/src/commands/codegen.ts
  - packages/cli/src/scenarios.e2e.test.ts
  - packages/codegen-core/src/index.ts
  - packages/snapshot-io/src/index.ts
---

# APM 코드젠 그룹

## 목적 ^purpose

Catalog/Registry 기반 codegen을 CLI 실행 계약과 TypeScript 산출물 규칙으로 나눠 유지보수 경계를 분명히 한다.

## 구성 ^overview

- `codegen-cli-contract`: Catalog/Registry 입력, 명령 실행, 생성 순서를 담당하는 CLI 계약.
- `codegen-schema-output`: (deprecated) SchemaSnapshot → protobuf·TypeScript envelope 산출물. 생성기 삭제, wire 계약은 core `TransmissionEnvelope`·`proto/transmission.proto`.
- `codegen-core`: Catalog 입력에서 TypeScript 문자열을 생성하는 순수 함수 경계.
- `snapshot-io`: SchemaSnapshot JSON 읽기/쓰기/검증 I/O 경계.

## 검증 ^validation

```bash
corepack pnpm --filter codegen-core test
corepack pnpm --filter snapshot-io test
corepack pnpm --filter @qa-sdk/cli test codegen
```

원본: `docs/specs/apm/codegen.spec.md` (`codegen-spec`)
