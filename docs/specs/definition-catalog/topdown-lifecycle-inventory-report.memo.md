---
def:
  id: topdown-lifecycle-inventory-report
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  type: knowledge
  knowledge_kind: guide
  scope: flow
  aspect: process_flow
  depth: validation
  lifecycle: draft
  layer: mediation
  svc: cli
  tags: [structural, roadmap, testing]
  links:
    - target: docs-control-plane-plan
      type: traces_to
    - target: docs-control-plane-todo
      type: traces_to
---

# Topdown Lifecycle Inventory Report

## 목적 ^purpose

future cleanup PRD를 안정된 출처에서 고르기 위해 topdown lifecycle pass의 우선 family별 role, TODO, completed-record, source-map gap 상태를 한 곳에 고정한다.

## 기준 ^overview

Inventory date: 2026-04-16.

Scope is the active topdown lifecycle pass from `docs-control-plane-plan`: `docs/specs/**` definition markdown plus active `tasks/**/prd-*` markdown/JSON, excluding `tasks/archive/**` and archived documents unless explicitly targeted.

The prioritized families are:

| priority | family | root id | reason |
|----------|--------|---------|--------|
| 1 | docs control plane | `docs-control-plane` | owns the CLI inventory workflow and next tooling PRDs |
| 2 | operational registry allocation | `operational-ontology-registry-allocation` | owns registry allocation lifecycle escalation boundaries |
| 3 | programming artifact ontology | `programming-artifact-ontology-system` | owns artifact provider and operationalization gaps |
| 4 | authorization ontology | `authorization-ontology-system` | owns active security hardening follow-ups |

## Role Matrix Summary

| family | present roles | same-family roles | linked context roles | missing roles | source refs | diagnostics |
|--------|---------------|-------------------|----------------------|---------------|-------------|-------------|
| `docs-control-plane` | `spec`, `plan`, `todo`, `knowledge` | `spec`, `plan`, `todo` | `spec`, `knowledge` | `rule`, `cases`, `test`, `memo`, `prd`, `ralph-prd-json` | 12 | 0 |
| `operational-ontology-registry-allocation` | `spec`, `plan`, `todo`, `knowledge` | `spec`, `plan`, `todo` | `spec`, `knowledge` | `rule`, `cases`, `test`, `memo`, `prd`, `ralph-prd-json` | 57 | 0 |
| `programming-artifact-ontology-system` | `spec`, `plan`, `todo`, `knowledge` | `spec` | `spec`, `plan`, `todo`, `knowledge` | `rule`, `cases`, `test`, `memo`, `prd`, `ralph-prd-json` | 15 | 0 |
| `authorization-ontology-system` | `spec`, `plan`, `todo`, `rule`, `knowledge` | `knowledge` | `spec`, `plan`, `todo`, `rule`, `knowledge` | `cases`, `test`, `memo`, `prd`, `ralph-prd-json` | 31 | 0 |

Same-family absence remains metadata. Do not create placeholder rule, cases, test, memo, PRD, or ralph PRD JSON files just to fill the matrix.

## Open TODO Counts

Counts come from `docs status <family> --json` `nextFollowUps[]` categories.

| family | actionable | deferred | parking lot | completed record candidates |
|--------|------------|----------|-------------|-----------------------------|
| `docs-control-plane` | 16 | 7 | 0 | 0 |
| `operational-ontology-registry-allocation` | 0 | 2 | 0 | 0 |
| `programming-artifact-ontology-system` | 0 | 6 | 0 | 0 |
| `authorization-ontology-system` | 17 | 0 | 0 | 0 |

## Source-Map Gap Count

| family | known source-map gap count | basis |
|--------|----------------------------|-------|
| `docs-control-plane` | 4 file-level gaps | `docs-control-plane.todo.md` lists `packages/cli/src/lib/docs-control-plane/index.ts`, `packages/cli/src/commands/ontology/ingest.ts`, `status.ts`, and `navigation-diff.ts`; `docs graph ...navigation-diff.ts --axis source --direction in --json` returns one bounded `source-map-missing` diagnostic. |
| `operational-ontology-registry-allocation` | 0 known in family status | 57 source refs and 0 diagnostics in `docs status`; no source-map-specific open row in this family. |
| `programming-artifact-ontology-system` | 0 known in family status | 15 source refs and 0 diagnostics in `docs status`; no source-map-specific open row in this family. |
| `authorization-ontology-system` | 0 known in family status | 31 source refs and 0 diagnostics in `docs status`; no source-map-specific open row in this family. |

