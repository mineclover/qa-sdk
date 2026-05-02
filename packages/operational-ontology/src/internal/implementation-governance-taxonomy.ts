import {
  IMPLEMENTATION_GOVERNANCE_UNIT_KINDS,
  IMPLEMENTATION_SURFACE_KINDS,
  VERIFICATION_SURFACE_KINDS,
  type ImplementationGovernanceTaxonomy,
  type ImplementationGovernanceTaxonomyValidationIssue,
  type ImplementationGovernanceTaxonomyValidationResult,
} from './implementation-governance-types.js';

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
