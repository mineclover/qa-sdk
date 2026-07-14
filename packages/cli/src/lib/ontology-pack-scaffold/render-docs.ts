// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import type {
  OntologyPackScaffoldComponentLikeDeclaration,
  OntologyPackScaffoldIdentity,
  OntologyPackScaffoldSystemLikeBinding,
} from '../ontology-pack-scaffold-plan.js';

export function renderSpecDoc(
  identity: OntologyPackScaffoldIdentity,
  componentLikeDeclarations: readonly OntologyPackScaffoldComponentLikeDeclaration[],
  systemLikeBindings: readonly OntologyPackScaffoldSystemLikeBinding[],
  sources: readonly string[],
  testPath: string,
): string {
  const displayName = toDisplayName(identity);
  return `---
def:
  id: ${identity.definitionId}
  level: leaf
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [structural, contract]
  links:
    - target: operational-ontology-pack-interface
      type: refines
${renderSourcesYaml(sources)}
---

# ${displayName} — Operational Ontology Pack

## 목적 ^purpose

${identity.packId} pack의 identity, component-like schema vocabulary, system-like binding을 같은 authoring family에서 추적한다. 이 문서는 pack scaffold 이후 도메인별 온톨로지 의미와 검증 경계를 채우기 위한 시작점이다.

## 구성 ^overview

- Pack id: \`${identity.packId}\`
- Implementation package: \`${identity.package.implementationPackage}\`
- Component schema: \`${identity.package.sourceDir}/${identity.safePackId}-schema.ts\`
- System binding: \`${identity.package.sourceDir}/${identity.safePackId}-pack.ts\`
- Test candidate: \`${testPath}\`

## Architecture-Neutral Separation

Operational ontology pack authoring is architecture-neutral. ECS is one possible modeled architecture, but it is not the only supported architecture. Runtime architecture labels belong to the pack domain and are not emitted by default; this scaffold only uses the identity/component schema/system binding separation discipline.

### Identity declarations

Identity declarations are stable names only; they do not own schema records or runtime behavior.

${identity.declarations.map((declaration) => `- \`${declaration.symbolName}\` = \`${declaration.value}\` (${declaration.kind})`).join('\n')}

### Component schema

Source: \`${identity.package.sourceDir}/${identity.safePackId}-schema.ts\`

${componentLikeDeclarations.map((declaration) => `- \`${declaration.symbolName}\` = \`${declaration.value}\` (${declaration.kind})`).join('\n')}

### System bindings

Source: \`${identity.package.sourceDir}/${identity.safePackId}-pack.ts\`

${systemLikeBindings.map((binding) => `- \`${binding.symbolName}\` (${binding.kind}): ${binding.description}`).join('\n')}

## Source References

${sources.map((source) => `- \`${source}\``).join('\n')}

## 검증 참조

- Test skeleton: \`${testPath}\`
- Known-pack registration remains a manual candidate for \`packages/cli/src/lib/known-ontology-packs.ts\`.
`;
}

export function renderTodoDoc(identity: OntologyPackScaffoldIdentity): string {
  const displayName = toDisplayName(identity);
  return `---
def:
  id: ${identity.safePackId}-todo
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, testing, contract]
  links:
    - target: ${identity.definitionId}
      type: refines
---

# ${displayName} — Pack Authoring TODO

## 목적 ^purpose

${identity.packId} pack scaffold 이후 실제 도메인 vocabulary, tests, docs, source-map, known-pack registration을 닫기 위한 작업을 추적한다.

## Actionable — 실행 가능

- [ ] Replace the example axis value with domain vocabulary.
- [ ] Fill taxonomy, relation category, and traversal declarations.
- [ ] Validate the pack skeleton with \`${identity.symbols.validateFunctionName}()\`.
- [ ] Add domain-specific test expectations.
- [ ] Apply source-map frontmatter after files are written.
- [ ] Review the known-pack registration candidate before editing the resolver manually.

## Completed — 완료 기록

No completed work recorded yet.

## Deferred — 조건부 대기

- [ ] Registry activation remains separate from scaffold output.

## Parking Lot — 후보 보관

- [ ] Add optional rule/cases/test docs when the pack has concrete consumer rules or scenarios.
`;
}