## Completed Record Candidates

The four prioritized families each report `completedRecords: []`. Workspace status currently reports 19 completed-record candidates that should be reviewed for archive or memo conversion in a separate cleanup PRD:

| record | path | reason |
|--------|------|--------|
| Event Taxonomy Rollout TODO | `docs/specs/event-vocab-system/event-taxonomy-rollout.todo.md` | completed TODO checkboxes with no open checkboxes |
| RLSC text occupancy TODO | `docs/specs/rlsc/rlsc-text-occupancy.todo.md` | completed TODO checkboxes with no open checkboxes |
| Motion Editor Online Control Surface PRD | `tasks/motion-editor/prd-motion-editor-online-control.md` | paired PRD JSON has all stories passing |
| Motion Editor Scene Concurrent PRD | `tasks/motion-editor/prd-motion-editor-scene-concurrent.md` | paired PRD JSON has all stories passing |
| Docs Control Plane Adapters PRD | `tasks/prd-docs-control-plane-adapters.md` | paired PRD JSON has all stories passing |
| Document Coordinate Graph Traversal PRD | `tasks/prd-document-coordinate-graph-traversal.md` | paired PRD JSON has all stories passing |
| Document Source Map Coverage Expansion PRD | `tasks/prd-document-source-map-coverage-expansion.md` | paired PRD JSON has all stories passing |
| Motion Editor V2 UI PRD | `tasks/prd-motion-editor-v2-ui.md` | paired PRD JSON has all stories passing |
| Ontology CLI Docs Boundary Split PRD | `tasks/prd-ontology-cli-docs-boundary-split.md` | paired PRD JSON has all stories passing |
| Ontology Design Validation Stabilization PRD | `tasks/prd-ontology-design-validation-stabilization.md` | paired PRD JSON has all stories passing |
| Ontology Registry Activation CLI PRD | `tasks/prd-ontology-registry-activation-cli.md` | paired PRD JSON has all stories passing |
| Ontology Registry Activation Evidence Persistence PRD | `tasks/prd-ontology-registry-activation-evidence-persistence.md` | paired PRD JSON has all stories passing |
| Ontology Registry Activation Smoke PRD | `tasks/prd-ontology-registry-activation-smoke.md` | paired PRD JSON has all stories passing |
| Ontology Registry CLI Scenario Hardening PRD | `tasks/prd-ontology-registry-cli-scenario-hardening.md` | paired PRD JSON has all stories passing |
| Ontology Registry Index-Meta Sync PRD | `tasks/prd-ontology-registry-index-meta-sync.md` | paired PRD JSON has all stories passing |
| Ontology Registry Service Layer PRD | `tasks/prd-ontology-registry-service-layer.md` | paired PRD JSON has all stories passing |
| Ontology Registry Store Adapter PRD | `tasks/prd-ontology-registry-store-adapter.md` | paired PRD JSON has all stories passing |
| Operational Ontology Registry Persistence Schema PRD | `tasks/prd-operational-ontology-registry-persistence-schema.md` | paired PRD JSON has all stories passing |
| Spec Alignment PRD | `tasks/prd-spec-alignment.md` | paired PRD JSON has all stories passing |

## Recommended Next PRD Candidates

