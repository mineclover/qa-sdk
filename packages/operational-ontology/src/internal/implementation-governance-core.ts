import type { OperationalOntologySchema, RelationCategorySchema } from './schema-core.js';
import type { OperationalOntologyStore } from './persistence-memory.js';

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
export type GovernanceVocabularyValue<TCore extends string> = TCore | (string & {});

export const IMPLEMENTATION_GOVERNANCE_UNIT_KINDS = [
  'node_bundle',
  'relation_type_bundle',
  'edge_assertion_bundle',
  'traversal_bundle',
  'corridor_bundle',
  'junction_bundle',
  'checkpoint_lattice',
  'snapshot_projection',
] as const;

export type ImplementationGovernanceUnitKind =
  (typeof IMPLEMENTATION_GOVERNANCE_UNIT_KINDS)[number];

export interface ImplementationGovernanceTaxonomy {
  taxonomyId: string;
  unitKinds: readonly string[];
  implementationSurfaceKinds: readonly string[];
  verificationSurfaceKinds: readonly string[];
  constraintKinds: readonly string[];
  constraintSeverities: readonly string[];
  adjustmentActions: readonly string[];
  evolutionPolicies: readonly string[];
}

export interface ImplementationGovernanceTaxonomyValidationIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
  path: string;
}

export interface ImplementationGovernanceTaxonomyValidationResult {
  valid: boolean;
  issues: readonly ImplementationGovernanceTaxonomyValidationIssue[];
}

export const DEFAULT_IMPLEMENTATION_GOVERNANCE_TAXONOMY: ImplementationGovernanceTaxonomy = {
  taxonomyId: 'implementation-governance',
  unitKinds: IMPLEMENTATION_GOVERNANCE_UNIT_KINDS,
  implementationSurfaceKinds: IMPLEMENTATION_SURFACE_KINDS,
  verificationSurfaceKinds: VERIFICATION_SURFACE_KINDS,
  constraintKinds: [
    'unit_boundary',
    'required_facets',
    'allowed_relations',
    'validation_surface',
    'evolution_rule',
  ],
  constraintSeverities: ['core', 'required', 'optional'],
  adjustmentActions: ['relax', 'split', 'defer', 'escalate'],
  evolutionPolicies: ['append_only', 'supersede', 'fork', 'merge'],
};

export interface GovernanceSurfaceRef<TKind extends string = string> {
  kind: TKind;
  ref: string;
}

export interface ConsistencyConstraint {
  kind: GovernanceVocabularyValue<ConsistencyConstraintKind>;
  severity?: GovernanceVocabularyValue<ConsistencyConstraintSeverity>;
  requiredRefs?: readonly string[];
  allowedRefs?: readonly string[];
  description?: string;
}

export interface AdjustmentPolicy {
  allowedActions: readonly GovernanceVocabularyValue<AdjustmentAction>[];
}

export interface EvolutionPolicy {
  kind: GovernanceVocabularyValue<EvolutionPolicyKind>;
}

export interface ImplementationBlueprint {
  blueprintId: string;
  coordinateRef: string;
  unitKind: ImplementationGovernanceUnitKind | string;
  requiredSchemas?: readonly string[];
  implementationBinding?: ImplementationBinding;
  verificationBinding?: VerificationBinding;
  constraints?: readonly ConsistencyConstraint[];
  adjustmentPolicy?: AdjustmentPolicy;
  evolutionPolicy?: EvolutionPolicy;
}

export interface ImplementationBinding {
  coordinateRef: string;
  implementationRefs: readonly GovernanceSurfaceRef<GovernanceVocabularyValue<ImplementationSurfaceKind>>[];
  facets?: readonly string[];
  relationCategories?: readonly string[];
}

export interface VerificationBinding {
  coordinateRef: string;
  verificationRefs: readonly GovernanceSurfaceRef<GovernanceVocabularyValue<VerificationSurfaceKind>>[];
}

export interface ConsistencyVerdict {
  valid: boolean;
  level: 'error' | 'warning';
  code: string;
  message: string;
  constraintKind: GovernanceVocabularyValue<ConsistencyConstraintKind>;
  refs: readonly string[];
}

