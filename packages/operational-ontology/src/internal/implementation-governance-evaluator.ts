import type { OperationalOntologySchema, RelationCategorySchema } from './schema-core.js';
import {
  DEFAULT_IMPLEMENTATION_GOVERNANCE_TAXONOMY,
  validateImplementationGovernanceTaxonomy,
} from './implementation-governance-taxonomy.js';
import type {
  AdjustmentAction,
  AdjustmentPolicy,
  AdjustmentSuggestion,
  ConsistencyConstraint,
  ConsistencyConstraintKind,
  ConsistencyVerdict,
  GovernanceProposedChange,
  GovernanceProposedChangeKind,
  GovernanceVocabularyValue,
  ImplementationBinding,
  ImplementationBlueprint,
  ImplementationBlueprintValidationInput,
  ImplementationBlueprintValidationResult,
  ImplementationGovernanceEvaluationInput,
  ImplementationGovernanceEvaluationResult,
  ImplementationGovernanceTaxonomy,
  VerificationBinding,
} from './implementation-governance-types.js';

const DEFAULT_ADJUSTMENT_POLICY: AdjustmentPolicy = {
  allowedActions: ['relax', 'split', 'defer', 'escalate'],
};

const CORE_CONSTRAINT_KINDS = new Set<string>(
  DEFAULT_IMPLEMENTATION_GOVERNANCE_TAXONOMY.constraintKinds,
);

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

function proposedChangeKindForAction(
  action: GovernanceVocabularyValue<AdjustmentAction>,
): GovernanceProposedChangeKind {
  if (action === 'relax') return 'relax_constraint';
  if (action === 'split') return 'split_unit';
  if (action === 'defer') return 'defer_completion';
  if (action === 'escalate') return 'escalate_decision';
  return 'custom_adjustment';
}

function proposedChangeSummaryForAction(
  action: GovernanceVocabularyValue<AdjustmentAction>,
  constraintKind: GovernanceVocabularyValue<ConsistencyConstraintKind>,
): string {
  if (action === 'relax') return `Relax non-core ${constraintKind} constraint`;
  if (action === 'split') return `Split implementation or verification unit for ${constraintKind}`;
  if (action === 'defer') return `Defer ${constraintKind} completion to a follow-up governance run`;
  return `Escalate ${constraintKind} decision to governance owner`;
}

function createProposedChange(
  action: GovernanceVocabularyValue<AdjustmentAction>,
  constraintKind: GovernanceVocabularyValue<ConsistencyConstraintKind>,
  refs: readonly string[],
): GovernanceProposedChange {
  return {
    kind: proposedChangeKindForAction(action),
    summary: proposedChangeSummaryForAction(action, constraintKind),
    constraintKind,
    refs,
    targetRef: refs[0],
  };
}

function createAdjustment(
  action: GovernanceVocabularyValue<AdjustmentAction>,
  constraintKind: GovernanceVocabularyValue<ConsistencyConstraintKind>,
  reason: string,
  refs: readonly string[] = [],
): AdjustmentSuggestion {
  return {
    action,
    constraintKind,
    reason,
    refs,
    targetRef: refs[0],
    proposedChange: createProposedChange(action, constraintKind, refs),
    requiresDecision: action === 'escalate',
  };
}

function createEscalationForVerdict(verdict: ConsistencyVerdict): AdjustmentSuggestion {
  return createAdjustment('escalate', verdict.constraintKind, verdict.message, verdict.refs);
}

