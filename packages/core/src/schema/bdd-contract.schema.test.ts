// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, expect, it } from "vitest";
import {
  bddContractBlockSchema,
  bddContractSchema,
  bddImplementationUnitSchema,
} from "./bdd-contract.schema.js";

const validContract = {
  id: "approval-request.pending.approve.approved.v1",
  owner_system: "approval-system",
  contract_kind: "state-transition",
  mode: "write",
  links: {
    spec: "approval-system",
    state_component: "approval-request-state",
    transition_ref: "meta-semantic/pipe-impl/approval-pipe#approve-transition",
  },
  given: {
    state_component: "approval-request-state",
    state: "PENDING",
    predicates: ["request.exists", "approver.has_permission"],
  },
  when: {
    actor: "approver",
    operation: "approval-system.approve",
    event_key: "approval.approve.requested",
  },
  then: {
    state: "APPROVED",
    emits: ["approval.approved"],
    egress: [{ axis: "approval_request.status", value: "APPROVED" }],
  },
};

describe("bddContractSchema", () => {
  it("normalizes snake_case BDD contract fields", () => {
    const result = bddContractSchema.parse(validContract);

    expect(result.ownerSystem).toBe("approval-system");
    expect(result.contractKind).toBe("state-transition");
    expect(result.links?.stateComponent).toBe("approval-request-state");
    expect(result.links?.transitionRef).toBe("meta-semantic/pipe-impl/approval-pipe#approve-transition");
    expect(result.when.eventKey).toBe("approval.approve.requested");
  });

  it("accepts validation-failure contracts with then.error", () => {
    const result = bddContractSchema.safeParse({
      id: "approval-request.pending.approve.permission-denied.v1",
      owner_system: "approval-system",
      contract_kind: "validation-failure",
      mode: "write",
      given: { state: "PENDING", predicates: ["!approver.has_permission"] },
      when: { operation: "approval-system.approve" },
      then: { error: { code: "permission_denied" } },
    });

    expect(result.success).toBe(true);
  });

  it("rejects unknown contract kind", () => {
    const result = bddContractSchema.safeParse({
      ...validContract,
      contract_kind: "workflow",
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing owner system", () => {
    const { owner_system: _, ...contract } = validContract;

    expect(bddContractSchema.safeParse(contract).success).toBe(false);
  });

  it("rejects state-transition without then.state", () => {
    const result = bddContractSchema.safeParse({
      ...validContract,
      then: { emits: ["approval.approved"] },
    });

    expect(result.success).toBe(false);
  });
});

describe("bddImplementationUnitSchema", () => {
  it("normalizes implementation unit fields", () => {
    const result = bddImplementationUnitSchema.parse({
      id: "IU-approval-approve-operation",
      contract: "approval-request.pending.approve.approved.v1",
      unit_kind: "operation",
      owned_by: "approval-system",
      source_target: "packages/approval/src/approval-system.ts",
      must_not_own: ["notification-system"],
    });

    expect(result.unitKind).toBe("operation");
    expect(result.ownedBy).toBe("approval-system");
    expect(result.sourceTarget).toBe("packages/approval/src/approval-system.ts");
    expect(result.mustNotOwn).toEqual(["notification-system"]);
  });

  it("rejects invalid implementation unit kind", () => {
    const result = bddImplementationUnitSchema.safeParse({
      id: "IU-approval-approve-everything",
      contract: "approval-request.pending.approve.approved.v1",
      unit_kind: "everything",
      owned_by: "approval-system",
    });

    expect(result.success).toBe(false);
  });
});

describe("bddContractBlockSchema", () => {
  it("collects contract and unit arrays from a BDD block", () => {
    const result = bddContractBlockSchema.parse({
      bdd_contract: validContract,
      test_unit: {
        id: "TU-approval-approve-success",
        contract: "approval-request.pending.approve.approved.v1",
        level: "integration",
        assertions: ["then.state", "then.emits"],
      },
      implementation_unit: {
        id: "IU-approval-approve-operation",
        contract: "approval-request.pending.approve.approved.v1",
        unit_kind: "operation",
        owned_by: "approval-system",
      },
    });

    expect(result.contracts).toHaveLength(1);
    expect(result.testUnits).toHaveLength(1);
    expect(result.implementationUnits).toHaveLength(1);
  });
});
