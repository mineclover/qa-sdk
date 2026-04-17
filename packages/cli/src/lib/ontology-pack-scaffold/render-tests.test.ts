import { describe, expect, it } from 'vitest';

import type { OntologyPackScaffoldIdentity } from '../ontology-pack-scaffold-plan.js';
import { deriveOntologyPackScaffoldSymbols } from '../ontology-pack-scaffold-plan.js';
import { renderPackTestFile } from './render-tests.js';

describe('ontology pack scaffold test renderer', () => {
  it('renders deterministic pack validation expectations', () => {
    const identity = createRendererIdentity();
    const testPath = 'packages/operational-ontology/src/risk-model-ontology.test.ts';
    const systemBindingPath =
      'packages/operational-ontology/src/internal/risk-model-ontology-pack.ts';
    const first = renderPackTestFile(identity, testPath, systemBindingPath);
    const second = renderPackTestFile(identity, testPath, systemBindingPath);

    expect(first).toBe(second);
    expect(first).toContain(
      'import {\n  riskModelOntologyPack,\n  validateRiskModelOntologyPack,\n} from "./internal/risk-model-ontology-pack.js";',
    );
    expect(first).toContain('describe("risk-model-ontology ontology pack"');
    expect(first).toContain('expect(validateRiskModelOntologyPack().valid).toBe(true);');
    expect(first).toContain('expect(riskModelOntologyPack.packId).toBe("risk-model-ontology");');
    expect(first).toContain(
      'TODO(pack-author): Replace scaffold expectations with domain-specific axis and taxonomy invariants.',
    );
    expect(first).toContain(
      'expect(riskModelOntologyPack.schema.axes.map((axis) => axis.id)).toContain("risk_model_ontology_kind");',
    );
    expect(first).toContain(
      'expect(riskModelOntologyPack.schema.taxonomies.map((taxonomy) => taxonomy.id)).toContain("risk-model-ontology");',
    );
    expect(first).toContain(
      'TODO(pack-author): Replace scaffold expectations with domain-specific blueprint and system binding invariants.',
    );
    expect(first).toContain(
      'expect(riskModelOntologyPack.blueprints?.map((blueprint) => blueprint.blueprintId)).toContain("risk-model-ontology-binding");',
    );
    expect(first).toContain('blueprint.verificationBinding?.verificationRefs');
  });

  it('computes imports relative to custom test paths', () => {
    const identity = createRendererIdentity();
    const content = renderPackTestFile(
      identity,
      'packages/custom-risk/test/risk-model-ontology.test.ts',
      'packages/custom-risk/src/internal/risk-model-ontology-pack.ts',
    );

    expect(content).toContain('from "../src/internal/risk-model-ontology-pack.js"');
  });
});

function createRendererIdentity(): OntologyPackScaffoldIdentity {
  const symbols = deriveOntologyPackScaffoldSymbols('risk-model-ontology');
  return {
    packId: 'risk-model-ontology',
    safePackId: 'risk-model-ontology',
    definitionId: 'risk-model-ontology-system',
    defaultAxisId: 'risk_model_ontology_kind',
    defaultTaxonomyId: 'risk-model-ontology',
    defaultRelationCategory: 'risk_model_ontology_relation',
    defaultTraversalPurpose: 'risk_model_ontology_context',
    symbols,
    package: {
      implementationPackage: 'operational-ontology',
      packageRoot: 'packages/operational-ontology',
      sourceDir: 'packages/operational-ontology/src/internal',
    },
    declarations: [
      {
        kind: 'pack-id',
        symbolName: symbols.packIdConstantName,
        value: 'risk-model-ontology',
      },
      {
        kind: 'definition-id',
        symbolName: 'DEFINITION_ID',
        value: 'risk-model-ontology-system',
      },
      {
        kind: 'axis-id',
        symbolName: symbols.axisIdConstantName,
        value: 'risk_model_ontology_kind',
      },
      {
        kind: 'taxonomy-id',
        symbolName: symbols.taxonomyIdConstantName,
        value: 'risk-model-ontology',
      },
      {
        kind: 'relation-category',
        symbolName: symbols.relationCategoryConstantName,
        value: 'risk_model_ontology_relation',
      },
      {
        kind: 'traversal-purpose',
        symbolName: symbols.traversalPurposeConstantName,
        value: 'risk_model_ontology_context',
      },
    ],
  };
}
