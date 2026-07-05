---
def:
  id: package-surface-separation-rule
  type: spec
  level: leaf
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [package, boundary, governance, structural]
  links:
    - target: system-packages
      type: constrains
    - target: design-usefulness-audit
      type: constrains
  sources:
    - scripts/package-surfaces.mjs
    - scripts/report-package-surfaces.mjs
    - scripts/analyze-package-usage.ts
    - scripts/design-usefulness-audit.mjs
    - scripts/verify-analysis-os.ts
    - docs/specs/system/system-packages.spec.md
---

# Package Surface Separation Rule

## 목적 ^purpose

qa-sdk를 하나의 거대한 제품 플랫폼으로 계속 확장하지 않고, 증거가 있는 기능 surface별로 분리해 유지·승격·격리 기준을 고정한다.

## 분리 원칙 ^overview

- 새 기능은 먼저 하나의 surface에 배정한다.
- surface는 반드시 하나의 기능군에 속한다. 기능군은 실제 capability인지, governance/tooling인지, consumer/support인지, quarantine인지 구분한다.
- surface를 넘는 연결은 runtime dependency가 아니라 adapter, fixture, smoke script, 또는 CLI 계약으로 시작한다.
- package-local test만 있는 패키지는 제품 surface로 승격하지 않는다.
- 제품 surface 승격에는 실제 소비자 또는 repo-level bridge smoke가 필요하다.
- reverse dependency가 0인 패키지는 `zeroFanIn`으로 먼저 분류하고, consumer smoke나 독립 실행 계약도 없을 때만 dead weight 후보로 둔다.

## 기능군

| 기능군 | 의미 |
|--------|------|
| `runtime core` | 좌표 인코딩과 observability runtime처럼 production flow가 직접 의존할 수 있는 기반 |
| `definition governance` | definition, decision, spec, architecture governance처럼 작업/문서/검증을 통제하는 표면 |
| `taxonomy capability` | 유한 vocabulary tooling, taxonomy adapter, taxonomy-only preview consumer |
| `profile capability` | profile contract tooling, evidence ledger adapter, measurement, profile-only preview consumer |
| `domain support` | 권한 보조, authoring, simulation, visual analysis처럼 특정 도메인을 지원하는 표면 |
| `consumer verification` | demo, smoke, test suite처럼 상위 capability를 소비해 증명하는 표면 |
| `quarantine` | package-local 증거는 있으나 제품 surface로 승격하지 않는 격리 큐 |

## Surface 분류

| Surface | 기능군 | 판정 | 대표 패키지/그룹 | 승격 기준 |
|---------|--------|------|-------------|-----------|
| Coordinate kernel | runtime core | keep | weighted/index/address/search packages | 다수 내부 소비자, package tests, `arch:usage` fan-in 근거 |
| Observability runtime | runtime core | maintain | core/sdk/browser/ingest/registry/store/logging/codec services | ingest/registry/runtime smoke 또는 서비스별 quality gate |
| Definition control plane | definition governance | keep | definition catalog/service/client/data-source/doc envelope/readiness tools | `def validate`, definition quality gates, docs graph 정합성 |
| Taxonomy tooling | taxonomy capability | keep as tooling | `taxonomy-engine` | finite vocabulary parse/validate/diff/codegen tests |
| Taxonomy decision bridge | taxonomy capability | keep as bridge | `taxonomy-decision-bridge` | taxonomy/decision-flow round-trip tests |
| Taxonomy preview surfaces | taxonomy capability | consumer only | `@qa-sdk/taxonomy-web` | taxonomy-web build/test; no vocabulary ownership |
| Profile contract tooling | profile capability | keep as contract tool | `data-structure-profile` | profile parser/validator/compiler tests + fixture snapshots |
| Quality evidence ledgers | profile capability | maintain | `quality-ledger`, `review-ledger` | persistence tests and adapter smoke from producer reports |
| Measurement tooling | profile capability | keep as tooling | `@qa-sdk/bench` | benchmark CLI/tests and report rendering evidence |
| Profile preview surfaces | profile capability | consumer only | `@qa-sdk/viz-web` | viz-web build/test from lineage/graph artifacts; no profile ownership |
| Decision recording | definition governance | conditional keep | decision-flow, DKG, ontology/work-domain decision packages | decision-flow tests, CLI/service use, quality bundle evidence |
| Spec analysis kernel | definition governance | keep | spec-core/schema/transition/tracker/analyzer/codegen/demo snapshot packages | spec package tests, propagation/convergence/codegen evidence |
| Infra governance tooling | definition governance | maintain | CLI, archi, scaffolding, service kit, config/db/git/infra helpers | arch feedback, package-local tests, generated contract checks |
| Authorization support | domain support | maintain | audit recorder and resource policy stores | authorization ontology smoke, persistence tests |
| Motion authoring | domain support | conditional keep | motion content/workspace/client/service | consumer build/test or service smoke before promotion |
| Simulation contracts | domain support | consumer contract | sim-* DTO, catalog, network, and simulation test packages | producer/consumer drift tests |
| Visual analysis tools | domain support | consumer tooling | canvas/viz/visbug/layout analysis packages | visual consumer tests/builds |
| Verification suites | consumer verification | test only | test types, demo/e2e/facet/scenario test packages | test harness execution |
| Product demo surfaces | consumer verification | consumer only | demo/web/smoke UI and API consumers | 소비자 앱 build/test, 상위 surface 소유권 침범 금지 |
| Quarantine candidates | quarantine | no promotion | `request-contract`, `weighted-gpu` | 실제 consumer 또는 bridge smoke가 생길 때까지 제품 축으로 언급하지 않음 |

