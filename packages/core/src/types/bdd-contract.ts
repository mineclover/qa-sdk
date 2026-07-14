// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

export const BDD_CONTRACT_KINDS = [
  'state-transition',
  'query-projection',
  'event-reaction',
  'validation-failure',
  'dependency-contract',
] as const;

export type BddContractKind = (typeof BDD_CONTRACT_KINDS)[number];

export const BDD_MODES = ['read', 'write'] as const;

export type BddMode = (typeof BDD_MODES)[number];

export interface BddContractLinks {
  readonly spec?: string;
  readonly provider?: string;
  readonly stateComponent?: string;
  readonly transitionRef?: string;
}

export interface BddGiven {
  readonly stateComponent?: string;
  readonly state?: string;
  readonly predicates?: readonly string[];
  readonly fixtures?: readonly string[];
}

export interface BddWhen {
  readonly actor?: string;
  readonly operation?: string;
  readonly eventKey?: string;
  readonly transitionRef?: string;
  readonly input?: Readonly<Record<string, unknown>>;
}

export interface BddEgressAssertion {
  readonly axis: string;
  readonly value?: unknown;
  readonly ref?: string;
}

export interface BddThenError {
  readonly code: string;
  readonly message?: string;
}

export interface BddThen {
  readonly state?: string;
  readonly returns?: Readonly<Record<string, unknown>>;
  readonly emits?: readonly string[];
  readonly egress?: readonly BddEgressAssertion[];
  readonly invariants?: readonly string[];
  readonly error?: BddThenError;
}

export interface BddContract {
  readonly id: string;
  readonly ownerSystem: string;
  readonly contractKind: BddContractKind;
  readonly mode: BddMode;
  readonly links?: BddContractLinks;
  readonly given: BddGiven;
  readonly when: BddWhen;
  readonly then: BddThen;
}

export const BDD_TEST_LEVELS = ['unit', 'integration', 'e2e'] as const;

export type BddTestLevel = (typeof BDD_TEST_LEVELS)[number];

export interface BddTestUnit {
  readonly id: string;
  readonly contract: string;
  readonly level: BddTestLevel;
  readonly givenFixture?: string;
  readonly when?: string;
  readonly assertions: readonly string[];
  readonly testFile?: string;
}

export const BDD_IMPLEMENTATION_UNIT_KINDS = [
  'guard',
  'operation',
  'transition',
  'emitter',
  'repository',
  'projection',
  'event-handler',
] as const;

export type BddImplementationUnitKind = (typeof BDD_IMPLEMENTATION_UNIT_KINDS)[number];

export interface BddImplementationUnit {
  readonly id: string;
  readonly contract: string;
  readonly unitKind: BddImplementationUnitKind;
  readonly ownedBy: string;
  readonly sourceTarget?: string;
  readonly inputs?: readonly string[];
  readonly effects?: readonly string[];
  readonly mustNotOwn?: readonly string[];
}

export interface BddContractBlock {
  readonly contracts: readonly BddContract[];
  readonly testUnits: readonly BddTestUnit[];
  readonly implementationUnits: readonly BddImplementationUnit[];
}
