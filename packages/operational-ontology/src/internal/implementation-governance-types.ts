import type { OperationalOntologySchema } from './schema-core.js';

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
  implementationRefs: readonly GovernanceSurfaceRef<
    GovernanceVocabularyValue<ImplementationSurfaceKind>
  >[];
  facets?: readonly string[];
  relationCategories?: readonly string[];
}

export interface VerificationBinding {
  coordinateRef: string;
  verificationRefs: readonly GovernanceSurfaceRef<
    GovernanceVocabularyValue<VerificationSurfaceKind>
  >[];
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
  action: GovernanceVocabularyValue<AdjustmentAction>;
  constraintKind: GovernanceVocabularyValue<ConsistencyConstraintKind>;
  reason: string;
  refs: readonly string[];
  targetRef?: string;
  proposedChange?: string;
  requiresDecision?: boolean;
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
  constraintEvaluators?: Partial<
    Record<
      string,
      (input: {
        constraint: ConsistencyConstraint;
        blueprint: ImplementationBlueprint;
        implementation: ImplementationBinding;
        verification: VerificationBinding;
        schema?: OperationalOntologySchema;
      }) => readonly ConsistencyVerdict[]
    >
  >;
  now?: string;
  runId?: string;
}

export interface ImplementationBlueprintValidationInput {
  blueprint: ImplementationBlueprint;
  schema?: OperationalOntologySchema;
  taxonomy?: ImplementationGovernanceTaxonomy;
  validateBindings?: boolean;
}

export interface ImplementationBlueprintValidationResult {
  valid: boolean;
  verdicts: readonly ConsistencyVerdict[];
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

export interface PersistImplementationGovernanceBlueprintOptions {
  now?: string;
  objectId?: string;
  schemaVersion?: string;
  lifecycle?: string;
  taxonomy?: ImplementationGovernanceTaxonomy;
  schema?: OperationalOntologySchema;
  allowInvalid?: boolean;
}

export interface PersistImplementationGovernanceBlueprintResult {
  objectId: string;
  schemaFacetVersion: string;
  validationFacetVersion: string;
  grammarFacetVersion?: string;
}
