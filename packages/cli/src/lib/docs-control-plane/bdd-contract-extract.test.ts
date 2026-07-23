import { describe, expect, it } from 'vitest';
import { extractBddDocumentMetadata } from './bdd-contract-extract.js';

describe('BDD metadata extraction', () => {
  it('parses formatter-produced multiline arrays with trailing commas', () => {
    const metadata = extractBddDocumentMetadata(
      'fixture.md',
      `
\`\`\`yaml bdd
bdd_contract:
  id: fixture.contract
  owner_system: fixture
  contract_kind: query-projection
  mode: read
  given:
    predicates:
      [
        fixture.available,
        fixture.stable,
      ]
  when:
    operation: fixture.read
  then:
    invariants:
      [
        fixture.deterministic,
        fixture.reference_only,
      ]
test_unit:
  id: fixture.test
  contract: fixture.contract
  level: unit
  assertions:
    [
      then.invariants.fixture.deterministic,
      then.invariants.fixture.reference_only,
    ]
\`\`\`
`,
    );

    expect(metadata.diagnostics).toEqual([]);
    expect(metadata.contracts[0]?.given.predicates).toEqual([
      'fixture.available',
      'fixture.stable',
    ]);
    expect(metadata.testUnits[0]?.assertions).toEqual([
      'then.invariants.fixture.deterministic',
      'then.invariants.fixture.reference_only',
    ]);
  });
});
