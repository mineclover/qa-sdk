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
| Coordinate kernel | keep | weighted/index/address/search packages | 다수 내부 소비자, package tests, `arch:usage` fan-in 근거 |
| Observability runtime | maintain | core/sdk/browser/ingest/registry/store/logging/codec services | ingest/registry/runtime smoke 또는 서비스별 quality gate |
| Definition control plane | keep | definition catalog/service/client/data-source/doc envelope/readiness tools | `def validate`, definition quality gates, docs graph 정합성 |
| Taxonomy tooling | keep as tooling | `taxonomy-engine`, `taxonomy-decision-bridge`, `@qa-sdk/taxonomy-web` | `tax:ci`, taxonomy fixture validation, taxonomy-web build/test |
| Profile contract tooling | keep as contract tool | data-structure profile, quality ledger, review ledger, bench, viz-web | package tests + bridge smoke against real consumer surfaces |
| Decision recording | conditional keep | decision-flow, DKG, ontology/work-domain decision packages | decision-flow tests, CLI/service use, quality bundle evidence |
| Spec analysis kernel | keep | spec-core/schema/transition/tracker/analyzer/codegen/demo snapshot packages | spec package tests, propagation/convergence/codegen evidence |
| Infra governance tooling | maintain | CLI, archi, scaffolding, service kit, config/db/git/infra helpers | arch feedback, package-local tests, generated contract checks |
| Authorization support | maintain | audit recorder and resource policy stores | authorization ontology smoke, persistence tests |
| Motion authoring | conditional keep | motion content/workspace/client/service | consumer build/test or service smoke before promotion |
| Simulation contracts | consumer contract | sim-* DTO, catalog, network, and simulation test packages | producer/consumer drift tests |
| Visual analysis tools | consumer tooling | canvas/viz/visbug/layout analysis packages | visual consumer tests/builds |
| Verification suites | test only | test types, demo/e2e/facet/scenario test packages | test harness execution |
| Product demo surfaces | consumer only | demo/web/smoke UI and API consumers | 소비자 앱 build/test, 상위 surface 소유권 침범 금지 |
| Quarantine candidates | no promotion | `request-contract`, `weighted-gpu` | 실제 consumer 또는 bridge smoke가 생길 때까지 제품 축으로 언급하지 않음 |

## 경계 규칙

1. `Coordinate kernel`은 수학/주소 인코딩을 소유한다. 제품 workflow, prompt 계약, profile measurement를 직접 소유하지 않는다.
2. `Taxonomy tooling`은 유한 vocabulary와 ref/diff/validation/codegen을 소유한다. concrete profile measurement나 data lineage는 소유하지 않는다.
3. `Profile contract tooling`은 profile YAML, validation report, lineage artifact, measurement dry-run, adapter payload를 소유한다. `quality-ledger`, `@qa-sdk/bench`, `viz-web`는 adapter target 또는 consumer로만 둔다.
4. `Decision recording`은 판단 과정과 증거의 "왜"를 기록한다. taxonomy나 profile의 vocabulary source of truth가 되지 않는다.
5. `Spec analysis kernel`은 spec/codegen/transition/convergence evidence를 소유한다. runtime service ownership으로 승격하지 않는다.
6. `Product demo surfaces`, `Visual analysis tools`, `Verification suites`는 consumer surface다. 상위 surface의 ownership을 가져오지 않는다.
7. `Quarantine candidates`는 package-local build/test를 유지할 수 있지만 README, roadmap, quality gate에서 제품 core처럼 홍보하지 않는다.
8. 모든 `packages/*/package.json` 항목은 정확히 하나의 surface에 배정되어야 한다.

## 검증 명령

```bash
pnpm arch:surfaces
pnpm arch:usage
pnpm arch:feedback
```

`pnpm arch:surfaces`는 이 문서의 핵심 분류를 스크립트 surface manifest와 맞춘다. 없는 패키지, 중복 배정, 또는 surface 없는 workspace package가 있으면 실패한다.
