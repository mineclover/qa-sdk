---
def:
  id: data-structure-profile-system
  type: spec
  tier: system
  level: module
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: data-structure-profile
  tags: [taxonomy, data-structure, profile, lineage, measurement]
  links:
    - target: data-structure-profile-taxonomy
      type: contains
    - target: data-structure-profile-profile-contract
      type: contains
    - target: data-structure-profile-validation
      type: refs
    - target: data-structure-profile-cli
      type: contains
    - target: data-structure-profile-system-test
      type: refs
    - target: data-structure-profile-operations-rule
      type: refs
    - target: data-structure-profile-readme
      type: refs
sources:
  - packages/data-structure-profile/package.json
  - packages/data-structure-profile/src/index.ts
---

# Data Structure Profile System

## 목적 ^purpose

Data Structure Profile은 taxonomy-backed data structure judgment contract를 구현한다. 이 시스템은 reusable vocabulary를 concrete profile YAML과 연결하고, validation report, lineage artifact, measurement dry-run, optional DPM readiness report, adapter payload를 결정적으로 산출한다.

## 책임 경계 ^overview

- `data-structure-profile-taxonomy`는 재사용 가능한 닫힌 vocabulary와 relation grammar를 소유한다.
- `data-structure-profile-profile-contract`는 profile input과 derived artifact shape를 소유한다.
- `data-structure-profile-validation`은 stable `dsp-*` diagnostics, quality gate 판정, DPM readiness warning/error 연결을 소유한다.
- `data-structure-profile-cli`는 package-local fixture runner command surface를 소유한다.
- `data-structure-profile-system-test`는 fixture parity, CLI output, bridge smoke, viz preview 변환 검증 범위를 소유한다.
- `data-structure-profile-operations-rule`은 profile isolation을 유지하는 운영 절차와 정합성 점검 명령을 소유한다.

## 확정된 public surface ^defines

현재 approved baseline은 package entrypoint에서 다음 기능을 export한다.

- profile YAML parsing: `parseProfile`
- taxonomy draft lookup: `parseProfileTaxonomy`
- profile validation: `validateProfile`
- lineage artifact compilation: `compileLineage`
- measurement dry-run: `measureProfile`
- optional privacy readiness: `assessDpmReadiness`
- consumer bridge payload conversion: `toQualityLedgerRunInputs`, `toBenchReportInput`
- fixture runner CLI hook: `runDataStructureProfileCli`

## 명시적 비소유 범위 ^constraint

- Kafka consumer, ClickHouse migration generator, production token vault, generic ETL scheduler는 이 시스템의 현재 책임이 아니다.
- `quality-ledger`, `@qa-sdk/bench`, `viz-web`, `oa-sdk DPM`은 runtime dependency가 아니라 adapter target 또는 reference surface다.
- profile-specific lineage edge vocabulary such as `emits`, `input`, `feeds`, and `produces`는 compiled artifact vocabulary이며 taxonomy relation kind로 승격하지 않는다.
- DPM policy execution은 외부 policy reference로 남기고, profile package 안에서 token/vault policy를 재정의하지 않는다.

## 관련 소스

- `packages/data-structure-profile/package.json` — package name, bin, export, dependency boundary
- `packages/data-structure-profile/src/index.ts` — public API export surface
