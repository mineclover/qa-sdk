import {
  validateOperationalOntologySchema,
  type OperationalOntologySchema,
} from './schema-core.js';
import { validateImplementationBlueprint } from './implementation-governance-evaluator.js';
import { validateImplementationGovernanceTaxonomy } from './implementation-governance-taxonomy.js';
import type {
  ImplementationBlueprint,
  ImplementationBlueprintValidationResult,
  ImplementationGovernanceTaxonomy,
  ImplementationGovernanceTaxonomyValidationResult,
} from './implementation-governance-types.js';

export interface OperationalOntologyPack {
  packId: string;
  schema: OperationalOntologySchema;
  governanceTaxonomy?: ImplementationGovernanceTaxonomy;
  blueprints?: readonly ImplementationBlueprint[];
  metadata?: Record<string, unknown>;
}

export type OperationalOntologyPackValidationSource =
  | 'pack'
  | 'schema'
  | 'governance_taxonomy'
  | 'blueprint';

export interface OperationalOntologyPackValidationIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
  path: string;
  source: OperationalOntologyPackValidationSource;
  blueprintId?: string;
}

export interface OperationalOntologyPackBlueprintValidation {
  blueprintId: string;
  validation: ImplementationBlueprintValidationResult;
}

export interface OperationalOntologyPackValidationResult {
  valid: boolean;
  issues: readonly OperationalOntologyPackValidationIssue[];
  schemaValidation: ReturnType<typeof validateOperationalOntologySchema>;
  governanceTaxonomyValidation?: ImplementationGovernanceTaxonomyValidationResult;
  blueprintValidations: readonly OperationalOntologyPackBlueprintValidation[];
}

export interface OperationalOntologyPacksValidationResult {
  valid: boolean;
  issues: readonly OperationalOntologyPackValidationIssue[];
  packValidations: readonly OperationalOntologyPackValidationResult[];
}

export interface OperationalOntologyPackRegistry {
  list(): readonly OperationalOntologyPack[];
  get(packId: string): OperationalOntologyPack | undefined;
  validateAll(): OperationalOntologyPacksValidationResult;
}

function createPackIssue(
  code: string,
  message: string,
  path: string,
  source: OperationalOntologyPackValidationSource,
  blueprintId?: string,
): OperationalOntologyPackValidationIssue {
  return { level: 'error', code, message, path, source, blueprintId };
}

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

export function validateOperationalOntologyPack(
  pack: OperationalOntologyPack,
): OperationalOntologyPackValidationResult {
  const issues: OperationalOntologyPackValidationIssue[] = [];

  if (pack.packId.trim().length === 0) {
    issues.push(
      createPackIssue(
        'pack-id-empty',
        'Operational ontology pack id must not be empty',
        'packId',
        'pack',
      ),
    );
  }

  const schemaValidation = validateOperationalOntologySchema(pack.schema);
  issues.push(
    ...schemaValidation.issues.map((issue) => ({
      ...issue,
      path: `schema.${issue.path}`,
      source: 'schema' as const,
    })),
  );

  const governanceTaxonomyValidation = pack.governanceTaxonomy
    ? validateImplementationGovernanceTaxonomy(pack.governanceTaxonomy)
    : undefined;
  issues.push(
    ...(governanceTaxonomyValidation?.issues ?? []).map((issue) => ({
      ...issue,
      path: `governanceTaxonomy.${issue.path}`,
      source: 'governance_taxonomy' as const,
    })),
  );

  const blueprints = pack.blueprints ?? [];
  for (const duplicate of duplicateValues(blueprints.map((blueprint) => blueprint.blueprintId))) {
    issues.push(
      createPackIssue(
        'blueprint-id-duplicate',
        `Duplicate implementation governance blueprint id "${duplicate}"`,
        `blueprints.${duplicate}`,
        'blueprint',
        duplicate,
      ),
    );
  }

  const blueprintValidations = blueprints.map((blueprint) => ({
    blueprintId: blueprint.blueprintId,
    validation: validateImplementationBlueprint({
      blueprint,
      schema: pack.schema,
      taxonomy: pack.governanceTaxonomy,
    }),
  }));

  for (const { blueprintId, validation } of blueprintValidations) {
    issues.push(
      ...validation.verdicts.map((verdict) => ({
        level: verdict.level,
        code: verdict.code,
        message: verdict.message,
        path: `blueprints.${blueprintId}.${verdict.constraintKind}`,
        source: 'blueprint' as const,
        blueprintId,
      })),
    );
  }

  return {
    valid: issues.every((issue) => issue.level !== 'error'),
    issues,
    schemaValidation,
    governanceTaxonomyValidation,
    blueprintValidations,
  };
}

export function validateOperationalOntologyPacks(
  packs: readonly OperationalOntologyPack[],
): OperationalOntologyPacksValidationResult {
  const issues: OperationalOntologyPackValidationIssue[] = [];

  for (const duplicate of duplicateValues(packs.map((pack) => pack.packId))) {
    issues.push(
      createPackIssue(
        'pack-id-duplicate',
        `Duplicate operational ontology pack id "${duplicate}"`,
        `packs.${duplicate}`,
        'pack',
      ),
    );
  }

  const packValidations = packs.map(validateOperationalOntologyPack);
  for (const validation of packValidations) {
    issues.push(...validation.issues);
  }

  return {
    valid: issues.every((issue) => issue.level !== 'error'),
    issues,
    packValidations,
  };
}

export class InMemoryOperationalOntologyPackRegistry implements OperationalOntologyPackRegistry {
  private readonly packs: readonly OperationalOntologyPack[];

  constructor(packs: readonly OperationalOntologyPack[] = []) {
    this.packs = packs.map((pack) => structuredClone(pack));
  }

  list(): readonly OperationalOntologyPack[] {
    return this.packs.map((pack) => structuredClone(pack));
  }

  get(packId: string): OperationalOntologyPack | undefined {
    const pack = this.packs.find((candidate) => candidate.packId === packId);
    return pack ? structuredClone(pack) : undefined;
  }

  validateAll(): OperationalOntologyPacksValidationResult {
    return validateOperationalOntologyPacks(this.packs);
  }
}
