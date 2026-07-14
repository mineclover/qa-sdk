// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import type { BddContract, BddEgressAssertion } from '../types/bdd-contract.js';
import type {
  EntryCondition,
  ScenarioSpec,
  ScenarioStep,
  StepConstraint,
} from '../types/scenario.js';
import type {
  Constraint,
  PipeConnection,
  PipeFlow,
  PipeGraph,
  PipeSpec,
  PipeStep,
} from '../types/pipe-spec.js';

export interface BddScenarioCompileOptions {
  readonly version?: string;
  readonly source?: string;
}

export interface BddScenarioCompileIssue {
  readonly severity: 'warning' | 'error';
  readonly code: string;
  readonly contractId: string;
  readonly message: string;
}

export interface BddScenarioCompileResult {
  readonly scenarios: readonly ScenarioSpec[];
  readonly issues: readonly BddScenarioCompileIssue[];
}

export interface BddPipeGraphCompileResult {
  readonly graphs: readonly PipeGraph[];
  readonly issues: readonly BddScenarioCompileIssue[];
}

export function compileBddContractToScenarioSpec(
  contract: BddContract,
  options: BddScenarioCompileOptions = {},
): ScenarioSpec {
  const entryConditions = compileEntryConditions(contract);
  const step = compileScenarioStep(contract, options);
  return {
    scenario_id: contract.id,
    version: options.version ?? inferContractVersion(contract.id),
    domain: contract.ownerSystem,
    description: `BDD ${contract.contractKind} ${contract.mode}: ${contract.id}`,
    ...(entryConditions.length > 0 ? { entry_conditions: entryConditions } : {}),
    steps: [step],
  };
}

export function compileBddContractsToScenarioSpecs(
  contracts: readonly BddContract[],
  options: BddScenarioCompileOptions = {},
): BddScenarioCompileResult {
  const issues = contracts.flatMap(validateCompileReady);
  return {
    scenarios: contracts.map((contract) => compileBddContractToScenarioSpec(contract, options)),
    issues,
  };
}

export function compileBddContractToPipeGraph(
  contract: BddContract,
  options: BddScenarioCompileOptions = {},
): PipeGraph {
  return scenarioSpecToPipeGraph(compileBddContractToScenarioSpec(contract, options));
}

export function compileBddContractsToPipeGraphs(
  contracts: readonly BddContract[],
  options: BddScenarioCompileOptions = {},
): BddPipeGraphCompileResult {
  const compiled = compileBddContractsToScenarioSpecs(contracts, options);
  return {
    graphs: compiled.scenarios.map(scenarioSpecToPipeGraph),
    issues: compiled.issues,
  };
}

function compileEntryConditions(contract: BddContract): EntryCondition[] {
  const conditions: EntryCondition[] = [];
  if (contract.given.state) {
    conditions.push({
      field: 'payload.state',
      op: 'eq',
      value: contract.given.state,
    });
  }
  for (const predicate of contract.given.predicates ?? []) {
    conditions.push(predicateToEntryCondition(predicate));
  }
  return conditions;
}

function predicateToEntryCondition(predicate: string): EntryCondition {
  if (predicate.startsWith('!')) {
    return {
      field: `payload.predicate.${predicate.slice(1)}`,
      op: 'neq',
      value: true,
    };
  }
  return {
    field: `payload.predicate.${predicate}`,
    op: 'eq',
    value: true,
  };
}

function compileScenarioStep(
  contract: BddContract,
  options: BddScenarioCompileOptions,
): ScenarioStep {
  const constraints = compileStepConstraints(contract);
  return {
    id: 'when',
    event_key: contract.when.eventKey ?? contract.when.operation ?? contract.id,
    ...(options.source ? { source: options.source } : {}),
    required: true,
    kind: 'sequence',
    ...(constraints.length > 0 ? { constraints } : {}),
  };
}

function compileStepConstraints(contract: BddContract): StepConstraint[] {
  const constraints: StepConstraint[] = [];
  if (contract.when.actor) {
    constraints.push({ field: 'payload.actor', op: 'eq', value: contract.when.actor });
  }
  if (contract.when.operation) {
    constraints.push({
      field: 'payload.operation',
      op: 'eq',
      value: contract.when.operation,
    });
  }
  if (contract.then.state) {
    constraints.push({ field: 'payload.state', op: 'eq', value: contract.then.state });
  }
  for (const eventKey of contract.then.emits ?? []) {
    constraints.push({ field: 'payload.emits', op: 'contains', value: eventKey });
  }
  for (const [key, value] of Object.entries(contract.then.returns ?? {})) {
    constraints.push({ field: `payload.return.${key}`, op: 'eq', value });
  }
  for (const egress of contract.then.egress ?? []) {
    constraints.push(egressToConstraint(egress));
  }
  if (contract.then.error) {
    constraints.push({
      field: 'payload.error.code',
      op: 'eq',
      value: contract.then.error.code,
    });
  }
  return constraints;
}