function isGovernanceTaxonomyVerdict(verdict: ConsistencyVerdict): boolean {
  return [
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
  ].includes(verdict.code);
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

function schemaIds(schema?: OperationalOntologySchema): Set<string> {
  return new Set([
    ...(schema?.axes ?? []).map((axis) => axis.id),
    ...(schema?.taxonomies ?? []).map((taxonomy) => taxonomy.id),
    ...(schema?.relationCategories ?? []).map((category) => category.category),
    ...(schema?.traversals ?? []).map((traversal) => traversal.purpose),
  ]);
}

function evaluateSchemaRequirements(
  blueprint: ImplementationBlueprint,
  schema?: OperationalOntologySchema,
): ConsistencyVerdict[] {
  const verdicts: ConsistencyVerdict[] = [];
  const knownSchemaIds = schemaIds(schema);

  for (const schemaId of blueprint.requiredSchemas ?? []) {
    if (!schema) {
      verdicts.push(
        createVerdict(
          'required-schema-registry-missing',
          `Blueprint requires schema "${schemaId}" but no schema registry was provided`,
          'unit_boundary',
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

  return verdicts;
}

export function validateImplementationBlueprint(
  input: ImplementationBlueprintValidationInput,
): ImplementationBlueprintValidationResult {
  const blueprint = input.blueprint;
  const taxonomy = input.taxonomy ?? DEFAULT_IMPLEMENTATION_GOVERNANCE_TAXONOMY;
  const taxonomyValidation = validateImplementationGovernanceTaxonomy(taxonomy);
  const verdicts: ConsistencyVerdict[] = [];
  const validateBindings = input.validateBindings ?? true;

  verdicts.push(
    ...taxonomyValidation.issues.map((issue) =>
      createVerdict(issue.code, issue.message, 'unit_boundary', [issue.path]),
    ),
  );
  verdicts.push(
    ...evaluateTaxonomyMembership(
      blueprint,
      validateBindings ? blueprint.implementationBinding : undefined,
      validateBindings ? blueprint.verificationBinding : undefined,
      taxonomy,
    ),
  );
  verdicts.push(...evaluateSchemaRequirements(blueprint, input.schema));

  if (!blueprint.blueprintId.trim()) {
    verdicts.push(
      createVerdict(
        'blueprint-id-empty',
        'Implementation governance blueprint id must not be empty',
        'unit_boundary',
      ),
    );
  }

  if (!blueprint.coordinateRef.trim()) {
    verdicts.push(
      createVerdict(
        'blueprint-coordinate-empty',
        'Implementation governance blueprint coordinateRef must not be empty',
        'unit_boundary',
      ),
    );
  }

  return {
    valid: verdicts.every((verdict) => verdict.valid),
    verdicts,
  };
}

function relationCategoryMap(
  schema?: OperationalOntologySchema,
): Map<string, RelationCategorySchema> {
  return new Map(
    (schema?.relationCategories ?? []).map((category) => [category.category, category]),
  );
}

function refsByKind<TKind extends string>(
  refs: readonly { kind: TKind }[],
): Set<string> {
  return new Set(refs.map((ref) => ref.kind));
}

function evaluateConstraint(
  constraint: ConsistencyConstraint,
  blueprint: ImplementationBlueprint,
  implementation: ImplementationBinding,
  verification: VerificationBinding,
  schema?: OperationalOntologySchema,
  customEvaluator?: (input: {
    constraint: ConsistencyConstraint;
    blueprint: ImplementationBlueprint;
    implementation: ImplementationBinding;
    verification: VerificationBinding;
    schema?: OperationalOntologySchema;
  }) => readonly ConsistencyVerdict[],
): readonly ConsistencyVerdict[] {
  const requiredRefs = constraint.requiredRefs ?? [];
  const allowedRefs = constraint.allowedRefs ?? [];

  if (!new Set(DEFAULT_IMPLEMENTATION_GOVERNANCE_TAXONOMY.constraintKinds).has(constraint.kind)) {
    if (customEvaluator) {
      return customEvaluator({ constraint, blueprint, implementation, verification, schema });
    }
    return [
      createVerdict(
        'unsupported-constraint-evaluator',
        `No evaluator is registered for governance constraint "${constraint.kind}"`,
        constraint.kind,
        [constraint.kind],
      ),
    ];
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
  const blueprintValidation = validateImplementationBlueprint({
    blueprint,
    schema: input.schema,
    taxonomy,
    validateBindings: !(input.implementationBinding || input.verificationBinding),
  });

  verdicts.push(...blueprintValidation.verdicts);
  if (input.implementationBinding || input.verificationBinding) {
    verdicts.push(
      ...evaluateTaxonomyMembership(blueprint, implementation, verification, taxonomy).filter(
        (verdict) =>
          verdict.code === 'implementation-surface-kind-unknown' ||
          verdict.code === 'verification-surface-kind-unknown',
      ),
    );
  }

  for (const verdict of verdicts.filter(
    (item) => !item.valid && isGovernanceTaxonomyVerdict(item),
  )) {
    adjustments.push(createEscalationForVerdict(verdict));
  }

  for (const verdict of verdicts.filter(
    (item) => !item.valid && item.code === 'required-schema-registry-missing',
  )) {
    adjustments.push(createEscalationForVerdict(verdict));
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
        input.constraintEvaluators?.[constraint.kind],
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
