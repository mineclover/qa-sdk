// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { parseDocument } from 'definition-catalog';
import { describe, expect, it } from 'vitest';

import type {
  OntologyPackScaffoldComponentLikeDeclaration,
  OntologyPackScaffoldIdentity,
  OntologyPackScaffoldSystemLikeBinding,
} from '../ontology-pack-scaffold-plan.js';
import { deriveOntologyPackScaffoldSymbols } from '../ontology-pack-scaffold-plan.js';
import {
  renderCasesDoc,
  renderPlanDoc,
  renderRuleDoc,
  renderSpecDoc,
  renderTestDoc,
  renderTodoDoc,
} from './render-docs.js';

describe('ontology pack scaffold docs renderers', () => {
  it('renders deterministic definition docs with valid frontmatter', () => {
    const fixture = createRendererFixture();
    const first = renderAllDocs(fixture);
    const second = renderAllDocs(fixture);

    expect(first).toEqual(second);

    const expectedFrontmatter = new Map([
      [
        'spec',
        {
          id: 'risk-model-ontology-system',
          level: 'leaf',
          scope: 'interface',
          aspect: 'api_contract',
          depth: 'specification',
          lifecycle: 'draft',
        },
      ],
      [
        'todo',
        {
          id: 'risk-model-ontology-todo',
          level: 'leaf',
          scope: 'flow',
          aspect: 'process_flow',
          depth: 'specification',
          lifecycle: 'draft',
        },
      ],
      [
        'plan',
        {
          id: 'risk-model-ontology-plan',
          level: 'leaf',
          scope: 'flow',
          aspect: 'process_flow',
          depth: 'specification',
          lifecycle: 'draft',
        },
      ],
      [
        'rule',
        {
          id: 'risk-model-ontology-rule',
          level: 'leaf',
          scope: 'constraint',
          aspect: 'tech_constraint',
          depth: 'validation',
          lifecycle: 'draft',
        },
      ],
      [
        'cases',
        {
          id: 'risk-model-ontology-cases',
          level: 'leaf',
          scope: 'flow',
          aspect: 'user_scenario',
          depth: 'validation',
          lifecycle: 'draft',
        },
      ],
      [
        'test',
        {
          id: 'risk-model-ontology-test',
          level: 'leaf',
          scope: 'flow',
          aspect: 'user_scenario',
          depth: 'validation',
          lifecycle: 'draft',
        },
      ],
    ]);

    for (const doc of first) {
      const expected = expectedFrontmatter.get(doc.docType);
      expect(expected).toBeDefined();
      expect(parseDocument(doc.content, doc.path).def).toMatchObject(expected ?? {});
    }
  });

  it('keeps spec skeleton architecture-neutral while separating identity, data, and system text', () => {
    const fixture = createRendererFixture();
    const spec = renderSpecDoc(
      fixture.identity,
      fixture.componentLikeDeclarations,
      fixture.systemLikeBindings,
      fixture.sources,
      fixture.testPath,
    );

    expect(spec).toContain('## Architecture-Neutral Separation');
    expect(spec).toContain(
      'ECS is one possible modeled architecture, but it is not the only supported architecture.',
    );
    expect(spec).toContain(
      'Identity declarations are stable names only; they do not own schema records or runtime behavior.',
    );
    expect(spec).toContain('identity/component schema/system binding separation discipline');
    expect(spec).toContain('### Component schema');
    expect(spec).toContain('### System bindings');
    expect(spec).toContain('`RISK_MODEL_ONTOLOGY_AXIS_ID` = `risk_model_ontology_kind` (axis)');
    expect(spec).toContain('System-like OperationalOntologyPack object');
    expect(spec).toContain(
      'packages/operational-ontology/src/internal/risk-model-ontology-schema.ts',
    );
    expect(spec).toContain(
      'packages/operational-ontology/src/internal/risk-model-ontology-pack.ts',
    );
    expect(spec).toContain('packages/operational-ontology/src/risk-model-ontology.test.ts');
  });
});

interface RendererFixture {
  readonly identity: OntologyPackScaffoldIdentity;
  readonly componentLikeDeclarations: readonly OntologyPackScaffoldComponentLikeDeclaration[];
  readonly systemLikeBindings: readonly OntologyPackScaffoldSystemLikeBinding[];
  readonly sources: readonly string[];
  readonly testPath: string;
}

function createRendererFixture(): RendererFixture {
  const symbols = deriveOntologyPackScaffoldSymbols('risk-model-ontology');
  const componentSchemaPath =
    'packages/operational-ontology/src/internal/risk-model-ontology-schema.ts';
  const systemBindingPath =
    'packages/operational-ontology/src/internal/risk-model-ontology-pack.ts';
  const testPath = 'packages/operational-ontology/src/risk-model-ontology.test.ts';
  const identity: OntologyPackScaffoldIdentity = {
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
  return {
    identity,
    componentLikeDeclarations: [
      {
        kind: 'axis',
        symbolName: symbols.axisIdConstantName,
        value: 'risk_model_ontology_kind',
        filePath: componentSchemaPath,
        description: "Data-only axis vocabulary for the pack's first stable dimension.",
      },
      {
        kind: 'taxonomy',
        symbolName: symbols.taxonomyIdConstantName,
        value: 'risk-model-ontology',
        filePath: componentSchemaPath,
        description: 'Data-only taxonomy declaration that applies the axis to ontology nodes.',
      },
    ],
    systemLikeBindings: [
      {
        kind: 'blueprint',
        symbolName: symbols.blueprintsConstantName,
        value: 'risk-model-ontology-binding',
        filePath: systemBindingPath,
        description:
          'System-like implementation binding that connects schema vocabulary to runtime refs.',
      },
      {
        kind: 'pack-binding',
        symbolName: symbols.packConstantName,
        value: 'risk-model-ontology',
        filePath: systemBindingPath,
        description:
          'System-like OperationalOntologyPack object that combines schema and blueprints.',
      },
    ],
    sources: [componentSchemaPath, systemBindingPath, testPath],
    testPath,
  };
}

function renderAllDocs(fixture: RendererFixture): {
  readonly docType: string;
  readonly path: string;
  readonly content: string;
}[] {
  return [
    {
      docType: 'spec',
      path: 'docs/specs/operational-ontology/risk-model-ontology-system.spec.md',
      content: renderSpecDoc(
        fixture.identity,
        fixture.componentLikeDeclarations,
        fixture.systemLikeBindings,
        fixture.sources,
        fixture.testPath,
      ),
    },
    {
      docType: 'todo',
      path: 'docs/specs/operational-ontology/risk-model-ontology-todo.todo.md',
      content: renderTodoDoc(fixture.identity),
    },
    {
      docType: 'plan',
      path: 'docs/specs/operational-ontology/risk-model-ontology-plan.plan.md',
      content: renderPlanDoc(fixture.identity),
    },
    {
      docType: 'rule',
      path: 'docs/specs/operational-ontology/risk-model-ontology.rule.md',
      content: renderRuleDoc(fixture.identity),
    },
    {
      docType: 'cases',
      path: 'docs/specs/operational-ontology/risk-model-ontology.cases.md',
      content: renderCasesDoc(fixture.identity),
    },
    {
      docType: 'test',
      path: 'docs/specs/operational-ontology/risk-model-ontology.test.md',
      content: renderTestDoc(fixture.identity, fixture.testPath),
    },
  ];
}
