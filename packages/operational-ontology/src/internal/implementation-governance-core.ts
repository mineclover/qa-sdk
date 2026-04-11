import type { OperationalOntologySchema, RelationCategorySchema } from './schema-core.js';

export const IMPLEMENTATION_SURFACE_KINDS = [
  'code',
  'document',
  'runtime_projection',
  'configuration',
] as const;

export type ImplementationSurfaceKind = (typeof IMPLEMENTATION_SURFACE_KINDS)[number];

export const VERIFICATION_SURFACE_KINDS = ['test', 'gate', 'simulation', 'review'] as const;

export type VerificationSurfaceKind = (typeof VERIFICATION_SURFACE_KINDS)[number];

export type ConsistencyConstraintKind =
  | 'unit_boundary'
  | 'required_facets'
  | 'allowed_relations'
  | 'validation_surface'
  | 'evolution_rule';

export type ConsistencyConstraintSeverity = 'core' | 'required' | 'optional';

export type AdjustmentAction = 'relax' | 'split' | 'defer' | 'escalate';

export type EvolutionPolicyKind = 'append_only' | 'supersede' | 'fork' | 'merge';

export interface GovernanceSurfaceRef<TKind extends string = string> {
  kind: TKind;
  ref: string;
}

export interface ConsistencyConstraint {
  kind: ConsistencyConstraintKind;
  severity?: ConsistencyConstraintSeverity;
  requiredRefs?: readonly string[];
  allowedRefs?: readonly string[];
  description?: string;
}

export interface AdjustmentPolicy {
  allowedActions: readonly AdjustmentAction[];
}

export interface EvolutionPolicy {
  kind: EvolutionPolicyKind;
}

export interface ImplementationBlueprint {
  blueprintId: string;
  coordinateRef: string;
  unitKind: string;
  requiredSchemas?: readonly string[];
  implementationBinding?: ImplementationBinding;
  verificationBinding?: VerificationBinding;
  constraints?: readonly ConsistencyConstraint[];
  adjustmentPolicy?: AdjustmentPolicy;
  evolutionPolicy?: EvolutionPolicy;
}

export interface ImplementationBinding {
  coordinateRef: string;
  implementationRefs: readonly GovernanceSurfaceRef<ImplementationSurfaceKind>[];
  facets?: readonly string[];
  relationCategories?: readonly string[];
}

export interface VerificationBinding {
  coordinateRef: string;
  verificationRefs: readonly GovernanceSurfaceRef<VerificationSurfaceKind>[];
}

export interface ConsistencyVerdict {
  valid: boolean;
  level: 'error' | 'warning';
  code: string;
  message: string;
  constraintKind: ConsistencyConstraintKind;
  refs: readonly string[];
}

export interface AdjustmentSuggestion {
  action: AdjustmentAction;
  constraintKind: ConsistencyConstraintKind;
  reason: string;
  refs: readonly string[];
}

export interface GovernanceRun {
  runId: string;
  blueprintId: string;
  implementationRefs: readonly string[];
  verificationRefs: readonly string[];
  familyKey: string;
  constraintVerdicts: readonly ConsistencyVerdict[];
  adjustmentRecords: readonly AdjustmentSuggestion[];
}

export interface ImplementationGovernanceEvaluationInput {
  blueprint: ImplementationBlueprint;
  implementationBinding?: ImplementationBinding;
  verificationBinding?: VerificationBinding;
  schema?: OperationalOntologySchema;
  now?: string;
  runId?: string;
}

export interface ImplementationGovernanceEvaluationResult {
  valid: boolean;
  verdicts: readonly ConsistencyVerdict[];
  adjustments: readonly AdjustmentSuggestion[];
  governanceRun: GovernanceRun;
}

const DEFAULT_ADJUSTMENT_POLICY: AdjustmentPolicy = {
  allowedActions: ['relax', 'split', 'defer', 'escalate'],
};

function createVerdict(
  code: string,
  message: string,
  constraintKind: ConsistencyConstraintKind,
  refs: readonly string[] = [],
  level: 'error' | 'warning' = 'error',
): ConsistencyVerdict {
  return { valid: level !== 'error', level, code, message, constraintKind, refs };
}

function chooseAdjustment(
  constraint: ConsistencyConstraint,
  policy: AdjustmentPolicy,
  fallback: AdjustmentAction,
): AdjustmentAction {
  if (constraint.severity === 'core') return 'escalate';
  if (policy.allowedActions.includes(fallback)) return fallback;
  if (policy.allowedActions.includes('defer')) return 'defer';
  return 'escalate';
}

function createAdjustment(
  action: AdjustmentAction,
  constraintKind: ConsistencyConstraintKind,
  reason: string,
  refs: readonly string[] = [],
): AdjustmentSuggestion {
  return { action, constraintKind, reason, refs };
}

function relationCategoryMap(
  schema?: OperationalOntologySchema,
): Map<string, RelationCategorySchema> {
  return new Map(
    (schema?.relationCategories ?? []).map((category) => [category.category, category]),
  );
}

function schemaIds(schema?: OperationalOntologySchema): Set<string> {
  return new Set([
    ...(schema?.axes ?? []).map((axis) => axis.id),
    ...(schema?.taxonomies ?? []).map((taxonomy) => taxonomy.id),
    ...(schema?.relationCategories ?? []).map((category) => category.category),
    ...(schema?.traversals ?? []).map((traversal) => traversal.purpose),
  ]);
}

function refsByKind<TKind extends string>(
  refs: readonly GovernanceSurfaceRef<TKind>[],
): Set<string> {
  return new Set(refs.map((ref) => ref.kind));
}

