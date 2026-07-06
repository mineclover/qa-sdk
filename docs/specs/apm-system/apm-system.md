---
def:
  id: apm-system
  tier: layout
  address: def_document:v2:68611
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: cli
  tags: [structural, entry-point]
  links:
    - target: collection-transport-spec
      type: refs
    - target: infra-logger-spec
      type: refs
    - target: cli-contract-spec
      type: refs
    - target: metrics-spec
      type: refs
    - target: apm-sdk
      type: refs
    - target: apm-codegen-system
      type: contains
    - target: apm-schema-system
      type: contains
    - target: apm-runtime-system
      type: contains
sources:
  - packages/cli/src/commands/codegen.ts
  - packages/sdk/src/index.ts
  - packages/apm/src/index.ts
  - packages/logger/src/logger.ts
  - packages/ingest-server/src/routes/ingest.ts
---

## 목적 ^purpose

코드 생성, DSL 스키마, 주소 컨텍스트, 런타임 흐름, 로깅, CLI 등 APM 관측 인프라.

## 구성 ^overview

- `apm-codegen-system`: SchemaSnapshot 기반 codegen을 CLI 계약과 생성 산출물 규칙으로 분리한 그룹.
- `apm-schema-system`: DSL 축 설계와 `address_context` 형식을 도메인/저장 계약으로 분리한 그룹.
- `apm-runtime-system`: 런타임 흐름과 로거 계약을 경로/도입/제약으로 분리한 그룹.
- `collection-transport-spec`: SDK가 수집 envelope을 외부 수집기로 전달하는 전송 계층의 역할, 공통 인터페이스, 기본 구현 범위를 정의한다.
- `infra-logger-spec`: 구조화 JSON 로깅.
- `cli-contract-spec`: APM 스키마 관리, 좌표 연산, DKG 진단, 의사결정 흐름을 CLI로 제공하는 관측 도구.

## 검증 ^validation

```bash
corepack pnpm --filter @qa-sdk/cli test codegen
corepack pnpm --filter @qa-sdk/sdk test qa-context
corepack pnpm --filter @qa-sdk/apm test
corepack pnpm --filter @qa-sdk/logger test ingest-forwarder
```
