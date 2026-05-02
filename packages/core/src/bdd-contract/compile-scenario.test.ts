// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, expect, it } from "vitest";
import { scenarioSpecSchema } from "../schema/scenario.schema.js";
import type { BddContract } from "../types/bdd-contract.js";
import {
  compileBddContractsToPipeGraphs,
  compileBddContractsToScenarioSpecs,
  compileBddContractToPipeGraph,
  compileBddContractToScenarioSpec,
} from "./compile-scenario.js";

const approvalContract: BddContract = {
  id: "approval-request.pending.approve.approved.v1",
  ownerSystem: "approval-system",
  contractKind: "state-transition",
  mode: "write",
  links: {
    spec: "approval-system",
    stateComponent: "approval-request-state",
  },
  given: {
    stateComponent: "approval-request-state",
    state: "PENDING",
    predicates: ["request.exists", "approver.has_permission"],
  },
  when: {
    actor: "approver",
    operation: "approval-system.approve",
    eventKey: "approval.approve.requested",
  },
  then: {
    state: "APPROVED",
    emits: ["approval.approved"],
    egress: [{ axis: "approval_request.status", value: "APPROVED" }],
  },
};

describe("compileBddContractToScenarioSpec", () => {
  it("compiles a BDD state transition to a valid ScenarioSpec", () => {
    const scenario = compileBddContractToScenarioSpec(approvalContract);

    expect(scenarioSpecSchema.safeParse(scenario).success).toBe(true);
    expect(scenario).toMatchObject({
      scenario_id: "approval-request.pending.approve.approved.v1",
      version: "1",
      domain: "approval-system",
      entry_conditions: [
        { field: "payload.state", op: "eq", value: "PENDING" },
        { field: "payload.predicate.request.exists", op: "eq", value: true },
        { field: "payload.predicate.approver.has_permission", op: "eq", value: true },
      ],
      steps: [
        {
          id: "when",
          event_key: "approval.approve.requested",
          required: true,
          kind: "sequence",
        },
      ],
    });
    expect(scenario.steps[0]?.constraints).toEqual([
      { field: "payload.actor", op: "eq", value: "approver" },
      { field: "payload.operation", op: "eq", value: "approval-system.approve" },
      { field: "payload.state", op: "eq", value: "APPROVED" },
      { field: "payload.emits", op: "contains", value: "approval.approved" },
      { field: "payload.egress.approval_request.status", op: "eq", value: "APPROVED" },
    ]);
  });

  it("compiles a validation failure contract to error constraints", () => {
    const scenario = compileBddContractToScenarioSpec({
      id: "approval-request.pending.approve.permission-denied.v1",
      ownerSystem: "approval-system",
      contractKind: "validation-failure",
      mode: "write",
      given: {
        state: "PENDING",
        predicates: ["!approver.has_permission"],
      },
      when: {
        operation: "approval-system.approve",
      },
      then: {
        error: { code: "permission_denied" },
      },
    });

    expect(scenarioSpecSchema.safeParse(scenario).success).toBe(true);
    expect(scenario.entry_conditions).toContainEqual({
      field: "payload.predicate.approver.has_permission",
      op: "neq",
      value: true,
    });
    expect(scenario.steps[0]?.event_key).toBe("approval-system.approve");
    expect(scenario.steps[0]?.constraints).toContainEqual({
      field: "payload.error.code",
      op: "eq",
      value: "permission_denied",
    });
  });

  it("infers version only from the final .v segment", () => {
    const scenario = compileBddContractToScenarioSpec({
      id: "docs-control-plane.bdd.parse.valid-block.v1",
      ownerSystem: "docs-control-plane",
      contractKind: "query-projection",
      mode: "read",
      given: {},
      when: {
        operation: "definition-markdown.listDocuments",
      },
      then: {
        returns: {
          document: "present",
        },
      },
    });

    expect(scenario.version).toBe("1");
  });
});

describe("compileBddContractsToScenarioSpecs", () => {
  it("returns compile readiness issues without blocking scenario generation", () => {
    const result = compileBddContractsToScenarioSpecs([
      {
        id: "contract.without.when.v1",
        ownerSystem: "demo-system",
        contractKind: "query-projection",
        mode: "read",
        given: {},
        when: {},
        then: { returns: { ok: true } },
      },
    ]);

    expect(result.scenarios).toHaveLength(1);
    expect(result.scenarios[0]?.steps[0]?.event_key).toBe("contract.without.when.v1");
    expect(result.issues).toEqual([
      {
        severity: "warning",
        code: "bdd-scenario-missing-event-or-operation",
        contractId: "contract.without.when.v1",
        message: "BDD contract has neither when.event_key nor when.operation; event_key falls back to contract id.",
      },
    ]);
  });
});

describe("compileBddContractToPipeGraph", () => {
  it("compiles BDD contracts through ScenarioSpec into PipeGraph", () => {
    const graph = compileBddContractToPipeGraph(approvalContract);

    expect(graph).toMatchObject({
      graphId: "approval-request.pending.approve.approved.v1",
      version: "1",
      entryPipeId: "when",
      pipes: [
        {
          pipeId: "when",
          trigger: {
            eventKey: "approval.approve.requested",
          },
        },
      ],
    });
    expect(graph.pipes[0]?.trigger.entryConditions).toEqual([
      { field: "payload.state", op: "eq", value: "PENDING" },
      { field: "payload.predicate.request.exists", op: "eq", value: true },
      { field: "payload.predicate.approver.has_permission", op: "eq", value: true },
    ]);
    expect(graph.pipes[0]?.flow).toMatchObject({
      kind: "step",
      eventKey: "approval.approve.requested",
    });
  });

  it("compiles batches to PipeGraph and preserves readiness issues", () => {
    const result = compileBddContractsToPipeGraphs([
      {
        id: "contract.without.when.v1",
        ownerSystem: "demo-system",
        contractKind: "query-projection",
        mode: "read",
        given: {},
        when: {},
        then: { returns: { ok: true } },
      },
    ]);

    expect(result.graphs[0]?.graphId).toBe("contract.without.when.v1");
    expect(result.graphs[0]?.pipes[0]?.trigger.eventKey).toBe("contract.without.when.v1");
    expect(result.issues[0]?.code).toBe("bdd-scenario-missing-event-or-operation");
  });
});