function egressToConstraint(egress: BddEgressAssertion): StepConstraint {
  if (egress.value !== undefined) {
    return {
      field: `payload.egress.${egress.axis}`,
      op: 'eq',
      value: egress.value,
    };
  }
  if (egress.ref) {
    return {
      field: `payload.egress.${egress.axis}`,
      op: 'eq',
      value: egress.ref,
    };
  }
  return {
    field: `payload.egress.${egress.axis}`,
    op: 'exists',
  };
}

function inferContractVersion(contractId: string): string {
  const match = contractId.match(/(?:^|\.)v([A-Za-z0-9_-]+)$/);
  return match?.[1] ?? '1';
}

function validateCompileReady(contract: BddContract): BddScenarioCompileIssue[] {
  const issues: BddScenarioCompileIssue[] = [];
  if (!contract.when.eventKey && !contract.when.operation) {
    issues.push({
      severity: 'warning',
      code: 'bdd-scenario-missing-event-or-operation',
      contractId: contract.id,
      message:
        'BDD contract has neither when.event_key nor when.operation; event_key falls back to contract id.',
    });
  }
  if (contract.contractKind === 'state-transition' && !contract.then.state) {
    issues.push({
      severity: 'error',
      code: 'bdd-scenario-state-transition-missing-target',
      contractId: contract.id,
      message: 'state-transition contract requires then.state before ScenarioSpec compile.',
    });
  }
  if (contract.contractKind === 'validation-failure' && !contract.then.error) {
    issues.push({
      severity: 'error',
      code: 'bdd-scenario-validation-failure-missing-error',
      contractId: contract.id,
      message: 'validation-failure contract requires then.error before ScenarioSpec compile.',
    });
  }
  return issues;
}

function scenarioSpecToPipeGraph(spec: ScenarioSpec): PipeGraph {
  if (spec.steps.length === 0) {
    return {
      graphId: spec.scenario_id,
      version: spec.version,
      ...(spec.description ? { description: spec.description } : {}),
      pipes: [],
      connections: [],
      entryPipeId: '',
    };
  }

  const pipes: PipeSpec[] = spec.steps.map((step, index) => ({
    pipeId: step.id,
    version: spec.version,
    trigger: {
      eventKey: step.event_key,
      ...(index === 0 && spec.entry_conditions?.length
        ? { entryConditions: spec.entry_conditions.map(entryConditionToConstraint) }
        : {}),
    },
    flow: scenarioStepToFlow(step),
  }));

  return {
    graphId: spec.scenario_id,
    version: spec.version,
    ...(spec.description ? { description: spec.description } : {}),
    pipes,
    connections: scenarioStepsToConnections(spec.steps),
    entryPipeId: spec.steps[0]?.id ?? '',
  };
}

function scenarioStepToFlow(step: ScenarioStep): PipeFlow {
  const base: PipeStep = {
    kind: 'step',
    facet: step.event_key,
    eventKey: step.event_key,
    ...(step.constraints?.length
      ? { constraints: step.constraints.map(stepConstraintToConstraint) }
      : {}),
    ...(step.timeout_ms !== undefined ? { timeout: step.timeout_ms } : {}),
  };
  if (step.kind === 'optional') {
    return { kind: 'optional', step: base };
  }
  return base;
}

function scenarioStepsToConnections(steps: readonly ScenarioStep[]): PipeConnection[] {
  const hasExplicit = steps.some((step) => step.next?.length || step.branches?.length);
  if (!hasExplicit) {
    return steps.slice(0, -1).map((step, index) => ({
      from: step.id,
      to: steps[index + 1]?.id ?? '',
      kind: 'next' as const,
    }));
  }

  const connections: PipeConnection[] = [];
  for (const step of steps) {
    if (step.branches?.length) {
      for (const branch of step.branches) {
        connections.push({
          from: step.id,
          to: branch.next.length === 1 ? (branch.next[0] ?? '') : [...branch.next],
          kind: 'conditional',
          condition: formatConstraint(branch.condition),
        });
      }
    } else if (step.next?.length) {
      connections.push({
        from: step.id,
        to: step.next.length === 1 ? (step.next[0] ?? '') : [...step.next],
        kind: 'next',
      });
    }
  }
  return connections;
}

function entryConditionToConstraint(condition: EntryCondition): Constraint {
  return {
    field: condition.field,
    op: condition.op,
    ...(condition.value !== undefined ? { value: condition.value } : {}),
  };
}

function stepConstraintToConstraint(constraint: StepConstraint): Constraint {
  return {
    field: constraint.field,
    op: constraint.op,
    ...(constraint.value !== undefined ? { value: constraint.value } : {}),
  };
}

function formatConstraint(constraint: StepConstraint): string {
  const value = constraint.value !== undefined ? ` ${JSON.stringify(constraint.value)}` : '';
  return `${constraint.field} ${constraint.op}${value}`;
}
