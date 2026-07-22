import { ContextRuntimeError, type ClosureDiagnostic, type ContextRoute, type OutputContract, type ResolutionRoute, type RouteSelection, type ValidationIssue, type WorkingContext, type WorkingContextCompileInput } from './types.js';
import { validateWorkingClosure } from './closure.js';
import { validateRouteSet } from './routes.js';

export function compileWorkingContext(input: WorkingContextCompileInput): WorkingContext {
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

  const closure = validateWorkingClosure({
    requiredFacts: input.requiredFacts,
    resolutionRoutes: selectedResolutionRoutes,
    resolvedFacts: input.resolvedFacts,
    now: input.now,
  });
  diagnostics.push(...closure.diagnostics);

  const closed = diagnostics.length === 0;
  const facts = closed
    ? input.requiredFacts.map((requiredFact) =>
        input.resolvedFacts.find((fact) => fact.factKey === requiredFact.factKey),
      ).filter((fact): fact is (typeof input.resolvedFacts)[number] => fact !== undefined)
    : [];

  return Object.freeze({
    status: closed ? 'closed' : 'blocked',
    taskKey: input.taskKey,
    routeSelection: freezeRouteSelection(input.routeSelection),
    facts: Object.freeze(facts),
    allowedOperations: Object.freeze([...input.allowedOperations]),
    outputContract: freezeOutputContract(input.outputContract),
    diagnostics: Object.freeze([...diagnostics]),
  });
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
  if (input.allowedOperations.length === 0 || input.allowedOperations.some((operation) => !operation.trim())) {
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
