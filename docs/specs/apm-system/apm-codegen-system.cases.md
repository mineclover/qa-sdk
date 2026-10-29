---
def:
  id: apm-codegen-system-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: cli
  tags: [scenario, codegen, contract]
  links:
    - target: apm-codegen-system
      type: refines
    - target: apm-system
      type: depends_on
sources:
  - packages/cli/src/scenarios.e2e.test.ts
  - packages/codegen-core/src/catalog-typescript.test.ts
  - packages/snapshot-io/scripts/smoke.test.mjs
---

# APM Codegen — 소비자 기대 시나리오

## 목적 ^purpose

`apm-codegen-system`이 `apm-system`에 의존할 때 기대하는 계약 시나리오를 정의한다. apm-system이 제공하는 SchemaSnapshot 소스, 주소 컨텍스트 규칙, SDK 타입 시그니처가 codegen 파이프라인의 전제조건을 어떻게 충족해야 하는지를 기술한다.

## 시나리오 1: SchemaSnapshot 버전 정합성 ^overview

**전제**: `apm-schema-system`이 고정한 DSL 스키마 스냅샷이 파일시스템에 존재한다.

**동작**: `apm-codegen` CLI가 `--snapshot <path>` 인자로 스냅샷을 읽어 TypeScript 코드를 생성한다 (envelope protobuf는 생성하지 않는다 — `proto/transmission.proto`가 정본).

**기대**:
- 같은 스냅샷 입력 → 같은 contentHash 산출 (결정론적)
- 스냅샷 schemaVersion과 생성된 모듈의 `export const SCHEMA_VERSION`이 일치
- 누락된 axis를 참조한 composite는 codegen 단계에서 명시적 에러 발생 (`MissingAxisError`, exitCode 2)

**실패 시 수정 대상**: `apm-system.md` — snapshot 계약의 schemaVersion 필드 의미, 또는 `apm-schema-system`의 DSL validator가 codegen 전에 결손을 차단해야 함.

## 시나리오 2: 주소 컨텍스트 포맷 재사용 ^overview

**전제**: `apm-system`이 `address-context-format` / `address-context-storage`를 통해 EventRecord 주소 문자열 규칙을 정의한다.

**동작**: codegen이 SDK용 `encodeAddress(entities)` / `decodeAddress(string)` 헬퍼를 생성한다.

**기대**:
- 생성된 헬퍼의 출력 문자열이 `address-context-format`의 구분자/순서 규칙과 일치
- storage Zod 스키마 필드 이름이 codegen이 emit 하는 TypeScript 필드와 동일 (case, 복수형 포함)

**실패 시 수정 대상**: `apm-system`의 `address-context-*` 스펙이 형식/저장 규칙을 일관되게 유지해야 한다. 코드젠은 규칙을 소비만 하므로 형식 drift는 상위 스펙 문제.

## 시나리오 3: CLI 계약 실행 순서 ^overview

**전제**: `codegen-cli-contract`가 `load → validate → emit-ts → write` 순서를 규정한다.

**동작**: 중간 단계가 실패하면(`ValidationError`, `IOError`) 다음 단계는 실행되지 않는다.

**기대**:
- validate 실패 → exit code 2, write 스킵, 기존 산출물 불변
- ts 생성 실패 → exit code 3, partial write 금지 (atomic rename 사용)

**실패 시 수정 대상**: `apm-system`의 `cli-contract-spec`이 실행 순서와 exit code를 명시해야 한다. 순서 변경이 필요하면 apm-system 스펙을 먼저 갱신.

## 시나리오 4: Catalog 변경 감지 재생성 ^overview

**전제**: DEMO_CATALOG 또는 스냅샷의 axis 목록이 변경되었다.

**동작**: `apm-codegen --check` 모드는 현재 소스가 최신 스냅샷을 반영하는지 확인한다.

**기대**:
- 최신 상태 → exit 0
- 드리프트 존재 → exit 1 + drift summary (추가/제거된 axis 목록) 출력
- CI 파이프라인이 이 명령으로 코드 동기화를 게이팅할 수 있다

**실패 시 수정 대상**: `apm-system`이 catalog 파생 규칙(SSOT 원칙)을 고정해야 한다. 카탈로그 외부에서 axis를 주입하는 경로가 생기면 drift 감지가 무의미해진다.

## 검증 ^validation

```bash
corepack pnpm --filter @qa-sdk/cli test scenarios.e2e
corepack pnpm --filter codegen-core test
corepack pnpm --filter snapshot-io test
```
