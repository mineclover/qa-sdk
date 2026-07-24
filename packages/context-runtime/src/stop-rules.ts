import {
  ContextRuntimeError,
  type ContextStopObligation,
  type ContextStopPolicy,
  type StopDecision,
  type StopEvaluationInput,
  type StopProgress,
  type ValidationIssue,
  type ValidationResult,
} from './types.js';

export const DEFAULT_NO_PROGRESS_LIMIT = 2 as const;

/** Validate a stop policy without coupling it to Discovery or Working. */
export function validateStopPolicy(policy: ContextStopPolicy): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!Array.isArray(policy.obligations) || policy.obligations.length === 0) {
    issues.push({
      code: 'stop-policy-obligations-empty',
      path: 'obligations',
      message: 'StopPolicy requires at least one obligation',
    });
  }

  const seen = new Set<string>();
  policy.obligations.forEach((obligation, index) => {
    if (
      obligation.kind !== 'route' &&
      obligation.kind !== 'fact' &&
      obligation.kind !== 'evidence'
    ) {
      issues.push({
        code: 'stop-policy-kind-invalid',
        path: `obligations[${index}].kind`,
        message: 'StopPolicy obligation kind must be route, fact, or evidence',
      });
    }
    if (!obligation.key.trim()) {
      issues.push({
        code: 'stop-policy-key-empty',
        path: `obligations[${index}].key`,
        message: 'StopPolicy obligation key is required',
      });
    }
    const identity = `${obligation.kind}:${obligation.key}`;
    if (seen.has(identity)) {
      issues.push({
        code: 'stop-policy-obligation-duplicate',
        path: `obligations[${index}]`,
        message: `StopPolicy obligation ${identity} appears more than once`,
      });
    }
    seen.add(identity);
  });

  if (
    policy.noProgressLimit !== undefined &&
    (!Number.isInteger(policy.noProgressLimit) || policy.noProgressLimit < 1)
  ) {
    issues.push({
      code: 'stop-policy-no-progress-limit-invalid',
      path: 'noProgressLimit',
      message: 'noProgressLimit must be a positive integer',
    });
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Evaluate a StopPolicy from explicit route/fact/evidence keys.
 *
 * No subjective relevance or percentage score is inferred here. A semantic
 * coverage stop is valid only when every declared obligation is satisfied.
 */
export function evaluateStopDecision(input: StopEvaluationInput): StopDecision | undefined {
  const validation = validateStopPolicy(input.policy);
  if (!validation.valid) {
    throw new ContextRuntimeError(
      'invalid-context-adapter',
      'StopPolicy is invalid',
      validation.issues,
    );
  }

  const progress = normalizeProgress(input.progress);
  const selectedRoutes = new Set(input.selectedRouteKeys);
  const facts = new Set((input.resolvedFacts ?? []).map((fact) => fact.factKey));
  const evidence = new Set([
    ...(input.evidenceRefs ?? []),
    ...(input.resolvedFacts ?? []).flatMap((fact) => fact.evidenceRefs),
  ]);
  const satisfiedObligations = input.policy.obligations.filter((obligation) =>
    isSatisfied(obligation, selectedRoutes, facts, evidence),
  );
  const unresolvedObligations = input.policy.obligations.filter(
    (obligation) => !isSatisfied(obligation, selectedRoutes, facts, evidence),
  );
  const common = {
    satisfiedObligations: freezeObligations(satisfiedObligations),
    unresolvedObligations: freezeObligations(unresolvedObligations),
    progress: freezeProgress(progress),
  };

  if (input.hardStopReason) {
    return freezeDecision({
      ...common,
      reason: input.hardStopReason,
      action: unresolvedObligations.length > 0 ? 'block' : 'freeze',
    });
  }

  if (unresolvedObligations.length === 0) {
    return freezeDecision({
      ...common,
      reason: 'coverage-satisfied',
      action: 'freeze',
    });
  }

  const noProgressLimit = input.policy.noProgressLimit ?? DEFAULT_NO_PROGRESS_LIMIT;
  if ((input.consecutiveNoProgress ?? 0) >= noProgressLimit) {
    return freezeDecision({
      ...common,
      reason: 'no-progress',
      action: 'block',
    });
  }

  if (input.sourceExhausted) {
    return freezeDecision({
      ...common,
      reason: 'source-exhausted',
      action: 'block',
    });
  }

  return undefined;
}

export function assertValidStopPolicy(
  policy: ContextStopPolicy,
  errorCode:
    | 'invalid-discovery-plan'
    | 'invalid-working-context'
    | 'invalid-context-adapter' = 'invalid-context-adapter',
): void {
  const validation = validateStopPolicy(policy);
  if (!validation.valid) {
    throw new ContextRuntimeError(errorCode, 'StopPolicy is invalid', validation.issues);
  }
}

export function isProgressEmpty(progress: StopProgress): boolean {
  return progress.newRoutes === 0 && progress.newFacts === 0 && progress.newEvidenceRefs === 0;
}

function isSatisfied(
  obligation: ContextStopObligation,
  selectedRoutes: ReadonlySet<string>,
  facts: ReadonlySet<string>,
  evidence: ReadonlySet<string>,
): boolean {
  if (obligation.kind === 'route') return selectedRoutes.has(obligation.key);
  if (obligation.kind === 'fact') return facts.has(obligation.key);
  return evidence.has(obligation.key);
}

function normalizeProgress(progress: StopProgress | undefined): StopProgress {
  const normalized = progress ?? { newRoutes: 0, newFacts: 0, newEvidenceRefs: 0 };
  for (const field of ['newRoutes', 'newFacts', 'newEvidenceRefs'] as const) {
    if (!Number.isInteger(normalized[field]) || normalized[field] < 0) {
      throw new ContextRuntimeError('invalid-context-adapter', 'StopProgress is invalid', [
        {
          code: 'stop-progress-invalid',
          path: field,
          message: `${field} must be a non-negative integer`,
        },
      ]);
    }
  }
  return normalized;
}

function freezeObligations(
  obligations: readonly ContextStopObligation[],
): readonly ContextStopObligation[] {
  return Object.freeze(
    obligations.map((obligation) => Object.freeze({ kind: obligation.kind, key: obligation.key })),
  );
}

function freezeProgress(progress: StopProgress): StopProgress {
  return Object.freeze({ ...progress });
}

function freezeDecision(decision: Omit<StopDecision, never>): StopDecision {
  return Object.freeze(decision);
}
