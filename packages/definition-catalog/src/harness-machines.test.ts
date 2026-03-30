import { describe, it, expect } from "vitest";
import { transition, createInstance, availableTransitions } from "./state-model.js";
import {
  ADDRESS_STATE_MACHINE,
  VERSION_LIFECYCLE_MACHINE,
  FLOW_STATE_MACHINE,
  SERVICE_STATE_MACHINE,
  EVENT_STATE_MACHINE,
  METRIC_HEALTH_MACHINE,
  POLICY_STATE_MACHINE,
} from "./harness-machines.js";

describe("ADDRESS_STATE_MACHINE", () => {
  it("open → active 전이", () => {
    const inst = createInstance(ADDRESS_STATE_MACHINE, "test");
    expect(inst.current).toBe("open");
    const next = transition(ADDRESS_STATE_MACHINE, inst, "active");
    expect(next.current).toBe("active");
  });

  it("active → inactive → active 라운드트립", () => {
    let inst = createInstance(ADDRESS_STATE_MACHINE, "test");
    inst = transition(ADDRESS_STATE_MACHINE, inst, "active");
    inst = transition(ADDRESS_STATE_MACHINE, inst, "inactive");
    expect(inst.current).toBe("inactive");
    inst = transition(ADDRESS_STATE_MACHINE, inst, "active");
    expect(inst.current).toBe("active");
  });
});

describe("VERSION_LIFECYCLE_MACHINE", () => {
  it("draft → released → active → deprecated 전체 흐름", () => {
    let inst = createInstance(VERSION_LIFECYCLE_MACHINE, "v1");
    inst = transition(VERSION_LIFECYCLE_MACHINE, inst, "released");
    inst = transition(VERSION_LIFECYCLE_MACHINE, inst, "active");
    inst = transition(VERSION_LIFECYCLE_MACHINE, inst, "deprecated");
    expect(inst.current).toBe("deprecated");
    expect(inst.history).toHaveLength(3);
  });
});

describe("FLOW_STATE_MACHINE", () => {
  it("pending → active → completed", () => {
    let inst = createInstance(FLOW_STATE_MACHINE, "flow-1");
    inst = transition(FLOW_STATE_MACHINE, inst, "active");
    inst = transition(FLOW_STATE_MACHINE, inst, "completed");
    expect(inst.current).toBe("completed");
  });

  it("active → blocked → active 차단 해제", () => {
    let inst = createInstance(FLOW_STATE_MACHINE, "flow-1");
    inst = transition(FLOW_STATE_MACHINE, inst, "active");
    inst = transition(FLOW_STATE_MACHINE, inst, "blocked");
    inst = transition(FLOW_STATE_MACHINE, inst, "active");
    expect(inst.current).toBe("active");
  });
});

describe("7개 시스템 머신 공통", () => {
  const machines = [
    ADDRESS_STATE_MACHINE, VERSION_LIFECYCLE_MACHINE, FLOW_STATE_MACHINE,
    SERVICE_STATE_MACHINE, EVENT_STATE_MACHINE, METRIC_HEALTH_MACHINE,
    POLICY_STATE_MACHINE,
  ];

  it("모든 머신에 id, initial, states, transitions가 있다", () => {
    for (const m of machines) {
      expect(m.id).toBeTruthy();
      expect(m.initial).toBeTruthy();
      expect(m.states.length).toBeGreaterThan(0);
      expect(m.transitions.length).toBeGreaterThan(0);
    }
  });

  it("initial 상태에서 출발하는 전이 규칙이 정의되어 있다", () => {
    for (const m of machines) {
      const fromInitial = m.transitions.filter(t => t.from === m.initial);
      expect(fromInitial.length).toBeGreaterThan(0);
    }
  });
});
