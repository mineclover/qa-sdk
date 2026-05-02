// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { describe, expect, it } from 'vitest';

import type { OntologyPackScaffoldIdentity } from '../ontology-pack-scaffold-plan.js';
import { deriveOntologyPackScaffoldSymbols } from '../ontology-pack-scaffold-plan.js';
import { renderComponentSchemaFile, renderSystemBindingFile } from './render-code.js';

describe('ontology pack scaffold code renderers', () => {
  it('renders deterministic component-like schema declarations', () => {
    const identity = createRendererIdentity();
    const first = renderComponentSchemaFile(identity);
    const second = renderComponentSchemaFile(identity);

    expect(first).toBe(second);
    expect(first).toContain('OperationalOntologySchema');
    expect(first).toContain('// Identity constants');
    expect(first).toContain(
      'export const RISK_MODEL_ONTOLOGY_PACK_ID = "risk-model-ontology" as const;',
    );
    expect(first).toContain(
      'export const RISK_MODEL_ONTOLOGY_AXIS_ID = "risk_model_ontology_kind" as const;',
    );
    expect(first).toContain('// Component-like schema: axes');
    expect(first).toContain('// Component-like schema: taxonomies');
    expect(first).toContain('// Component-like schema: relation categories');
    expect(first).toContain('// Component-like schema: traversals');
    expect(first).toContain('riskModelOntologyAxes');
    expect(first).toContain('stable: true');
    expect(first).toContain('capacity: 4');
    expect(first).toContain('axisIds: [RISK_MODEL_ONTOLOGY_AXIS_ID]');
    expect(first).toContain('riskModelOntologySchema');
    expect(first).not.toContain('ImplementationBlueprint');
    expect(first).not.toContain('validateOperationalOntologyPack');
  });

  it('renders deterministic system-like binding sections', () => {
    const identity = createRendererIdentity();
    const componentSchemaPath =
      'packages/operational-ontology/src/internal/risk-model-ontology-schema.ts';
    const testPath = 'packages/operational-ontology/src/risk-model-ontology.test.ts';
    const first = renderSystemBindingFile(identity, componentSchemaPath, testPath);
    const second = renderSystemBindingFile(identity, componentSchemaPath, testPath);

    expect(first).toBe(second);
    expect(first).toContain('from "./risk-model-ontology-schema.js"');
    expect(first).toContain('ImplementationBlueprint');
    expect(first).toContain('validateOperationalOntologyPack');
    expect(first).toContain('// System-like bindings: blueprints');
    expect(first).toContain('// System-like bindings: pack contract');
    expect(first).toContain('// System-like bindings: validation helper');
    expect(first).toContain('blueprintId: "risk-model-ontology-binding"');
    expect(first).toContain('ref: "packages/operational-ontology/src/risk-model-ontology.test.ts"');
    expect(first).toContain('riskModelOntologyBlueprints');
    expect(first).toContain('riskModelOntologyPack');
    expect(first).not.toContain('// Component-like schema: axes');
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
