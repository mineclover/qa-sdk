// @def.boundary viz-system-root
// @def.doc viz-system-root

import { describe, it, expect } from "vitest";
import {
  getPrefixRole, classifyByRole, validateSignal,
  DEMO_SIGNALS, SIGNAL_ROLE_LABELS,
} from "./signal-model.js";

describe("SignalModel — 트래킹 상위 개념", () => {

  it("prefix → role 매핑", () => {
    expect(getPrefixRole("service")).toBe("context");
    expect(getPrefixRole("page_view")).toBe("context");
    expect(getPrefixRole("tracking")).toBe("trigger");
    expect(getPrefixRole("cart_event")).toBe("trigger");
    expect(getPrefixRole("endpoint")).toBe("channel");
    expect(getPrefixRole("flow_point")).toBe("state");
    expect(getPrefixRole("permission")).toBe("guard");
    expect(getPrefixRole("pipeline_point")).toBe("effect");
    expect(getPrefixRole("orders")).toBe("data");
  });

  it("address_context → role별 분류", () => {
    const ctx = {
      service: "service:v1:65536",
      page_view: "page_view:v2:7",
      tracking: "tracking:v2:3",
      auth_event: "auth_event:v1:0",
      endpoint: "endpoint:v1:32",
      flow_point: "flow_point:v2:0",
      permission: "permission:v4:5",
    };

    const byRole = classifyByRole(ctx);

    expect(byRole.context.length).toBe(2); // service, page_view
    expect(byRole.trigger.length).toBe(2); // tracking, auth_event
    expect(byRole.channel.length).toBe(1); // endpoint
    expect(byRole.state.length).toBe(1);   // flow_point
    expect(byRole.guard.length).toBe(1);   // permission
    expect(byRole.effect.length).toBe(0);
    expect(byRole.data.length).toBe(0);
  });

  it("Signal 정의: auth.login", () => {
    const sig = DEMO_SIGNALS.find(s => s.id === "auth.login")!;

    expect(sig.members.length).toBe(6);
    expect(sig.members.find(m => m.role === "context")).toBeDefined();
    expect(sig.members.find(m => m.role === "trigger")).toBeDefined();
    expect(sig.members.find(m => m.role === "channel")).toBeDefined();
    expect(sig.members.find(m => m.role === "state")).toBeDefined();
    expect(sig.members.find(m => m.role === "guard")).toBeDefined();

    // role 라벨
    expect(SIGNAL_ROLE_LABELS.context).toBe("어디서");
    expect(SIGNAL_ROLE_LABELS.trigger).toBe("뭘 했는가");
  });

  it("Signal 검증: 완전한 address_context", () => {
    const sig = DEMO_SIGNALS.find(s => s.id === "auth.login")!;
    const ctx = {
      page_view: "page_view:v2:7",
      tracking: "tracking:v2:3",
      auth_event: "auth_event:v1:0",
      endpoint: "endpoint:v1:32",
      flow_point: "flow_point:v2:0",
      permission: "permission:v4:5",
    };

    const result = validateSignal(sig, ctx);
    expect(result.valid).toBe(true);
    expect(result.missingRoles.length).toBe(0);
    expect(result.matchedMembers).toBe(6);
  });

  it("Signal 검증: 불완전 — trigger 누락", () => {
    const sig = DEMO_SIGNALS.find(s => s.id === "auth.login")!;
    const ctx = {
      page_view: "page_view:v2:7",
      // tracking 없음
      // auth_event 없음
      endpoint: "endpoint:v1:32",
      flow_point: "flow_point:v2:0",
      permission: "permission:v4:5",
    };

    const result = validateSignal(sig, ctx);
    expect(result.valid).toBe(false);
    expect(result.missingRoles).toContain("trigger");
    expect(result.matchedMembers).toBe(4);
  });

  it("Signal 검증: 여분 prefix", () => {
    const sig = DEMO_SIGNALS.find(s => s.id === "page.view")!;
    const ctx = {
      page_view: "page_view:v2:0",
      tracking: "tracking:v2:1",
      deploy_event: "deploy_event:v1:0", // 여분
    };

    const result = validateSignal(sig, ctx);
    expect(result.valid).toBe(true);
    expect(result.extraPrefixes).toContain("deploy_event");
  });

  it("Signal requires — 선행 조건", () => {
    const cartAdd = DEMO_SIGNALS.find(s => s.id === "cart.add")!;
    expect(cartAdd.requires).toContain("auth.login");

    const checkout = DEMO_SIGNALS.find(s => s.id === "checkout.entry")!;
    expect(checkout.requires).toContain("cart.add");

    const process = DEMO_SIGNALS.find(s => s.id === "checkout.process")!;
    expect(process.requires).toContain("checkout.entry");
  });

  it("Signal 체인: login → cart.add → checkout → process → success", () => {
    const chain = ["auth.login", "cart.add", "checkout.entry", "checkout.process", "payment.success"];

    for (let i = 1; i < chain.length; i++) {
      const sig = DEMO_SIGNALS.find(s => s.id === chain[i])!;
      expect(sig.requires).toContain(chain[i - 1]);
    }
  });

  it("모든 role이 정의됨", () => {
    const allRoles = new Set<string>();
    for (const sig of DEMO_SIGNALS) {
      for (const m of sig.members) allRoles.add(m.role);
    }
    // context, trigger, channel, state, guard, effect 모두 사용됨
    expect(allRoles.has("context")).toBe(true);
    expect(allRoles.has("trigger")).toBe(true);
    expect(allRoles.has("channel")).toBe(true);
    expect(allRoles.has("state")).toBe(true);
    expect(allRoles.has("guard")).toBe(true);
    expect(allRoles.has("effect")).toBe(true);
  });
});
