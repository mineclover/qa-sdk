---
def:
  id: package-surface-separation-rule
  type: spec
  level: leaf
  scope: constraint
  aspect: package-boundary
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [package, boundary, governance, structural]
  links:
    - target: system-packages
      type: constrains
---

# Package Surface Separation Rule

## 목적 ^purpose

qa-sdk를 하나의 거대한 제품 플랫폼으로 계속 확장하지 않고, 증거가 있는 기능 surface별로 분리해 유지·승격·격리 기준을 고정한다.

## 분리 원칙 ^overview

- 새 기능은 먼저 하나의 surface에 배정한다.
- surface를 넘는 연결은 runtime dependency가 아니라 adapter, fixture, smoke script, 또는 CLI 계약으로 시작한다.
- package-local test만 있는 패키지는 제품 surface로 승격하지 않는다.
- 제품 surface 승격에는 실제 소비자 또는 repo-level bridge smoke가 필요하다.
- reverse dependency가 0이고 consumer smoke도 없는 패키지는 quarantine 후보로 둔다.

## Surface 분류

| Surface | 판정 | 포함 패키지 | 승격 기준 |
|---------|------|-------------|-----------|
| Coordinate kernel | keep | `weighted-index`, `bit-index`, `index-meta`, `permission-engine`, `address-index` | 다수 내부 소비자, package tests, `arch:usage` fan-in 근거 |
| Observability runtime | maintain | `@qa-sdk/core`, `@qa-sdk/sdk`, `@qa-sdk/browser`, `@qa-sdk/ingest-server`, `@qa-sdk/registry-service`, `@qa-sdk/store`, `@qa-sdk/event-catalog`, `@qa-sdk/logger`, `@qa-sdk/pino`, `@qa-sdk/codec`, `@qa-sdk/browser-codec`, `@qa-sdk/codec-proto` | ingest/registry/runtime smoke 또는 서비스별 quality gate |
| Definition control plane | keep | `definition-catalog`, `@qa-sdk/definition-service`, `@qa-sdk/definition-client`, `definition-data-source`, `doc-envelope`, `ontology-pack-validate` | `def validate`, definition quality gates, docs graph 정합성 |
| Taxonomy tooling | keep as tooling | `taxonomy-engine`, `taxonomy-decision-bridge`, `@qa-sdk/taxonomy-web` | `tax:ci`, taxonomy fixture validation, taxonomy-web build/test |
| Profile contract tooling | keep as contract tool | `data-structure-profile`, `quality-ledger`, `@qa-sdk/bench`, `@qa-sdk/viz-web` | package tests + bridge smoke against real consumer surfaces |
| Decision recording | conditional keep | `decision-flow`, `decision-flow-store`, `@qa-sdk/decision-service`, `dkg` | decision-flow tests, CLI/service use, quality bundle evidence |
| Product demo surfaces | consumer only | `@qa-sdk/platform-demo`, `@qa-sdk/shop-web`, `@qa-sdk/roleplay-web`, `@qa-sdk/viteplus-sdk-smoke`, `weighted-index-explorer`, `@qa-sdk/operational-ontology-web`, `@qa-sdk/registry-ui` | 소비자 앱 build/test, 상위 surface 소유권 침범 금지 |
| Quarantine candidates | no promotion | `request-contract`, `weighted-gpu` | 실제 consumer 또는 bridge smoke가 생길 때까지 제품 축으로 언급하지 않음 |

## 경계 규칙

1. `Coordinate kernel`은 수학/주소 인코딩을 소유한다. 제품 workflow, prompt 계약, profile measurement를 직접 소유하지 않는다.
2. `Taxonomy tooling`은 유한 vocabulary와 ref/diff/validation/codegen을 소유한다. concrete profile measurement나 data lineage는 소유하지 않는다.
3. `Profile contract tooling`은 profile YAML, validation report, lineage artifact, measurement dry-run, adapter payload를 소유한다. `quality-ledger`, `@qa-sdk/bench`, `viz-web`는 adapter target 또는 consumer로만 둔다.
4. `Decision recording`은 판단 과정과 증거의 "왜"를 기록한다. taxonomy나 profile의 vocabulary source of truth가 되지 않는다.
5. `Quarantine candidates`는 package-local build/test를 유지할 수 있지만 README, roadmap, quality gate에서 제품 core처럼 홍보하지 않는다.

## 검증 명령

```bash
pnpm arch:surfaces
pnpm arch:usage
pnpm arch:feedback
```

`pnpm arch:surfaces`는 이 문서의 핵심 분류를 스크립트 surface manifest와 맞춰, 없는 패키지나 중복 배정을 실패로 보고한다.
