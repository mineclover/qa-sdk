import { describe, expect, it } from 'vitest';

import { operationalOntologyPackPlane } from './pack.js';
import { InMemoryOperationalOntologyPackRegistry } from './pack.js';

const schema = {
  axes: [
    {
      id: 'facet_role',
      values: ['definition', 'production', 'consumption'],
    },
  ],
  taxonomies: [
    {
      id: 'information-role',
      appliesTo: ['node'],
      axisIds: ['facet_role'],
    },
  ],
  relationCategories: [
    {
      category: 'flow',
      requiredAxes: ['facet_role'],
    },
  ],
};

describe('operational ontology pack validation', () => {
  it('validates schema and governance blueprints as one pack', () => {
    const result = operationalOntologyPackPlane.validateOperationalOntologyPack({
      packId: 'authorization-ontology',
      schema,
      blueprints: [
        {
          blueprintId: 'authorization-decision-observation',
          coordinateRef: 'checkpoint:authorization-decision',
          unitKind: 'checkpoint_lattice',
          requiredSchemas: ['information-role', 'flow'],
          constraints: [{ kind: 'unit_boundary' }],
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.schemaValidation.valid).toBe(true);
    expect(result.blueprintValidations).toEqual([
      expect.objectContaining({
        blueprintId: 'authorization-decision-observation',
        validation: expect.objectContaining({ valid: true }),
      }),
    ]);
  });

  it('fails invalid schemas and duplicate blueprint ids', () => {
    const result = operationalOntologyPackPlane.validateOperationalOntologyPack({
      packId: 'broken-pack',
      schema: {
        axes: [
          {
            id: 'facet_role',
            values: ['definition', 'definition'],
          },
        ],
        taxonomies: [],
        relationCategories: [],
      },
      blueprints: [
        {
          blueprintId: 'duplicate',
          coordinateRef: 'checkpoint:a',
          unitKind: 'checkpoint_lattice',
        },
        {
          blueprintId: 'duplicate',
          coordinateRef: 'checkpoint:b',
          unitKind: 'checkpoint_lattice',
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'axis-values-duplicate', source: 'schema' }),
        expect.objectContaining({ code: 'blueprint-id-duplicate', source: 'blueprint' }),
      ]),
    );
  });

  it('validates blueprint schema requirements against the pack schema', () => {
    const result = operationalOntologyPackPlane.validateOperationalOntologyPack({
      packId: 'schema-bound-pack',
      schema,
      blueprints: [
        {
          blueprintId: 'missing-schema-blueprint',
          coordinateRef: 'corridor:missing-schema',
          unitKind: 'corridor_bundle',
          requiredSchemas: ['missing-schema'],
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'required-schema-missing',
          source: 'blueprint',
          blueprintId: 'missing-schema-blueprint',
        }),
      ]),
    );
  });

  it('validates multiple packs and detects duplicate pack ids', () => {
    const pack = {
      packId: 'authorization-ontology',
      schema,
    };

    const result = operationalOntologyPackPlane.validateOperationalOntologyPacks([pack, pack]);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'pack-id-duplicate', source: 'pack' }),
      ]),
    );
    expect(result.packValidations).toHaveLength(2);
  });

  it('provides an in-memory pack registry facade', () => {
    const registry = new InMemoryOperationalOntologyPackRegistry([
      {
        packId: 'authorization-ontology',
        schema,
      },
    ]);

    expect(registry.get('authorization-ontology')).toEqual(
      expect.objectContaining({ packId: 'authorization-ontology' }),
    );
    expect(registry.list()).toHaveLength(1);
    expect(registry.validateAll()).toEqual(expect.objectContaining({ valid: true }));
  });
});
