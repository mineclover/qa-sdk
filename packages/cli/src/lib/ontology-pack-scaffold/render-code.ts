import type { OntologyPackScaffoldIdentity } from '../ontology-pack-scaffold-plan.js';

export function renderComponentSchemaFile(identity: OntologyPackScaffoldIdentity): string {
  const { symbols } = identity;
  const axisDeclarationsName = `${symbols.camelName}Axes`;
  const taxonomyDeclarationsName = `${symbols.camelName}Taxonomies`;
  const relationCategoryDeclarationsName = `${symbols.camelName}RelationCategories`;
  const traversalDeclarationsName = `${symbols.camelName}Traversals`;
  return `import type {
  AxisSchema,
  OperationalOntologySchema,
  RelationCategorySchema,
  TaxonomySchema,
  TraversalSchema,
} from "operational-ontology/schema";

// Identity constants
export const ${symbols.packIdConstantName} = "${identity.packId}" as const;
export const ${symbols.axisIdConstantName} = "${identity.defaultAxisId}" as const;
export const ${symbols.taxonomyIdConstantName} = "${identity.defaultTaxonomyId}" as const;
export const ${symbols.relationCategoryConstantName} = "${identity.defaultRelationCategory}" as const;
export const ${symbols.traversalPurposeConstantName} = "${identity.defaultTraversalPurpose}" as const;

// Component-like schema: axes
export const ${axisDeclarationsName} = [
  {
    id: ${symbols.axisIdConstantName},
    values: ["example"],
    stable: true,
    capacity: 4,
  },
] satisfies AxisSchema[];

// Component-like schema: taxonomies
export const ${taxonomyDeclarationsName} = [
  {
    id: ${symbols.taxonomyIdConstantName},
    appliesTo: ["node"],
    axisIds: [${symbols.axisIdConstantName}],
    identityAxisIds: [${symbols.axisIdConstantName}],
    space: ${symbols.packIdConstantName},
  },
] satisfies TaxonomySchema[];

// Component-like schema: relation categories
export const ${relationCategoryDeclarationsName} = [
  {
    category: ${symbols.relationCategoryConstantName},
    requiredAxes: [${symbols.axisIdConstantName}],
  },
] satisfies RelationCategorySchema[];

// Component-like schema: traversals
export const ${traversalDeclarationsName} = [
  {
    purpose: ${symbols.traversalPurposeConstantName},
    allowedRelationCategories: [${symbols.relationCategoryConstantName}],
    canonicalizable: true,
  },
] satisfies TraversalSchema[];

export const ${symbols.schemaConstantName} = {
  axes: ${axisDeclarationsName},
  taxonomies: ${taxonomyDeclarationsName},
  relationCategories: ${relationCategoryDeclarationsName},
  traversals: ${traversalDeclarationsName},
} satisfies OperationalOntologySchema;
`;
}

export function renderSystemBindingFile(
  identity: OntologyPackScaffoldIdentity,
  componentSchemaPath: string,
  testPath: string,
): string {
  const { symbols } = identity;
  const schemaImportPath = `./${componentSchemaPath.split('/').pop()?.replace(/\.ts$/, '.js') ?? `${identity.safePackId}-schema.js`}`;
  return `import type { ImplementationBlueprint } from "operational-ontology/governance";
import type {
  OperationalOntologyPack,
  OperationalOntologyPackValidationResult,
} from "operational-ontology/pack";
import { validateOperationalOntologyPack } from "operational-ontology/pack";
import {
  ${symbols.packIdConstantName},
  ${symbols.relationCategoryConstantName},
  ${symbols.schemaConstantName},
  ${symbols.taxonomyIdConstantName},
  ${symbols.traversalPurposeConstantName},
} from "${schemaImportPath}";

// System-like bindings: blueprints
export const ${symbols.blueprintsConstantName} = [
  {
    blueprintId: "${identity.safePackId}-binding",
    coordinateRef: "corridor:${identity.safePackId}-binding",
    unitKind: "corridor_bundle",
    requiredSchemas: [
      ${symbols.taxonomyIdConstantName},
      ${symbols.relationCategoryConstantName},
      ${symbols.traversalPurposeConstantName},
    ],
    implementationBinding: {
      coordinateRef: "corridor:${identity.safePackId}-binding",
      implementationRefs: [
        {
          kind: "code",
          ref: "${identity.package.sourceDir}/${identity.safePackId}-pack.ts",
        },
      ],
      relationCategories: [${symbols.relationCategoryConstantName}],
    },
    verificationBinding: {
      coordinateRef: "corridor:${identity.safePackId}-binding",
      verificationRefs: [
        {
          kind: "test",
          ref: "${testPath}",
        },
      ],
    },
    constraints: [
      { kind: "unit_boundary", severity: "core" },
      { kind: "validation_surface", requiredRefs: ["test"] },
    ],
    evolutionPolicy: { kind: "append_only" },
  },
] satisfies readonly ImplementationBlueprint[];

// System-like bindings: pack contract
export const ${symbols.packConstantName} = {
  packId: ${symbols.packIdConstantName},
  schema: ${symbols.schemaConstantName},
  blueprints: ${symbols.blueprintsConstantName},
} satisfies OperationalOntologyPack;

// System-like bindings: validation helper
export function ${symbols.validateFunctionName}(): OperationalOntologyPackValidationResult {
  return validateOperationalOntologyPack(${symbols.packConstantName});
}
`;
}