## 경계 규칙

1. `Coordinate kernel`은 수학/주소 인코딩을 소유한다. 제품 workflow, prompt 계약, profile measurement를 직접 소유하지 않는다.
2. `Taxonomy tooling`은 유한 vocabulary와 ref/diff/validation/codegen을 소유한다. decision-flow 변환, web preview, concrete profile measurement, data lineage는 소유하지 않는다.
3. `Taxonomy decision bridge`는 taxonomy와 decision-flow 사이의 변환 계약만 소유한다. taxonomy vocabulary SSOT가 되지 않고 web preview 상태도 소유하지 않는다.
4. `Taxonomy preview surfaces`는 taxonomy artifact를 읽어 보여주는 consumer다. engine API나 vocabulary entry를 직접 소유하지 않는다.
5. `Profile contract tooling`은 profile YAML, validation report, lineage artifact, measurement dry-run, adapter payload를 소유한다. `quality-ledger`, `@qa-sdk/bench`, `viz-web`를 runtime dependency로 끌어들이지 않는다.
6. `Quality evidence ledgers`는 gate/review 실행 결과의 영속 기록을 소유한다. `dsp-*` 진단 의미나 row multiplier 계산을 소유하지 않는다.
7. `Measurement tooling`은 측정 실행과 리포트 표면을 소유한다. profile source-path parsing이나 transform semantics를 소유하지 않는다.
8. `Profile preview surfaces`는 lineage/graph artifact를 읽는 consumer다. profile schema나 ledger 결과를 쓰기 표면으로 승격하지 않는다.
9. `Decision recording`은 판단 과정과 증거의 "왜"를 기록한다. taxonomy나 profile의 vocabulary source of truth가 되지 않는다.
10. `Spec analysis kernel`은 spec/codegen/transition/convergence evidence를 소유한다. runtime service ownership으로 승격하지 않는다.
11. `Product demo surfaces`, `Visual analysis tools`, `Verification suites`는 consumer surface다. 상위 surface의 ownership을 가져오지 않는다.
12. `Quarantine candidates`는 package-local build/test를 유지할 수 있지만 README, roadmap, quality gate에서 제품 core처럼 홍보하지 않는다.
13. 모든 `packages/*/package.json` 항목은 정확히 하나의 surface에 배정되어야 한다.
14. `simulations/*`와 `vendor/*` workspace package는 support workspace로 감사할 수 있지만, package surface manifest에는 포함하지 않는다. 이름 끝부분이 `packages/*` package와 같아도 surface를 상속하지 않는다.

