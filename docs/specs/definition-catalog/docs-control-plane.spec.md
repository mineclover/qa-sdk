---
def:
  id: docs-control-plane
  type: design
  tier: system
  level: group
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: interface
  aspect: cli_contract
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: cli
  tags: [cross-scope, contract, testing]
  links:
    - target: definition-catalog-spec
      type: refines
    - target: cli-command-spec
      type: depends_on
    - target: doc-envelope
      type: refs
    - target: deterministic-label-architecture
      type: refs
    - target: ontology-pack-validate
      type: refs
    - target: docs-control-plane-interface
      type: contains
    - target: docs-control-plane-graph
      type: contains
    - target: docs-control-plane-bdd
      type: contains
    - target: docs-control-plane-cleanup
      type: contains
    - target: docs-control-plane-test
      type: contains
    - target: docs-control-plane-prd
      type: contains
    - target: docs-control-plane-transform
      type: contains
sources:
  - packages/cli/src/commands/docs.ts
  - packages/cli/src/lib/docs-control-plane/index.ts
---

# Docs Control Plane

## 목적 ^purpose

`qa-sdk docs`가 definition markdown, PRD markdown, ralph PRD JSON, ralph session, evidence registry를 하나의 neutral read model로 모아 보는 cross-document control plane임을 고정한다. 이 문서는 System boundary와 하위 책임 지도를 소유하고, 세부 command surface, graph traversal, BDD read model은 child spec이 소유한다.

## 구성 ^overview

- `docs-control-plane-interface`: `qa-sdk docs` command descriptor, dispatch, text/JSON command surface.
- `docs-control-plane-graph`: document graph traversal, ranking, filtering, summary, source/evidence/role axes.
- `docs-control-plane-bdd`: fenced `yaml bdd` extraction, BDD validation, `qa-sdk docs bdd` read-only commands.
- `docs-control-plane-cleanup`: completed-record cleanup review/plan/apply surface and bounded cleanup rewrite model.
- `docs-control-plane-prd`: PRD context/scaffold/ralph-json/sync-completion command family.
- `docs-control-plane-transform`: metadata transform dry-run preview surface.
- `doc-envelope`: neutral read model package consumed by this system.
- `docs-control-plane-rule`: operating/write-authority rules for consuming this system.
- `docs-control-plane-cases`: BDD behavior contracts and implementation/test unit mapping.
- `docs-control-plane-test`: E/C/I/S responsibility to test-file mapping.

## E/C/I/S + L/P Mapping ^defines

| 책임 | docs-control-plane 문서 | 구현 boundary |
|------|-------------------------|---------------|
| S | `docs-control-plane` | `packages/cli/src/commands/docs.ts` orchestration and command assembly |
| I | `docs-control-plane-interface` | `packages/cli/src/command-groups/docs.commands.ts`, command handlers in `docs.ts` |
| C | `doc-envelope`, role/follow-up/readiness metadata | `doc-envelope`, `packages/cli/src/lib/docs-control-plane/role-matrix.ts` |
| S behavior | `docs-control-plane-graph`, `docs-control-plane-bdd`, `docs-control-plane-cleanup`, `docs-control-plane-prd`, `docs-control-plane-transform` | graph modules, BDD extraction/CLI functions, cleanup review/plan/apply, PRD transforms, metadata transform preview |
| L/P | current docs family and `docs-control-plane-plan` | roadmap/organization only, no runtime ownership |

## SSOT 방향

Docs control plane은 source of truth가 아니다. Repository 파일과 기존 side store가 source of truth이고, control plane은 읽기/상관/미리보기만 담당한다.

```text
definition markdown      ┐
PRD markdown             │
ralph PRD JSON           ├─ read-only adapters
ralph session metadata   │
artifact evidence JSON   ┘
        ↓
DocumentEnvelope[]
        ↓
qa-sdk docs status / collect / search / graph / bdd / cleanup / prd / transform
```

Adapter는 source vocabulary를 소유하지 않는다. `kind`, `status`, relation `type`, diagnostic `severity`, PRD story fields, artifact relation fields 같은 값은 plain string metadata로 보존하고, control plane은 identity, path, family, default collection, command-level correlation만 정규화한다.

## 구현 경계

- `packages/cli/src/commands/docs.ts`는 CLI argument parsing, dispatch, output rendering, exit code policy를 조립한다.
- `packages/cli/src/lib/docs-control-plane/index.ts`는 docs-control-plane facade export boundary를 제공한다.
- Reusable read model, graph, BDD, PRD compatibility, role matrix, metadata transform logic은 `packages/cli/src/lib/docs-control-plane/**` 또는 focused internal library가 소유한다.
- Source-map and deterministic-label integration remain read-only projection until a separate persistence/write PRD exists.

## 소비 ^consumes

- `definition-catalog-spec` — definition markdown coordinates, frontmatter, contains/link rules.
- `cli-command-spec` — command descriptor, help, dispatch surface.
- `docs-control-plane-rule` — read/write authority and operating policy.
- `docs-control-plane-plan` / `docs-control-plane-todo` — roadmap and open implementation work.
- repository files — definition markdown, PRD markdown, ralph JSON, session metadata, artifact registry.

## 범위 밖

- REST API 또는 remote document service.
- database migration 또는 persistent docs control-plane store.
- adapter write path.
- automatic unreviewed TODO/spec promotion.
- PRD JSON을 core document model로 승격하는 작업.
