import {
  ContextRuntimeError,
  type ClosureDiagnostic,
  type ContextRoute,
  type OutputContract,
  type ResolutionRoute,
  type RouteSelection,
  type ValidationIssue,
  type WorkingContext,
  type WorkingContextCompileInput,
} from './types.js';
import { validateWorkingClosure } from './closure.js';
import { validateRouteSet } from './routes.js';
import { assertValidStopPolicy, evaluateStopDecision } from './stop-rules.js';

export function compileWorkingContext(input: WorkingContextCompileInput): WorkingContext {
  if (input.stopPolicy) assertValidStopPolicy(input.stopPolicy, 'invalid-working-context');
  const inputIssues = validateWorkingContextInput(input);
  if (inputIssues.length > 0) {
    throw new ContextRuntimeError(
      'invalid-working-context',
      'Working Context input is invalid',
      inputIssues,
    );
  }

  const routeSetResult = validateRouteSet(input.routes);
  if (!routeSetResult.valid) {
    throw new ContextRuntimeError(
      'invalid-working-context',
      'Working Context contains invalid routes',
      routeSetResult.issues,
    );
  }

  const routeMap = new Map(input.routes.map((route) => [route.routeKey, route]));
  const selectionIssues = validateRouteSelection(input.routeSelection, routeMap);
  if (selectionIssues.length > 0) {
    throw new ContextRuntimeError(
      'invalid-working-context',
      'Working Context route selection is invalid',
      selectionIssues,
    );
  }

  const selectedResolutionRoutes = input.routeSelection.selectedRouteKeys
    .map((routeKey) => routeMap.get(routeKey))
    .filter(isResolutionRoute);
  const diagnostics: ClosureDiagnostic[] = input.requiredFacts
    .filter((requiredFact) => {
      const selectedRoute = input.routeSelection.selectedRouteKeys.includes(
        requiredFact.resolutionRouteKey,
      );
      return !selectedRoute;
    })
    .map((requiredFact) => ({
      code: 'route-not-selected' as const,
      factKey: requiredFact.factKey,
      message: `ResolutionRoute ${requiredFact.resolutionRouteKey} was not selected for Working Context`,
    }));

  if (
    input.workingUsageTokens !== undefined &&
    input.workingBudgetTokens !== undefined &&
    input.workingUsageTokens > input.workingBudgetTokens
  ) {
    diagnostics.push({
      code: 'working-budget-exhausted',
      factKey: '$context',
      message: `Working Context usage ${input.workingUsageTokens} exceeds reserved budget ${input.workingBudgetTokens}`,
    });
  }

  const closure = validateWorkingClosure({
    requiredFacts: input.requiredFacts,
    resolutionRoutes: selectedResolutionRoutes,
    resolvedFacts: input.resolvedFacts,
    now: input.now,
  });
  diagnostics.push(...closure.diagnostics);
  const closureInvalidFactKeys = new Set(
    closure.diagnostics.map((diagnostic) => diagnostic.factKey),
  );
  const validResolvedFacts = input.resolvedFacts.filter(
    (fact) => !closureInvalidFactKeys.has(fact.factKey),
  );

  const stopDecision = input.stopPolicy
    ? evaluateStopDecision({
        policy: input.stopPolicy,
        selectedRouteKeys: input.routeSelection.selectedRouteKeys,
        resolvedFacts: validResolvedFacts,
        evidenceRefs: validResolvedFacts.flatMap((fact) => fact.evidenceRefs),
        ...(input.workingUsageTokens !== undefined &&
        input.workingBudgetTokens !== undefined &&
        input.workingUsageTokens > input.workingBudgetTokens
          ? { hardStopReason: 'budget-exhausted' as const }
          : {}),
        sourceExhausted: input.requiredFacts.every((fact) =>
          input.routeSelection.selectedRouteKeys.includes(fact.resolutionRouteKey),
        ),
      })
    : undefined;
  if (input.stopPolicy) {
    const unresolved =
      stopDecision?.unresolvedObligations ??
      input.stopPolicy.obligations.filter(
        (obligation) =>
          !isStopObligationSatisfied(
            obligation,
            input.routeSelection.selectedRouteKeys,
            validResolvedFacts,
          ),
      );
    diagnostics.push(
      ...unresolved.map((obligation) => ({
        code: 'stop-obligation-unresolved' as const,
        factKey: `stop:${obligation.kind}:${obligation.key}`,
        message: `StopPolicy obligation ${obligation.kind}:${obligation.key} was not satisfied`,
      })),
    );
  }

  const closed = diagnostics.length === 0;
  const facts = closed
    ? input.requiredFacts
        .map((requiredFact) =>
          input.resolvedFacts.find((fact) => fact.factKey === requiredFact.factKey),
        )
        .filter((fact): fact is (typeof input.resolvedFacts)[number] => fact !== undefined)
    : [];

  return Object.freeze({
    status: closed ? 'closed' : 'blocked',
    taskKey: input.taskKey,
    routeSelection: freezeRouteSelection(input.routeSelection),
    facts: Object.freeze(facts),
    allowedOperations: Object.freeze([...input.allowedOperations]),
    outputContract: freezeOutputContract(input.outputContract),
    diagnostics: Object.freeze([...diagnostics]),
    ...(stopDecision ? { stopDecision } : {}),
  });
}

