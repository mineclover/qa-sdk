---
def:
  id: skill-spec-lifecycle-cases
  type: spec
  tier: component
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: experience
  family_id: docs/specs/skill-catalog/automation-skill-group/skill-spec-lifecycle
  tags: [documentation, tooling, scenario]
  links:
    - target: skill-spec-lifecycle
      type: refines
    - target: skill-spec-lifecycle-rule
      type: depends_on
    - target: docs-control-plane
      type: depends_on
sources:
  - packages/cli/src/commands/docs.ts
  - packages/cli/src/commands/docs.test.ts
  - packages/cli/src/commands/def.ts:cliDef
  - packages/cli/src/skills-workflows.test.ts
---

# Spec Lifecycle — 도구 선택 시나리오

## 목적 ^purpose

구현 완료 뒤 문서 전환을 검토하는 작업자가 단일 alias나 validator 결과에 의존하지 않고,
각 lifecycle 질문에 맞는 `docs`/`def` read model을 선택하도록 시나리오를 고정한다.

## BDD 계약 ^defines

```yaml bdd
bdd_contracts:
  - id: docs-control-plane.spec-lifecycle.inspect-family.v1
    owner_system: docs-control-plane
    contract_kind: query-projection
    mode: read
    given:
      predicates: [document.family_exists, document.role_metadata_parseable]
      fixtures: [docs-control-plane.fixture.skill-spec-lifecycle]
    when:
      operation: docs.status
    then:
      returns:
        document.lifecycle: present
        family.role_coverage: present
      invariants: [no_document_mutation, no_implicit_promotion]

  - id: docs-control-plane.spec-lifecycle.inspect-closure.v1
    owner_system: docs-control-plane
    contract_kind: query-projection
    mode: read
    given:
      predicates: [document.identifier_resolves, document.relationships_available]
      fixtures: [docs-control-plane.fixture.skill-spec-lifecycle]
    when:
      operation: docs.closure
    then:
      returns:
        closure.responsibility: present
        closure.evidence: present
        closure.missing: present
      invariants: [no_document_mutation, no_implicit_promotion]

  - id: docs-control-plane.spec-lifecycle.confirm-final-closure.v1
    owner_system: docs-control-plane
    contract_kind: query-projection
    mode: read
    given:
      predicates: [source_mapping_synchronized, required_source_test_evidence_present]
      fixtures: [docs-control-plane.fixture.skill-spec-lifecycle]
    when:
      operation: docs.closure
    then:
      returns:
        closure.missing: empty
        closure.diagnostics: empty
      invariants: [closure_rechecked_after_source_mapping, no_document_mutation]

  - id: docs-control-plane.spec-lifecycle.inspect-source-coverage.v1
    owner_system: docs-control-plane
    contract_kind: query-projection
    mode: read
    given:
      predicates: [source.scope_is_explicit, source.files_are_scannable]
      fixtures: [docs-control-plane.fixture.cli-source-scope]
    when:
      operation: def.code-link-gaps
    then:
      returns:
        source.coverage_rate: present
        source.unlinked_files: present
      invariants: [explicit_mapping_only, no_document_mutation]
```