export interface AdjustmentSuggestion {
  action: AdjustmentAction;
  constraintKind: GovernanceVocabularyValue<ConsistencyConstraintKind>;
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
  taxonomy?: ImplementationGovernanceTaxonomy;
  now?: string;
  runId?: string;
}

export interface ImplementationGovernanceEvaluationResult {
  valid: boolean;
  verdicts: readonly ConsistencyVerdict[];
  adjustments: readonly AdjustmentSuggestion[];
  governanceRun: GovernanceRun;
}

export interface PersistImplementationGovernanceRunOptions {
  now?: string;
  objectId?: string;
  schemaVersion?: string;
  lifecycle?: string;
  appendObservation?: boolean;
}

export interface PersistImplementationGovernanceRunResult {
  objectId: string;
  evidenceFacetVersion: string;
  statusFacetVersion: string;
  observationId?: string;
}

const DEFAULT_ADJUSTMENT_POLICY: AdjustmentPolicy = {
  allowedActions: ['relax', 'split', 'defer', 'escalate'],
};

const CORE_CONSTRAINT_KINDS = new Set<string>(
  DEFAULT_IMPLEMENTATION_GOVERNANCE_TAXONOMY.constraintKinds,
);

function createTaxonomyIssue(
  code: string,
  message: string,
  path: string,
): ImplementationGovernanceTaxonomyValidationIssue {
  return { level: 'error', code, message, path };
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

function validateTaxonomyAxis(
  taxonomy: ImplementationGovernanceTaxonomy,
  axisKey: keyof Omit<ImplementationGovernanceTaxonomy, 'taxonomyId'>,
): ImplementationGovernanceTaxonomyValidationIssue[] {
  const values = taxonomy[axisKey];
  const issues: ImplementationGovernanceTaxonomyValidationIssue[] = [];

  if (values.length === 0) {
    issues.push(
      createTaxonomyIssue(
        'governance-axis-empty',
        `Governance taxonomy axis "${axisKey}" must define at least one value`,
        `${taxonomy.taxonomyId}.${axisKey}`,
      ),
    );
  }

  for (const duplicate of duplicateValues(values)) {
    issues.push(
      createTaxonomyIssue(
        'governance-axis-duplicate',
        `Governance taxonomy axis "${axisKey}" contains duplicate value "${duplicate}"`,
        `${taxonomy.taxonomyId}.${axisKey}`,
      ),
    );
  }

  return issues;
}

export function validateImplementationGovernanceTaxonomy(
  taxonomy: ImplementationGovernanceTaxonomy = DEFAULT_IMPLEMENTATION_GOVERNANCE_TAXONOMY,
): ImplementationGovernanceTaxonomyValidationResult {
  const issues: ImplementationGovernanceTaxonomyValidationIssue[] = [];

  if (taxonomy.taxonomyId.trim().length === 0) {
    issues.push(
      createTaxonomyIssue(
        'governance-taxonomy-id-empty',
        'Governance taxonomy id must not be empty',
        'taxonomyId',
      ),
    );
  }

  issues.push(...validateTaxonomyAxis(taxonomy, 'unitKinds'));
  issues.push(...validateTaxonomyAxis(taxonomy, 'implementationSurfaceKinds'));
  issues.push(...validateTaxonomyAxis(taxonomy, 'verificationSurfaceKinds'));
  issues.push(...validateTaxonomyAxis(taxonomy, 'constraintKinds'));
  issues.push(...validateTaxonomyAxis(taxonomy, 'constraintSeverities'));
  issues.push(...validateTaxonomyAxis(taxonomy, 'adjustmentActions'));
  issues.push(...validateTaxonomyAxis(taxonomy, 'evolutionPolicies'));

  return {
    valid: issues.length === 0,
    issues,
  };
}

function createVerdict(
  code: string,
  message: string,
  constraintKind: GovernanceVocabularyValue<ConsistencyConstraintKind>,
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
  constraintKind: GovernanceVocabularyValue<ConsistencyConstraintKind>,
  reason: string,
  refs: readonly string[] = [],
): AdjustmentSuggestion {
  return { action, constraintKind, reason, refs };
}

function createEscalationForVerdict(verdict: ConsistencyVerdict): AdjustmentSuggestion {
  return createAdjustment('escalate', verdict.constraintKind, verdict.message, verdict.refs);
}

function hasValue(values: readonly string[], value: string | undefined): boolean {
  return typeof value === 'string' && values.includes(value);
}

function evaluateTaxonomyMembership(
  blueprint: ImplementationBlueprint,
  implementation: ImplementationBinding | undefined,
  verification: VerificationBinding | undefined,
  taxonomy: ImplementationGovernanceTaxonomy,
): ConsistencyVerdict[] {
  const verdicts: ConsistencyVerdict[] = [];

  if (!hasValue(taxonomy.unitKinds, blueprint.unitKind)) {
    verdicts.push(
      createVerdict(
        'governance-unit-kind-unknown',
        `Blueprint unit kind "${blueprint.unitKind}" is not in the governance taxonomy`,
        'unit_boundary',
        [blueprint.unitKind],
      ),
    );
  }

  for (const ref of implementation?.implementationRefs ?? []) {
    if (!hasValue(taxonomy.implementationSurfaceKinds, ref.kind)) {
      verdicts.push(
        createVerdict(
          'implementation-surface-kind-unknown',
          `Implementation surface kind "${ref.kind}" is not in the governance taxonomy`,
          'unit_boundary',
          [ref.kind, ref.ref],
        ),
      );
    }
  }

  for (const ref of verification?.verificationRefs ?? []) {
    if (!hasValue(taxonomy.verificationSurfaceKinds, ref.kind)) {
      verdicts.push(
        createVerdict(
          'verification-surface-kind-unknown',
          `Verification surface kind "${ref.kind}" is not in the governance taxonomy`,
          'validation_surface',
          [ref.kind, ref.ref],
        ),
      );
    }
  }

  for (const constraint of blueprint.constraints ?? []) {
    if (!hasValue(taxonomy.constraintKinds, constraint.kind)) {
      verdicts.push(
        createVerdict(
          'constraint-kind-unknown',
          `Constraint kind "${constraint.kind}" is not in the governance taxonomy`,
          constraint.kind,
          [constraint.kind],
        ),
      );
    }

    if (
      constraint.severity &&
      !hasValue(taxonomy.constraintSeverities, constraint.severity)
    ) {
      verdicts.push(
        createVerdict(
          'constraint-severity-unknown',
          `Constraint severity "${constraint.severity}" is not in the governance taxonomy`,
          constraint.kind,
          [constraint.severity],
        ),
      );
    }
  }

  for (const action of blueprint.adjustmentPolicy?.allowedActions ?? []) {
    if (!hasValue(taxonomy.adjustmentActions, action)) {
      verdicts.push(
        createVerdict(
          'adjustment-action-unknown',
          `Adjustment action "${action}" is not in the governance taxonomy`,
          'evolution_rule',
          [action],
        ),
      );
    }
  }

  if (
    blueprint.evolutionPolicy &&
    !hasValue(taxonomy.evolutionPolicies, blueprint.evolutionPolicy.kind)
  ) {
    verdicts.push(
      createVerdict(
        'evolution-policy-unknown',
        `Evolution policy "${blueprint.evolutionPolicy.kind}" is not in the governance taxonomy`,
        'evolution_rule',
        [blueprint.evolutionPolicy.kind],
      ),
    );
  }

  return verdicts;
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

  if (!CORE_CONSTRAINT_KINDS.has(constraint.kind)) {
    return [];
  }

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
  const taxonomy = input.taxonomy ?? DEFAULT_IMPLEMENTATION_GOVERNANCE_TAXONOMY;
  const verdicts: ConsistencyVerdict[] = [];
  const adjustments: AdjustmentSuggestion[] = [];
  const knownSchemaIds = schemaIds(input.schema);
  const taxonomyValidation = validateImplementationGovernanceTaxonomy(taxonomy);

  verdicts.push(
    ...taxonomyValidation.issues.map((issue) =>
      createVerdict(issue.code, issue.message, 'unit_boundary', [issue.path]),
    ),
  );
  verdicts.push(
    ...evaluateTaxonomyMembership(blueprint, implementation, verification, taxonomy),
  );

  for (const verdict of verdicts.filter(
    (item) =>
      !item.valid &&
      [
        'governance-axis-empty',
        'governance-axis-duplicate',
        'governance-taxonomy-id-empty',
        'governance-unit-kind-unknown',
        'implementation-surface-kind-unknown',
        'verification-surface-kind-unknown',
        'constraint-kind-unknown',
        'constraint-severity-unknown',
        'adjustment-action-unknown',
        'evolution-policy-unknown',
      ].includes(item.code),
  )) {
    adjustments.push(createEscalationForVerdict(verdict));
  }

  for (const schemaId of blueprint.requiredSchemas ?? []) {
    if (!input.schema) {
      verdicts.push(
        createVerdict(
          'required-schema-registry-missing',
          `Blueprint requires schema "${schemaId}" but no schema registry was provided`,
          'unit_boundary',
          [schemaId],
        ),
      );
      adjustments.push(
        createAdjustment(
          'escalate',
          'unit_boundary',
          `Blueprint requires schema "${schemaId}" but no schema registry was provided`,
          [schemaId],
        ),
      );
    } else if (!knownSchemaIds.has(schemaId)) {
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

export async function persistImplementationGovernanceRun(
  store: Pick<OperationalOntologyStore, 'upsertObject' | 'putFacet' | 'appendObservation'>,
  run: GovernanceRun,
  options: PersistImplementationGovernanceRunOptions = {},
): Promise<PersistImplementationGovernanceRunResult> {
  const now = options.now ?? new Date().toISOString();
  const objectId = options.objectId ?? run.runId;
  const schemaVersion = options.schemaVersion ?? 'v1';
  const state = run.constraintVerdicts.every((verdict) => verdict.valid) ? 'passed' : 'failed';
  const lifecycle = options.lifecycle ?? 'active';
  const evidenceFacetVersion = `${schemaVersion}:evidence`;
  const statusFacetVersion = `${schemaVersion}:status`;

  await store.upsertObject({
    objectId,
    objectKind: 'governance_run',
    canonicalKey: `${run.familyKey}:${run.runId}`,
    schemaVersion,
    lifecycle,
    createdAt: now,
    updatedAt: now,
  });

  await store.putFacet({
    objectId,
    facetKind: 'evidence',
    version: evidenceFacetVersion,
    payloadJson: {
      implementationRefs: run.implementationRefs,
      verificationRefs: run.verificationRefs,
      constraintVerdicts: run.constraintVerdicts,
      adjustmentRecords: run.adjustmentRecords,
    },
    recordedAt: now,
  });

  await store.putFacet({
    objectId,
    facetKind: 'status',
    version: statusFacetVersion,
    payloadJson: {
      state,
      reason: state === 'passed' ? 'All governance constraints passed' : 'Governance constraints failed',
    },
    recordedAt: now,
  });

  await store.putFacet({
    objectId,
    facetKind: 'aggregate',
    version: `${schemaVersion}:aggregate`,
    payloadJson: {
      adjustmentCount: run.adjustmentRecords.length,
      verdictCount: run.constraintVerdicts.length,
    },
    recordedAt: now,
  });

  if (options.appendObservation ?? true) {
    const observationId = `observation:${objectId}:${now}`;
    await store.appendObservation({
      observationId,
      targetObjectId: objectId,
      observationKind: 'governance_evaluated',
      payloadJson: {
        blueprintId: run.blueprintId,
        familyKey: run.familyKey,
        state,
        adjustmentCount: run.adjustmentRecords.length,
      },
      observedAt: now,
    });

    return { objectId, evidenceFacetVersion, statusFacetVersion, observationId };
  }

  return { objectId, evidenceFacetVersion, statusFacetVersion };
}