function isStopObligationSatisfied(
  obligation: NonNullable<WorkingContextCompileInput['stopPolicy']>['obligations'][number],
  selectedRouteKeys: readonly string[],
  resolvedFacts: readonly WorkingContextCompileInput['resolvedFacts'][number][],
): boolean {
  if (obligation.kind === 'route') return selectedRouteKeys.includes(obligation.key);
  if (obligation.kind === 'fact') {
    return resolvedFacts.some((fact) => fact.factKey === obligation.key);
  }
  return resolvedFacts.some((fact) => fact.evidenceRefs.includes(obligation.key));
}

export function assertWorkingContext(input: WorkingContextCompileInput): WorkingContext {
  const result = compileWorkingContext(input);
  if (result.status === 'blocked') {
    throw new ContextRuntimeError(
      'context-closure-incomplete',
      'Working Context closure is incomplete',
      result.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        path: diagnostic.factKey,
        message: diagnostic.message,
      })),
    );
  }
  return result;
}

function validateWorkingContextInput(input: WorkingContextCompileInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input.taskKey.trim()) {
    issues.push({
      code: 'task-key-empty',
      path: 'taskKey',
      message: 'taskKey is required',
    });
  }
  if (input.requiredFacts.length === 0) {
    issues.push({
      code: 'required-facts-empty',
      path: 'requiredFacts',
      message: 'Working Context requires at least one Fact',
    });
  }
  if (
    input.allowedOperations.length === 0 ||
    input.allowedOperations.some((operation) => !operation.trim())
  ) {
    issues.push({
      code: 'allowed-operations-invalid',
      path: 'allowedOperations',
      message: 'Working Context requires at least one non-empty allowed operation',
    });
  }
  issues.push(...validateOutputContract(input.outputContract));
  if (!input.routeSelection.frozenAt.trim()) {
    issues.push({
      code: 'route-selection-frozen-at-empty',
      path: 'routeSelection.frozenAt',
      message: 'routeSelection.frozenAt is required',
    });
  }
  if (!input.routeSelection.manifestDigest.trim()) {
    issues.push({
      code: 'route-selection-manifest-empty',
      path: 'routeSelection.manifestDigest',
      message: 'routeSelection.manifestDigest is required',
    });
  }
  for (const field of ['workingUsageTokens', 'workingBudgetTokens'] as const) {
    const value = input[field];
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      issues.push({
        code: 'working-usage-invalid',
        path: field,
        message: `${field} must be a non-negative integer`,
      });
    }
  }
  return issues;
}

function validateRouteSelection(
  routeSelection: RouteSelection,
  routeMap: ReadonlyMap<string, ContextRoute>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  routeSelection.selectedRouteKeys.forEach((routeKey, index) => {
    if (!routeMap.has(routeKey)) {
      issues.push({
        code: 'selected-route-unknown',
        path: `routeSelection.selectedRouteKeys[${index}]`,
        message: `Selected route ${routeKey} is not declared`,
      });
    }
    if (seen.has(routeKey)) {
      issues.push({
        code: 'selected-route-duplicate',
        path: `routeSelection.selectedRouteKeys[${index}]`,
        message: `Selected route ${routeKey} appears more than once`,
      });
    }
    seen.add(routeKey);
  });
  return issues;
}

function validateOutputContract(contract: OutputContract): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!contract.contractKey.trim()) {
    issues.push({
      code: 'output-contract-key-empty',
      path: 'outputContract.contractKey',
      message: 'outputContract.contractKey is required',
    });
  }
  if (!contract.description.trim()) {
    issues.push({
      code: 'output-contract-description-empty',
      path: 'outputContract.description',
      message: 'outputContract.description is required',
    });
  }
  if (contract.requiredFields.some((field) => !field.trim())) {
    issues.push({
      code: 'output-contract-fields-invalid',
      path: 'outputContract.requiredFields',
      message: 'outputContract.requiredFields must not contain empty fields',
    });
  }
  return issues;
}

function freezeRouteSelection(routeSelection: RouteSelection): RouteSelection {
  return Object.freeze({
    selectedRouteKeys: Object.freeze([...routeSelection.selectedRouteKeys]),
    frozenAt: routeSelection.frozenAt,
    manifestDigest: routeSelection.manifestDigest,
  });
}

function freezeOutputContract(contract: OutputContract): OutputContract {
  return Object.freeze({
    contractKey: contract.contractKey,
    description: contract.description,
    requiredFields: Object.freeze([...contract.requiredFields]),
  });
}

function isResolutionRoute(route: ContextRoute | undefined): route is ResolutionRoute {
  return route?.kind === 'resolution';
}
