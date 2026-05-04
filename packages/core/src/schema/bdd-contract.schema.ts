// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { z } from "zod";
import {
  BDD_CONTRACT_KINDS,
  BDD_IMPLEMENTATION_UNIT_KINDS,
  BDD_MODES,
  BDD_TEST_LEVELS,
} from "../types/bdd-contract.js";

const keyMap: Readonly<Record<string, string>> = {
  bdd_contract: "bddContract",
  bdd_contracts: "bddContracts",
  test_unit: "testUnit",
  test_units: "testUnits",
  implementation_unit: "implementationUnit",
  implementation_units: "implementationUnits",
  owner_system: "ownerSystem",
  contract_kind: "contractKind",
  state_component: "stateComponent",
  transition_ref: "transitionRef",
  event_key: "eventKey",
  given_fixture: "givenFixture",
  test_file: "testFile",
  unit_kind: "unitKind",
  owned_by: "ownedBy",
  source_target: "sourceTarget",
  must_not_own: "mustNotOwn",
};

function normalizeKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeKeys);
  if (!value || typeof value !== "object") return value;

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[keyMap[key] ?? key] = normalizeKeys(item);
  }
  return result;
}

function optionalNonEmptyStringArray() {
  return z.array(z.string().min(1)).optional();
}

export const bddContractKindSchema = z.enum(BDD_CONTRACT_KINDS);
export const bddModeSchema = z.enum(BDD_MODES);

export const bddContractLinksSchema = z.object({
  spec: z.string().min(1).optional(),
  provider: z.string().min(1).optional(),
  stateComponent: z.string().min(1).optional(),
  transitionRef: z.string().min(1).optional(),
}).strict();

export const bddGivenSchema = z.object({
  stateComponent: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  predicates: optionalNonEmptyStringArray(),
  fixtures: optionalNonEmptyStringArray(),
}).strict();

export const bddWhenSchema = z.object({
  actor: z.string().min(1).optional(),
  operation: z.string().min(1).optional(),
  eventKey: z.string().min(1).optional(),
  transitionRef: z.string().min(1).optional(),
  input: z.record(z.unknown()).optional(),
}).strict();

export const bddEgressAssertionSchema = z.object({
  axis: z.string().min(1),
  value: z.unknown().optional(),
  ref: z.string().min(1).optional(),
}).strict();

export const bddThenErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1).optional(),
}).strict();

export const bddThenSchema = z.object({
  state: z.string().min(1).optional(),
  returns: z.record(z.unknown()).optional(),
  emits: optionalNonEmptyStringArray(),
  egress: z.array(bddEgressAssertionSchema).optional(),
  invariants: optionalNonEmptyStringArray(),
  error: bddThenErrorSchema.optional(),
}).strict();

export const bddContractSchema = z.preprocess(
  normalizeKeys,
  z.object({
    id: z.string().min(1),
    ownerSystem: z.string().min(1),
    contractKind: bddContractKindSchema,
    mode: bddModeSchema,
    links: bddContractLinksSchema.optional(),
    given: bddGivenSchema,
    when: bddWhenSchema,
    // BDD vocabulary: `then` is a clause name, not a Promise#then handler.
    // oxlint-disable-next-line unicorn/no-thenable
    then: bddThenSchema,
  }).strict().superRefine((value, ctx) => {
    if (value.contractKind === "state-transition") {
      if (!value.given.state) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["given", "state"],
          message: "state-transition requires given.state",
        });
      }
      if (!value.then.state) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["then", "state"],
          message: "state-transition requires then.state",
        });
      }
    }
    if (value.contractKind === "validation-failure" && !value.then.error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["then", "error"],
        message: "validation-failure requires then.error",
      });
    }
  }),
);

export const bddTestLevelSchema = z.enum(BDD_TEST_LEVELS);

export const bddTestUnitSchema = z.preprocess(
  normalizeKeys,
  z.object({
    id: z.string().min(1),
    contract: z.string().min(1),
    level: bddTestLevelSchema,
    givenFixture: z.string().min(1).optional(),
    when: z.string().min(1).optional(),
    assertions: z.array(z.string().min(1)).default([]),
    testFile: z.string().min(1).optional(),
  }).strict(),
);

export const bddImplementationUnitKindSchema =
  z.enum(BDD_IMPLEMENTATION_UNIT_KINDS);

export const bddImplementationUnitSchema = z.preprocess(
  normalizeKeys,
  z.object({
    id: z.string().min(1),
    contract: z.string().min(1),
    unitKind: bddImplementationUnitKindSchema,
    ownedBy: z.string().min(1),
    sourceTarget: z.string().min(1).optional(),
    inputs: optionalNonEmptyStringArray(),
    effects: optionalNonEmptyStringArray(),
    mustNotOwn: optionalNonEmptyStringArray(),
  }).strict(),
);

function arrayOrSingleton<T extends z.ZodTypeAny>(schema: T) {
  return z.union([schema, z.array(schema)])
    .optional()
    .transform((value) => {
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    });
}

export const bddContractBlockSchema = z.preprocess(
  normalizeKeys,
  z.object({
    bddContract: arrayOrSingleton(bddContractSchema),
    bddContracts: arrayOrSingleton(bddContractSchema),
    testUnit: arrayOrSingleton(bddTestUnitSchema),
    testUnits: arrayOrSingleton(bddTestUnitSchema),
    implementationUnit: arrayOrSingleton(bddImplementationUnitSchema),
    implementationUnits: arrayOrSingleton(bddImplementationUnitSchema),
  }).strict().transform((value) => ({
    contracts: [...value.bddContract, ...value.bddContracts],
    testUnits: [...value.testUnit, ...value.testUnits],
    implementationUnits: [
      ...value.implementationUnit,
      ...value.implementationUnits,
    ],
  })).refine(
    (value) =>
      value.contracts.length > 0 ||
      value.testUnits.length > 0 ||
      value.implementationUnits.length > 0,
    { message: "BDD block must contain at least one contract or unit" },
  ),
);
