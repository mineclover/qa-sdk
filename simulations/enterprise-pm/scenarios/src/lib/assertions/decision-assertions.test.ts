// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios

import { describe, expect, it } from "vitest";
import { buildCycleId, buildDecisionId } from "sim-identifier-grammar";
import {
  assertSafetyVerdict,
  assertTriggerCategory,
  assertResourceVerdict,
  assertSingleDecisionPerCyclePass,
} from "./decision-assertions.js";
import type {
  ResourceDecisionRecordView,
  SafetyDecisionRecordView,
} from "../audit-fetcher.js";

// 라운드트립 통과 식별자 — controllerId 8 chars + cycleAt epoch ms.
const CYCLE_AT = 1_700_000_000_000;
const CTRL_ID = "00000001";
const CYCLE_ID = buildCycleId({ controllerId: CTRL_ID, cycleAt: CYCLE_AT });
const SAFETY_DECISION_ID = buildDecisionId({ pass: "safety", cycleId: CYCLE_ID });
const RESOURCE_DECISION_ID = buildDecisionId({
  pass: "resource",
  cycleId: CYCLE_ID,
});

const baseSafety: SafetyDecisionRecordView = {
  decisionId: SAFETY_DECISION_ID,
  cycleId: CYCLE_ID,
  cycleAt: new Date(CYCLE_AT).toISOString(),
  pass: "safety",
  verdict: "promote",
  categoryVerdicts: {
    perf: "PASS",
    compatibility: "PASS",
    decisionQuality: "PASS",
    auditSafety: "PASS",
    replicationHealth: "PASS",
  },
  triggerSignals: [],
  evidence: [],
  confidence: 0.95,
  action: { kind: "weight-update", weight: 25, revision: 2 },
};

const baseResource: ResourceDecisionRecordView = {
  decisionId: RESOURCE_DECISION_ID,
  cycleId: CYCLE_ID,
  cycleAt: new Date(CYCLE_AT).toISOString(),
  pass: "resource",
  verdict: "rejected",
  categoryVerdicts: {
    loadPressure: "FAIL",
    resourceHeadroom: "FAIL",
    stability: "PASS",
  },
  rejectedBy: "resourceHeadroom",
  triggerSignals: ["loadPressure.RPS", "resourceHeadroom.dbPoolUtilization"],
  evidence: [],
  confidence: 0.9,
  action: { kind: "noop" },
};

describe("assertSafetyVerdict", () => {
  it("PASS: full-match expectation", () => {
    expect(() =>
      assertSafetyVerdict(baseSafety, {
        verdict: "promote",
        categoryVerdicts: {
          perf: "PASS",
          compatibility: "PASS",
          decisionQuality: "PASS",
          auditSafety: "PASS",
          replicationHealth: "PASS",
        },
        action: { kind: "weight-update", weight: 25, revision: 2 },
        minConfidence: 0.6,
      }),
    ).not.toThrow();
  });

  it("FAIL: mismatched action.weight rejected", () => {
    expect(() =>
      assertSafetyVerdict(baseSafety, {
        verdict: "promote",
        action: { kind: "weight-update", weight: 50, revision: 2 },
      }),
    ).toThrow(/weight|action/);
  });

  it("FAIL: wrong categoryVerdicts subset rejected (compatibility)", () => {
    expect(() =>
      assertSafetyVerdict(baseSafety, {
        verdict: "promote",
        categoryVerdicts: { compatibility: "FAIL" },
      }),
    ).toThrow(/compatibility/);
  });
});

describe("assertTriggerCategory", () => {
  it("PASS: rollback + categoryVerdicts.compatibility=FAIL", () => {
    const d: SafetyDecisionRecordView = {
      ...baseSafety,
      verdict: "rollback",
      triggerCategory: "compatibility",
      categoryVerdicts: { ...baseSafety.categoryVerdicts, compatibility: "FAIL" },
    };
    expect(() => assertTriggerCategory(d, "compatibility")).not.toThrow();
  });

  it("FAIL: WARN value rejected (must be FAIL)", () => {
    const d: SafetyDecisionRecordView = {
      ...baseSafety,
      verdict: "rollback",
      triggerCategory: "compatibility",
      categoryVerdicts: { ...baseSafety.categoryVerdicts, compatibility: "WARN" },
    };
    expect(() => assertTriggerCategory(d, "compatibility")).toThrow(/FAIL/);
  });
});

describe("assertResourceVerdict", () => {
  it("PASS: rejected + rejectedBy=resourceHeadroom", () => {
    expect(() =>
      assertResourceVerdict(baseResource, {
        verdict: "rejected",
        rejectedBy: "resourceHeadroom",
        triggerSignals: ["loadPressure.RPS"],
      }),
    ).not.toThrow();
  });

  it("FAIL: missing rejectedBy on rejected verdict", () => {
    const d: ResourceDecisionRecordView = {
      ...baseResource,
      rejectedBy: undefined,
    };
    expect(() =>
      assertResourceVerdict(d, { verdict: "rejected" }),
    ).toThrow(/rejectedBy/);
  });

  it("PASS: scale-up target invariant", () => {
    const d: ResourceDecisionRecordView = {
      ...baseResource,
      verdict: "scale-up",
      rejectedBy: undefined,
      action: { kind: "scale", target: { v1: 2, v2: 3 }, reason: "burst" },
    };
    expect(() =>
      assertResourceVerdict(d, {
        verdict: "scale-up",
        target: { v1: 2, v2: 3 },
      }),
    ).not.toThrow();
  });
});

describe("assertSingleDecisionPerCyclePass", () => {
  it("PASS: distinct (cycleId, pass) keys", () => {
    expect(() =>
      assertSingleDecisionPerCyclePass([baseSafety, baseResource]),
    ).not.toThrow();
  });

  it("FAIL: duplicate (cycleId, pass)", () => {
    expect(() =>
      assertSingleDecisionPerCyclePass([baseSafety, { ...baseSafety }]),
    ).toThrow(/duplicate/);
  });
});
