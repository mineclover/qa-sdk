---
def:
  id: docs-control-plane-cases
  type: design
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: cli
  tags: [testing, contract]
  links:
    - target: docs-control-plane
      type: traces_to
    - target: docs-control-plane-bdd
      type: depends_on
---

# Docs Control Plane — BDD Contract Cases

## 목적 ^purpose

`qa-sdk docs` control plane의 BDD 기계화 동작을 Given/When/Then 계약으로 고정한다. 이 문서는 `.cases.md` / `.test.md`에서 BDD block을 읽어 `DocumentEnvelope.metadata.bdd`로 투영하고, `qa-sdk docs bdd` CLI가 같은 contract id로 test unit과 implementation unit을 연결한다는 기대를 정의한다.

## BDD 계약 ^overview

```yaml bdd
bdd_contracts:
  - id: docs-control-plane.bdd.parse.valid-block.v1
    owner_system: docs-control-plane
    contract_kind: query-projection
    mode: read
    given:
      predicates: [definition-markdown.document_kind.is_cases, bdd.block.valid]
      fixtures: [docs-control-plane.fixture.valid-bdd-cases]
    when:
      operation: definition-markdown.listDocuments
    then:
      returns:
        metadata.bdd.contracts: present
        metadata.bdd.testUnits: present
        metadata.bdd.implementationUnits: present
      invariants: [document.not_dropped]

  - id: docs-control-plane.bdd.parse.invalid-block-diagnostic.v1
    owner_system: docs-control-plane
    contract_kind: validation-failure
    mode: read
    given:
      predicates: [definition-markdown.document_kind.is_cases, bdd.block.invalid_schema]
      fixtures: [docs-control-plane.fixture.invalid-bdd-cases]
    when:
      operation: definition-markdown.listDocuments
    then:
      error:
        code: bdd-schema-error
      returns:
        document: present
      invariants: [document.not_dropped]

  - id: docs-control-plane.bdd.cli.list-contracts.v1
    owner_system: docs-control-plane
    contract_kind: query-projection
    mode: read
    given:
      predicates: [docs.family.has_bdd_cases, cli.output.json_requested]
      fixtures: [docs-control-plane.fixture.bdd-family]
    when:
      operation: qa-sdk.docs.bdd.list
    then:
      returns:
        contracts: non_empty
      invariants: [contracts.include_contract_id]

  - id: docs-control-plane.bdd.cli.validate-contracts.v1
    owner_system: docs-control-plane
    contract_kind: query-projection
    mode: read
    given:
      predicates: [docs.family.has_valid_bdd_cases, cli.output.json_requested]
      fixtures: [docs-control-plane.fixture.bdd-family]
    when:
      operation: qa-sdk.docs.bdd.validate
    then:
      returns:
        passed: true
        issues: []

  - id: docs-control-plane.bdd.cli.units-grouped.v1
    owner_system: docs-control-plane
    contract_kind: query-projection
    mode: read
    given:
      predicates: [docs.family.has_bdd_contract_units, cli.output.json_requested]
      fixtures: [docs-control-plane.fixture.bdd-family]
    when:
      operation: qa-sdk.docs.bdd.units
    then:
      returns:
        units: grouped_by_contract_id
      invariants: [test_units.link_contract, implementation_units.link_contract]

  - id: docs-control-plane.bdd.cli.compile-scenarios.v1
    owner_system: docs-control-plane
    contract_kind: query-projection
    mode: read
    given:
      predicates: [docs.family.has_bdd_contracts, cli.output.json_requested]
      fixtures: [docs-control-plane.fixture.bdd-family]
    when:
      operation: qa-sdk.docs.bdd.compile
    then:
      returns:
        scenarios: non_empty
      invariants: [scenario_id.matches_contract_id, scenario.domain_matches_owner_system]

test_units:
  - id: TU-docs-control-plane-bdd-parse-valid-block
    contract: docs-control-plane.bdd.parse.valid-block.v1
    level: unit
    assertions: [then.returns.metadata.bdd.contracts, then.returns.metadata.bdd.testUnits, then.returns.metadata.bdd.implementationUnits]
    test_file: packages/cli/src/lib/docs-control-plane/docs-control-plane.test.ts

  - id: TU-docs-control-plane-bdd-parse-invalid-block
    contract: docs-control-plane.bdd.parse.invalid-block-diagnostic.v1
    level: unit
    assertions: [then.error.code, then.returns.document, then.invariants.document.not_dropped]
    test_file: packages/cli/src/lib/docs-control-plane/docs-control-plane.test.ts

  - id: TU-docs-control-plane-bdd-cli-list
    contract: docs-control-plane.bdd.cli.list-contracts.v1
    level: integration
    assertions: [then.returns.contracts, then.invariants.contracts.include_contract_id]
    test_file: packages/cli/src/commands/docs.test.ts

  - id: TU-docs-control-plane-bdd-cli-validate
    contract: docs-control-plane.bdd.cli.validate-contracts.v1
    level: integration
    assertions: [then.returns.passed, then.returns.issues]
    test_file: packages/cli/src/commands/docs.test.ts

  - id: TU-docs-control-plane-bdd-cli-units
    contract: docs-control-plane.bdd.cli.units-grouped.v1
    level: integration
    assertions: [then.returns.units, then.invariants.test_units.link_contract, then.invariants.implementation_units.link_contract]
    test_file: packages/cli/src/commands/docs.test.ts

  - id: TU-docs-control-plane-bdd-cli-compile
    contract: docs-control-plane.bdd.cli.compile-scenarios.v1
    level: integration
    assertions: [then.returns.scenarios, then.invariants.scenario_id.matches_contract_id, then.invariants.scenario.domain_matches_owner_system]
    test_file: packages/cli/src/commands/docs.test.ts

implementation_units:
  - id: IU-docs-control-plane-bdd-core-schema
    contract: docs-control-plane.bdd.parse.valid-block.v1
    unit_kind: guard
    owned_by: docs-control-plane
    source_target: packages/core/src/schema/bdd-contract.schema.ts
    effects: [metadata.bdd.schema_validation]

  - id: IU-docs-control-plane-bdd-extractor
    contract: docs-control-plane.bdd.parse.valid-block.v1
    unit_kind: projection
    owned_by: docs-control-plane
    source_target: packages/cli/src/lib/docs-control-plane/bdd-contract-extract.ts
    effects: [metadata.bdd.contracts, metadata.bdd.testUnits, metadata.bdd.implementationUnits]

  - id: IU-docs-control-plane-bdd-invalid-diagnostics
    contract: docs-control-plane.bdd.parse.invalid-block-diagnostic.v1
    unit_kind: guard
    owned_by: docs-control-plane
    source_target: packages/cli/src/lib/docs-control-plane/bdd-contract-extract.ts
    effects: [diagnostics.bdd-schema-error]

  - id: IU-docs-control-plane-bdd-adapter-projection
    contract: docs-control-plane.bdd.parse.valid-block.v1
    unit_kind: projection
    owned_by: docs-control-plane
    source_target: packages/cli/src/lib/docs-control-plane/adapters/definition-markdown.ts
    effects: [DocumentEnvelope.metadata.bdd]

  - id: IU-docs-control-plane-bdd-cli-list
    contract: docs-control-plane.bdd.cli.list-contracts.v1
    unit_kind: operation
    owned_by: docs-control-plane
    source_target: packages/cli/src/commands/docs.ts
    effects: [docs.bdd.list.output]

  - id: IU-docs-control-plane-bdd-cli-validate
    contract: docs-control-plane.bdd.cli.validate-contracts.v1
    unit_kind: operation
    owned_by: docs-control-plane
    source_target: packages/cli/src/commands/docs.ts
    effects: [docs.bdd.validate.output]

  - id: IU-docs-control-plane-bdd-cli-units
    contract: docs-control-plane.bdd.cli.units-grouped.v1
    unit_kind: operation
    owned_by: docs-control-plane
    source_target: packages/cli/src/commands/docs.ts
    effects: [docs.bdd.units.output]

  - id: IU-docs-control-plane-bdd-compile-core
    contract: docs-control-plane.bdd.cli.compile-scenarios.v1
    unit_kind: projection
    owned_by: docs-control-plane
    source_target: packages/core/src/bdd-contract/compile-scenario.ts
    effects: [ScenarioSpec]

  - id: IU-docs-control-plane-bdd-cli-compile
    contract: docs-control-plane.bdd.cli.compile-scenarios.v1
    unit_kind: operation
    owned_by: docs-control-plane
    source_target: packages/cli/src/commands/docs.ts
    effects: [docs.bdd.compile.output]
```