## 사용성 신호 처리

`pnpm arch:usage`는 `packages/*` surface-managed 패키지를 대상으로 `zeroFanIn`, `archiveCandidates`, `Dead Weight`, `missingEntrypoints`, `entrypointGaps`를 분리한다. `zeroFanIn`은 독립 앱·계약·툴·라이브러리일 수 있다는 사실 신호이고, `archiveCandidates`는 이미 `no-promotion` surface로 분리된 quarantine 결정 큐다. `Dead Weight`는 유지 근거가 아직 없는 evidence 보강 큐다. `missingEntrypoints`는 conventional `src/index.ts`류 entrypoint가 없다는 형태 신호이고, `entrypointGaps`만 public/library surface 검토 후보로 다룬다.

| 신호 | 처리 |
|------|------|
| `verdict: keep` 또는 `maintain` + `zeroFanIn` | public entrypoint, CLI, service endpoint, external consumer smoke 중 하나로 독립 boundary 근거를 확인한다. |
| `archiveCandidates` | 이미 `no-promotion`으로 격리된 후보를 제품 core로 승격하지 않고 archive/quarantine 결정 큐에 둔다. |
| `deadWeight` | `needs-evidence` 상태다. 유지 근거를 추가하거나 package boundary를 재판정한다. |
| `missingEntrypoints` + `runtime-service`, `browser-app`, `test-or-contract-suite`, `wasm-package` | 앱·서비스·테스트·wasm 패키지는 `src/index.ts`가 없을 수 있다. build/test/script surface가 있으면 형태 신호로만 기록한다. |
| `entrypointGaps` | public/library 패키지인데 conventional entrypoint 근거가 약한 상태다. entrypoint를 추가하거나 package boundary를 재판정한다. |
| `verdict: conditional-keep` + dead/entrypoint gap | 실제 소비자, bridge smoke, 또는 quality gate가 없으면 promotion 금지 상태로 둔다. |
| `verdict: no-promotion` | package-local test는 허용하지만 제품 core 문서, roadmap, quality bundle에는 승격하지 않는다. |

정리 작업은 `arch:surfaces`로 `packages/*` surface-managed 배정이 깨지지 않는지 먼저 확인하고, `arch:usage`로 surface별 zero-fan-in/archive/dead/missing-entrypoint/entrypoint-gap 잔여를 확인한 뒤 진행한다.

정확한 `packages/*` surface-managed 패키지 배정의 SSOT는 `scripts/package-surfaces.mjs`다. 위 표는 리뷰 가능한 surface 이름, 기능군, 판정, 대표 패키지/그룹, 승격 기준을 요약한다. `packages/*` package coverage와 누락/중복은 `corepack pnpm arch:surfaces`와 `corepack pnpm arch:verify`가 manifest 기준으로 증명한다. `simulations/*`와 `vendor/*`는 workspace-support로 usefulness audit에 남길 수 있으나, 기능 surface 승격 또는 quarantine 후보로 계산하지 않는다.

`design-usefulness-audit`는 이 규칙을 소비해 package 후보의 `surfaceGroup`, `surfaceVerdict`, `surfaceScope`를 계산한다. 이 문서가 새 surface를 추가하면 `scripts/package-surfaces.mjs`와 `system-packages` 표를 먼저 맞추고, `arch:verify`가 rule table과 manifest drift를 잡도록 둔다.

## 검증 명령

```bash
corepack pnpm arch:surfaces
corepack pnpm arch:usage
corepack pnpm --silent arch:usage -- --json
corepack pnpm arch:verify
corepack pnpm arch:feedback
```

`corepack pnpm arch:surfaces`는 이 문서의 핵심 분류를 스크립트 surface manifest와 맞춘다. 없는 패키지, 중복 배정, 또는 surface 없는 `packages/*` package가 있으면 실패한다. `corepack pnpm arch:verify`는 taxonomy/profile 관련 surface가 다시 한 덩어리로 합쳐지지 않았는지와 이 문서 및 `system-packages`의 surface 표가 manifest와 같은 목록/기능군/판정을 말하는지도 고정한다.
