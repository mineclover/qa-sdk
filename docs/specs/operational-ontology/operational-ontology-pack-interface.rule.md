---
def:
  id: operational-ontology-pack-interface-rule
  level: leaf
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, contract, observability]
  links:
    - target: operational-ontology-pack-interface
      type: refines
    - target: operational-ontology-registry-activation-cli
      type: depends_on
    - target: programming-artifact-ontology-system
      type: depends_on
    - target: authorization-ontology-system
      type: depends_on
sources:
  - packages/cli/src/lib/ontology-pack-scaffold-plan.ts
  - packages/cli/src/lib/ontology-pack-scaffold-write.ts
  - packages/ontology-pack-validate/src/index.ts
---

# Operational Ontology Pack Interface — Authoring Rules

## 목적 ^purpose

`OperationalOntologyPack` 작성자가 scaffold preview, file write, source-map, known-pack registration, validation, activation을 섞지 않도록 반복 확인해야 하는 판별 기준을 정의한다. 목표는 새 pack authoring이 `operational-ontology-pack-interface` 계약을 따르고, 기존 `programming-artifact-ontology`와 `authorization-ontology` 예시처럼 검증 가능한 단위로 남게 하는 것이다.

## Pack Id Rules

- pack id는 safe kebab-case entity id여야 한다: lowercase alphanumeric segment를 `-`로 연결하고 첫 글자는 letter다.
- 공백, `_`, `.`, `/`, `@scope/name`, camelCase, PascalCase는 거부한다.
- pack id는 domain vocabulary를 가리켜야 하며 구현 package 이름이나 runtime service 이름을 대신하지 않는다.
- 새 도메인 pack은 특별한 이유가 없으면 `-ontology` suffix를 사용한다.
- 유효한 예시는 `programming-artifact-ontology`, `authorization-ontology`, `risk-model-ontology`다.

## Scaffold Decisions

- 기본 실행은 dry-run이다. `qa-sdk ontology pack scaffold <pack-id>`와 `--json` preview는 파일 시스템을 수정하지 않는다.
- 파일 생성은 `--write`가 있을 때만 허용한다.
- write mode는 preview의 planned file list만 materialize한다.
- write mode는 기존 파일을 overwrite하지 않는다.
- write mode는 known-pack resolver와 기존 definition frontmatter를 수정하지 않는다.
- scaffold는 pack을 activate하지 않는다. Activation은 항상 `qa-sdk ontology registry activate-pack <pack-id>`의 별도 lifecycle이다.
- scaffold-like command를 새로 만들 때도 dry-run이 기본이다. Dry-run은 write mode가 소비하는 plan/readiness/candidate shape를 그대로 보여주고, write mode는 명시적 `--write`와 안전한 output path 검증을 통과한 planned files만 만든다.

## Candidate Decisions

### Known-Pack Registration

- scaffold는 `packages/ontology-pack-validate/src/known-ontology-packs.ts` 수정안을 candidate로만 출력한다.
- candidate에는 `packId`, import path, export symbol name, registry entry가 포함되어야 한다.
- candidate의 `registrationMode`는 manual이고 `applyMode`는 candidate-only다.
- operator가 resolver를 직접 고친 뒤에야 known pack id validation과 activation command가 해당 pack을 찾을 수 있다.

### Source Map

- scaffold는 generated implementation/test path와 definition doc frontmatter를 연결하는 source-map candidate를 출력한다.
- candidate는 repo-relative normalized path여야 한다.
- source-map은 code comment가 아니라 definition doc top-level `sources:` frontmatter로 적용한다.
- source-map candidate는 write mode에서도 자동 적용하지 않는다.
- 적용 후에는 `qa-sdk def find-by-file <path>`와 `qa-sdk docs graph <doc-id> --axis source`로 확인한다.

## Authoring Philosophy

- Identity-like declarations are stable ids only: `packId`, `axis.id`, `taxonomy.id`, relation category id, traversal purpose, blueprint id, definition id.
- Component-like declarations are data-only vocabulary: axes, taxonomies, relation categories, traversals, registry/artifact records.
- System-like bindings own behavior: validators, blueprints, projectors, allocation helpers, activation helpers, sync adapters, docs graph traversal.
- Schema declarations must not hide I/O, registry mutation, activation behavior, or validation side effects.
- ECS is a useful reference model for separating identity, data, and systems. It is not the only supported architecture and it does not require ECS scheduling, archetypes, or SoA storage in a pack.
- The same separation is an implementation organization guideline for CLI modules. Identity modules own stable ids/symbols, data modules own read-model or schema declarations, and system modules own explicit parser, renderer, writer, validator, projector, loader, and readiness transformations.

## Validation Result Convention

- `valid` is the command gate. It is false only when at least one issue has error severity.
- `issues` is the flat, ordered diagnostic list for loader, runtime, file readiness, docs readiness, and source-map readiness findings.
- `runtime` summarizes `OperationalOntologyPack` contract validation separately from authoring preparedness.
- `readiness` summarizes implementation files, test files, docs family coverage, and source-map coverage.
- Warning-level readiness issues may leave `valid: true`; strict failure policy can be introduced later without changing the base result shape.

## Internal CLI Library Boundary

- `packages/cli/src/commands/ontology.ts` remains the ontology router and shared dependency handoff point.
- Focused command modules such as `packages/cli/src/commands/ontology/pack-authoring.ts` own argument handling, text/JSON printing, and exit-code policy for their command family.
- Reusable pack logic lives under `packages/cli/src/lib/ontology-pack-*`: scaffold plan/render/write modules and validate loader/runtime/file/docs readiness modules.
- These modules are internal CLI libraries for this refactor. No package-level public exports are required unless a later PRD promotes a stable API.

## Validate Workflow

1. Preview: `qa-sdk ontology pack scaffold <pack-id> --json`.
2. Write: `qa-sdk ontology pack scaffold <pack-id> --write` only after preview review.
3. Edit: replace placeholder vocabulary and blueprint/test refs with domain-specific content.
4. Test: run the generated test skeleton and relevant package tests.
5. Validate: run `qa-sdk ontology pack validate <pack-ref>`.
6. Register candidates manually only after validation passes.
7. Activate only after manual registration, source-map review, and validation are complete.

## Example Packs

| pack | what to copy | what not to copy blindly |
|------|--------------|--------------------------|
| `programming-artifact-ontology` | operational pack shape, artifact vocabulary, provider blueprint, activation evidence source/test refs | artifact-specific taxonomy names |
| `authorization-ontology` | cross-package pack export, known-pack resolver import, authorization graph/audit blueprint refs | Cerbos-specific realm vocabulary unless the new domain is authorization |