function evaluateConstraint(
  constraint: ConsistencyConstraint,
  blueprint: ImplementationBlueprint,
  implementation: ImplementationBinding,
  verification: VerificationBinding,
  schema?: OperationalOntologySchema,
): readonly ConsistencyVerdict[] {
  const requiredRefs = constraint.requiredRefs ?? [];
  const allowedRefs = constraint.allowedRefs ?? [];

  if (constraint.kind === 'unit_boundary') {
    const verdicts: ConsistencyVerdict[] = [];
    if (implementation.coordinateRef !== blueprint.coordinateRef) {
      verdicts.push(
        createVerdict(
          'implementation-coordinate-mismatch',
          'Implementation binding must match the blueprint coordinate',
          'unit_boundary',
          [implementation.coordinateRef, blueprint.coordinateRef],
        ),
      );
    }
    if (verification.coordinateRef !== blueprint.coordinateRef) {
      verdicts.push(
        createVerdict(
          'verification-coordinate-mismatch',
          'Verification binding must match the blueprint coordinate',
          'unit_boundary',
          [verification.coordinateRef, blueprint.coordinateRef],
        ),
      );
    }
    return verdicts;
  }

  if (constraint.kind === 'required_facets') {
    const facets = new Set(implementation.facets ?? []);
    return requiredRefs
      .filter((facet) => !facets.has(facet))
      .map((facet) =>
        createVerdict(
          'required-facet-missing',
          `Implementation binding is missing required facet "${facet}"`,
          'required_facets',
          [facet],
        ),
      );
  }

  if (constraint.kind === 'allowed_relations') {
    const relationMap = relationCategoryMap(schema);
    return (implementation.relationCategories ?? [])
      .filter(
        (category) =>
          (allowedRefs.length > 0 && !allowedRefs.includes(category)) ||
          (schema && !relationMap.has(category)),
      )
      .map((category) =>
        createVerdict(
          'relation-category-not-allowed',
          `Implementation binding uses relation category "${category}" outside the governance contract`,
          'allowed_relations',
          [category],
        ),
      );
  }

  if (constraint.kind === 'validation_surface') {
    const verificationKinds = refsByKind(verification.verificationRefs);
    const missing = requiredRefs.filter((kind) => !verificationKinds.has(kind));
    return missing.map((kind) =>
      createVerdict(
        'verification-surface-missing',
        `Verification binding is missing required surface "${kind}"`,
        'validation_surface',
        [kind],
      ),
    );
  }

  if (constraint.kind === 'evolution_rule' && !blueprint.evolutionPolicy) {
    return [
      createVerdict(
        'evolution-policy-missing',
        'Blueprint must define an evolution policy',
        'evolution_rule',
      ),
    ];
  }

  return [];
}

export function evaluateImplementationGovernance(
  input: ImplementationGovernanceEvaluationInput,
): ImplementationGovernanceEvaluationResult {
  const blueprint = input.blueprint;
  const implementation = input.implementationBinding ?? blueprint.implementationBinding;
  const verification = input.verificationBinding ?? blueprint.verificationBinding;
  const policy = blueprint.adjustmentPolicy ?? DEFAULT_ADJUSTMENT_POLICY;
  const verdicts: ConsistencyVerdict[] = [];
  const adjustments: AdjustmentSuggestion[] = [];
  const knownSchemaIds = schemaIds(input.schema);

  for (const schemaId of blueprint.requiredSchemas ?? []) {
    if (input.schema && !knownSchemaIds.has(schemaId)) {
      verdicts.push(
        createVerdict(
          'required-schema-missing',
          `Blueprint references unknown schema "${schemaId}"`,
          'unit_boundary',
          [schemaId],
        ),
      );
    }
  }

  if (!implementation || implementation.implementationRefs.length === 0) {
    verdicts.push(
      createVerdict(
        'implementation-binding-missing',
        'Blueprint must bind at least one implementation surface',
        'unit_boundary',
      ),
    );
  }

  if (!verification || verification.verificationRefs.length === 0) {
    verdicts.push(
      createVerdict(
        'verification-binding-missing',
        'Blueprint must bind at least one verification surface',
        'validation_surface',
      ),
    );
    adjustments.push(
      createAdjustment(
        policy.allowedActions.includes('defer') ? 'defer' : 'escalate',
        'validation_surface',
        'Verification can be deferred only when the governance policy allows it',
      ),
    );
  }

  if (implementation && verification) {
    for (const constraint of blueprint.constraints ?? []) {
      const constraintVerdicts = evaluateConstraint(
        constraint,
        blueprint,
        implementation,
        verification,
        input.schema,
      );
      verdicts.push(...constraintVerdicts);

      for (const verdict of constraintVerdicts.filter((item) => !item.valid)) {
        const fallback =
          constraint.kind === 'required_facets' || constraint.kind === 'allowed_relations'
            ? 'relax'
            : constraint.kind === 'validation_surface'
              ? 'defer'
              : 'split';
        const action = chooseAdjustment(constraint, policy, fallback);
        adjustments.push(createAdjustment(action, constraint.kind, verdict.message, verdict.refs));
      }
    }
  }

  const implementationRefs = implementation?.implementationRefs.map((ref) => ref.ref) ?? [];
  const verificationRefs = verification?.verificationRefs.map((ref) => ref.ref) ?? [];
  const runId = input.runId ?? `governance:${blueprint.blueprintId}:${input.now ?? 'now'}`;
  const familyKey = `governance:${blueprint.coordinateRef}:${blueprint.unitKind}`;

  return {
    valid: verdicts.every((verdict) => verdict.valid),
    verdicts,
    adjustments,
    governanceRun: {
      runId,
      blueprintId: blueprint.blueprintId,
      implementationRefs,
      verificationRefs,
      familyKey,
      constraintVerdicts: verdicts,
      adjustmentRecords: adjustments,
    },
  };
}