export function renderPlanDoc(identity: OntologyPackScaffoldIdentity): string {
  const displayName = toDisplayName(identity);
  return `---
def:
  id: ${identity.safePackId}-plan
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, contract]
  links:
    - target: ${identity.definitionId}
      type: refines
    - target: operational-ontology-pack-interface
      type: depends_on
---

# ${displayName} — Pack Authoring Plan

## 목적 ^purpose

${identity.packId} pack을 scaffold 후보에서 검증 가능한 operational ontology pack으로 승격하는 순서를 기록한다.

## 단계

1. Keep identity constants stable before expanding schema content.
2. Replace placeholder component-like declarations with finite, decision-relevant domain vocabulary.
3. Add system-like blueprint bindings only after schema declarations are explicit.
4. Run the generated test skeleton and pack validation.
5. Add source-map frontmatter and known-pack resolver edits manually after review.
6. Activate through \`qa-sdk ontology registry activate-pack\` only after scaffold output is written and validated.
`;
}

export function renderRuleDoc(identity: OntologyPackScaffoldIdentity): string {
  const displayName = toDisplayName(identity);
  return `---
def:
  id: ${identity.safePackId}-rule
  level: leaf
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: draft
  layer: operation
  tags: [structural, contract]
  links:
    - target: ${identity.definitionId}
      type: refines
---

# ${displayName} — Pack Authoring Rules

## 목적 ^purpose

${identity.packId} pack을 소비하거나 확장할 때 반복 확인해야 하는 authoring rule 후보를 기록한다.

## 규칙 후보

- Identity declarations stay stable and data-free.
- Component-like schema declarations remain data-only.
- System-like bindings own validation, blueprint refs, and runtime integration.
- Known-pack registration is manual until explicitly reviewed.
`;
}

export function renderCasesDoc(identity: OntologyPackScaffoldIdentity): string {
  const displayName = toDisplayName(identity);
  return `---
def:
  id: ${identity.safePackId}-cases
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: draft
  layer: operation
  tags: [structural, scenario, contract]
  links:
    - target: ${identity.definitionId}
      type: refines
---

# ${displayName} — Pack Authoring Cases

## 목적 ^purpose

${identity.packId} pack을 작성, 검증, 등록 후보로 검토하는 사용 시나리오를 기록한다.

## UC-001: Pack author previews scaffold output

### 상황

Pack author runs \`qa-sdk ontology pack scaffold ${identity.packId} --json\`.

### 기대 결과

Preview separates identity declarations, component-like schema declarations, system-like bindings, generated docs, source-map candidates, and known-pack registration candidates without writing files.
`;
}

export function renderTestDoc(identity: OntologyPackScaffoldIdentity, testPath: string): string {
  const displayName = toDisplayName(identity);
  return `---
def:
  id: ${identity.safePackId}-test
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: draft
  layer: operation
  tags: [structural, testing, contract]
  links:
    - target: ${identity.definitionId}
      type: refines
${renderSourcesYaml([testPath])}
---

# ${displayName} — Pack Validation Tests

## 목적 ^purpose

${identity.packId} pack의 generated test skeleton과 추가할 domain-specific 검증 항목을 매핑한다.

## 검증 매핑

- \`${testPath}\` verifies \`${identity.symbols.validateFunctionName}()\`.
- Add domain-specific axis, taxonomy, relation, traversal, and blueprint expectations before activation.
`;
}

function renderSourcesYaml(sources: readonly string[]): string {
  return ['sources:', ...sources.map((source) => `  - ${source}`)].join('\n');
}

function toDisplayName(identity: OntologyPackScaffoldIdentity): string {
  return identity.safePackId.split('-').filter(Boolean).map(capitalize).join(' ');
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