| priority | candidate | evidence | decision |
|----------|-----------|----------|----------|
| 1 | Authorization ontology hardening execution | 17 actionable rows, missing `cases`, `test`, `memo`, `prd`, `ralph-prd-json` | Create a focused PRD for the hardening groups before adding new authorization architecture. |
| 2 | Ontology pack authoring control plane | `docs-control-plane` actionable group after source-map expansion is completed | Create CLI/docs scaffold work only for concrete pack authoring surfaces. |
| 3 | Graph result ranking and filtering | `docs-control-plane` actionable group; graph traversal is broad enough to need ranking | Add role/kind/axis/diagnostic filters before more traversal depth. |
| 4 | PRD completion sync precision | remaining actionable rows after US-008: scoring, `--strict`, `--evidence-only`, blocked explanations | Keep as a separate PRD because candidate scoring can affect completion state. |
| 5 | Operational registry activation surface | 2 deferred rows: REST activation endpoint and remote activation service/deployment | Promote only after selecting a public/local execution surface. |
| 6 | Programming artifact operationalization boundary | 6 deferred rows across provider split, production persistence, remote quality provider, and allocation simulation | Promote only when the registry-service/index-meta boundary is opened. |
| 7 | Section-level graph nodes | 3 deferred rows under docs control plane | Defer until document-level ranking/filtering is stable. |

## Operational Verification - US-015

Verification date: 2026-04-17.

The commands below were run against a freshly built CLI bundle after `pnpm --filter @qa-sdk/cli build`.

| check | evidence | result |
|-------|----------|--------|
| CLI docs regressions | `pnpm --filter @qa-sdk/cli test -- docs` | Passed: 8 test files, 88 tests. |
| CLI typecheck | `pnpm --filter @qa-sdk/cli typecheck` | Passed. |
| CLI bundle | `pnpm --filter @qa-sdk/cli build` | Passed; `packages/cli/dist/index.js` rebuilt. |
| Definition sync/validate | `node packages/cli/dist/index.js def sync` then `node packages/cli/dist/index.js def validate` | Sync loaded 1040 documents and 2827 links; validate passed with 0 warnings. |
| `docs-control-plane` status | `node packages/cli/dist/index.js docs status docs-control-plane --json` | `nextFollowUps` returned 23 rows: 16 `actionable` and 7 `deferred`; actionable samples include `Ontology Pack Authoring Control Plane`, `pack scaffold command`, and `pack validate command`. |
| Registry allocation status | `node packages/cli/dist/index.js docs status operational-ontology-registry-allocation --json` | Returned exactly 2 deferred rows: `REST activation endpoint for registry-service` and `Remote activation service/deployment surface`. |
| Programming artifact status | `node packages/cli/dist/index.js docs status programming-artifact-ontology-system --json` | Returned 6 `deferred` rows and 0 `actionable` rows, so conditional open items remain non-actionable unless placed under an actionable heading. |
| Authorization status | `node packages/cli/dist/index.js docs status authorization-ontology-system --json` | Returned 17 `actionable` hardening rows; visible groups include policy source adapters, remediation workflow, audit gates, monitor/export surfaces, regression tests, masking, and graph export policy. |
| Coordinate graph drift | `node packages/cli/dist/index.js docs drift --prd tasks/prd-document-coordinate-graph-traversal.json --json` | `counts.total` was 0; JSON contained no `.ralph-tui` session paths. |
| Source map drift | `node packages/cli/dist/index.js docs drift --prd tasks/prd-document-source-map-coverage-expansion.json --json` | `counts.total` was 0; JSON contained no `.ralph-tui` session paths. |

## Reproduction Commands

```bash
pnpm --filter @qa-sdk/cli test -- docs
pnpm --filter @qa-sdk/cli typecheck
pnpm --filter @qa-sdk/cli build
node packages/cli/dist/index.js def sync
node packages/cli/dist/index.js def validate

node packages/cli/dist/index.js docs status docs-control-plane --json
node packages/cli/dist/index.js docs status operational-ontology-registry-allocation --json
node packages/cli/dist/index.js docs status programming-artifact-ontology-system --json
node packages/cli/dist/index.js docs status authorization-ontology-system --json
node packages/cli/dist/index.js docs status --json

node packages/cli/dist/index.js docs graph packages/cli/src/commands/ontology/navigation-diff.ts --axis source --direction in --json
node packages/cli/dist/index.js docs drift --prd tasks/prd-document-coordinate-graph-traversal.json --json
node packages/cli/dist/index.js docs drift --prd tasks/prd-document-source-map-coverage-expansion.json --json
```
