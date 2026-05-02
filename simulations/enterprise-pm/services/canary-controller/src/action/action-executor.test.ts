// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec 01 §5 — routing push body / noop / scale no-op / scale exec argv / error.
// spec 2026-05-02 §7 — #21 ActionExecutor 가 gateway RoutingPushSchema 형태로 변환.

import { describe, it, expect, vi, afterEach } from "vitest";
import { RoutingPushSchema } from "@qa-sdk/sim-gateway/routing";
import {
  ActionExecutorService,
  type SimServiceCatalogPort,
  type PortRegistryPort,
} from "./action-executor.service.js";

function makeCatalog(opts: {
  stable: number;
  candidate: number | null;
}): SimServiceCatalogPort {
  return {
    getCurrentTopology: vi.fn(async () => ({
      stable: { value: opts.stable },
      candidate: opts.candidate === null ? null : { value: opts.candidate },
      retired: [],
    })),
  };
}

function makePortRegistry(map: Record<string, string>): PortRegistryPort {
  return {
    getUpstream: vi.fn((name: string) => {
      const u = map[name];
      if (!u) throw new Error(`unknown service container: ${name}`);
      return u;
    }),
  };
}

const baseCfg = {
  gatewayUrl: "http://gw",
  composeProject: "enterprise-pm",
  serviceName: "approval",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ActionExecutorService (spec 01 §5 + spec 2026-05-02 §7)", () => {
  it("(a) safety weight-update → RoutingPushSchema-compliant body (#21)", async () => {
    const catalog = makeCatalog({ stable: 1, candidate: 2 });
    const portRegistry = makePortRegistry({
      "sim-approval-v1": "http://sim-approval-api-v1:4600",
      "sim-approval-v2": "http://sim-approval-api-v2:4600",
    });
    const fetchSpy = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const svc = new ActionExecutorService({
      ...baseCfg,
      catalog,
      portRegistry,
    });
    await svc.executeSafety({
      kind: "weight-update",
      weight: 25,
      revision: 7,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0] as [string, { body?: string }];
    expect(url).toBe("http://gw/admin/routing");
    const body = JSON.parse(opts.body ?? "{}") as Record<string, unknown>;
    expect(body.services).toBeDefined();
    expect(body.services).toMatchObject({
      approval: {
        revision: 7,
        weight: 25,
        stickyKey: "user_id",
        stable: { upstream: "http://sim-approval-api-v1:4600" },
        candidate: { upstream: "http://sim-approval-api-v2:4600" },
      },
    });
    // build-time typecheck 강제 — RoutingPushSchema 정합 보장.
    expect(() => RoutingPushSchema.parse(body)).not.toThrow();
  });

  it("(a-2) candidate null + weight=100 → RoutingPushSchema candidate null", async () => {
    const catalog = makeCatalog({ stable: 1, candidate: null });
    const portRegistry = makePortRegistry({
      "sim-approval-v1": "http://sim-approval-api-v1:4600",
    });
    const fetchSpy = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const svc = new ActionExecutorService({
      ...baseCfg,
      catalog,
      portRegistry,
    });
    await svc.executeSafety({
      kind: "weight-update",
      weight: 100,
      revision: 8,
    });
    const body = JSON.parse(
      (fetchSpy.mock.calls[0] as [string, { body: string }])[1].body,
    ) as { services: Record<string, { candidate: unknown; weight: number }> };
    expect(body.services.approval.candidate).toBeNull();
    expect(body.services.approval.weight).toBe(100);
    expect(() => RoutingPushSchema.parse(body)).not.toThrow();
  });

  it("(b) safety noop → no fetch", async () => {
    const catalog = makeCatalog({ stable: 1, candidate: 2 });
    const portRegistry = makePortRegistry({});
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const svc = new ActionExecutorService({
      ...baseCfg,
      catalog,
      portRegistry,
    });
    await svc.executeSafety({ kind: "noop" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(catalog.getCurrentTopology).not.toHaveBeenCalled();
  });

  it("(c) resource scale target == current → no exec", async () => {
    const execSpy = vi.fn(async () => ({ stdout: "", stderr: "" }));
    const svc = new ActionExecutorService({
      ...baseCfg,
      catalog: makeCatalog({ stable: 1, candidate: 2 }),
      portRegistry: makePortRegistry({}),
      scaleExec: execSpy,
    });
    await svc.executeResource(
      { kind: "scale", target: { v1: 2, v2: 1 }, reason: "test" },
      { v1: 2, v2: 1 },
      { cycleId: "01HXSCALE000" },
    );
    expect(execSpy).not.toHaveBeenCalled();
  });

  it("(d) scale-up v2+1 → exec docker compose --scale sim-approval-api-v2=N", async () => {
    const execSpy = vi.fn(async () => ({ stdout: "", stderr: "" }));
    const svc = new ActionExecutorService({
      ...baseCfg,
      catalog: makeCatalog({ stable: 1, candidate: 2 }),
      portRegistry: makePortRegistry({}),
      scaleExec: execSpy,
    });
    await svc.executeResource(
      { kind: "scale", target: { v1: 2, v2: 2 }, reason: "scale-up" },
      { v1: 2, v2: 1 },
      { cycleId: "01HXSCALE001" },
    );
    expect(execSpy).toHaveBeenCalledTimes(1);
    expect(execSpy.mock.calls[0][0]).toEqual([
      "compose",
      "-p",
      "enterprise-pm",
      "up",
      "-d",
      "--no-recreate",
      "--scale",
      "sim-approval-api-v2=2",
    ]);
  });

  it("(e) gateway 500 → throw + 다음 사이클 retry 메시지", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    const svc = new ActionExecutorService({
      ...baseCfg,
      catalog: makeCatalog({ stable: 1, candidate: 2 }),
      portRegistry: makePortRegistry({
        "sim-approval-v1": "http://sim-approval-api-v1:4600",
        "sim-approval-v2": "http://sim-approval-api-v2:4600",
      }),
    });
    await expect(
      svc.executeSafety({ kind: "weight-update", weight: 25, revision: 1 }),
    ).rejects.toThrow(/500/);
  });

  it("(f) catalog 실패 → throw (다음 사이클 retry)", async () => {
    const catalog: SimServiceCatalogPort = {
      getCurrentTopology: vi.fn(async () => {
        throw new Error("catalog unreachable");
      }),
    };
    vi.stubGlobal("fetch", vi.fn());
    const svc = new ActionExecutorService({
      ...baseCfg,
      catalog,
      portRegistry: makePortRegistry({}),
    });
    await expect(
      svc.executeSafety({ kind: "weight-update", weight: 25, revision: 1 }),
    ).rejects.toThrow(/catalog unreachable/);
  });
});

// ----- spec 2026-05-02 §6 + Task 1b.10 — ActionExecutor pin awareness -----
//
// 4 케이스:
//   (a) pin = null + scale-up → exec 호출
//   (b) pin = 3 + scale-up target v2=4 → no exec + alert 1건
//   (c) pin 이 다른 서비스에만 set → 영향 없음
//   (d) alert payload 에 reason / pinnedReplicas / attemptedReplicas 포함

import { ScaleStore } from "../admin/scale-store.js";
import { ScalePinService } from "../admin/scale-pin.service.js";
import { DecisionRingBuffer } from "../decision/decision-ring-buffer.js";

describe("ActionExecutorService scale pin awareness (Task 1b.10)", () => {
  it("(a) pin = null → exec 호출", async () => {
    const exec = vi.fn(async () => ({ stdout: "", stderr: "" }));
    const ring = new DecisionRingBuffer();
    const pin = new ScalePinService(new ScaleStore());
    const svc = new ActionExecutorService({
      ...baseCfg,
      catalog: makeCatalog({ stable: 1, candidate: 2 }),
      portRegistry: makePortRegistry({}),
      scaleExec: exec,
      pin,
      ring,
    });
    await svc.executeResource(
      { kind: "scale", target: { v1: 2, v2: 2 }, reason: "load" },
      { v1: 2, v2: 1 },
      { cycleId: "01HXSCALE001" },
    );
    expect(exec).toHaveBeenCalledTimes(1);
    expect(ring.countAlerts({ kind: "scale-up-rejected" })).toBe(0);
  });

  it("(b) pin = 3 → no exec + alert 1건", async () => {
    const exec = vi.fn(async () => ({ stdout: "", stderr: "" }));
    const ring = new DecisionRingBuffer();
    const pin = new ScalePinService(new ScaleStore());
    pin.pin("sim-approval-api-v2", 3);
    const svc = new ActionExecutorService({
      ...baseCfg,
      catalog: makeCatalog({ stable: 1, candidate: 2 }),
      portRegistry: makePortRegistry({}),
      scaleExec: exec,
      pin,
      ring,
    });
    await svc.executeResource(
      { kind: "scale", target: { v1: 2, v2: 4 }, reason: "load FAIL" },
      { v1: 2, v2: 3 },
      { cycleId: "01HXPIN0001" },
    );
    expect(exec).not.toHaveBeenCalled();
    expect(ring.countAlerts({ kind: "scale-up-rejected" })).toBe(1);
  });

  it("(c) 다른 service 에 pin → 영향 없음", async () => {
    const exec = vi.fn(async () => ({ stdout: "", stderr: "" }));
    const ring = new DecisionRingBuffer();
    const pin = new ScalePinService(new ScaleStore());
    pin.pin("some-other-service", 5);
    const svc = new ActionExecutorService({
      ...baseCfg,
      catalog: makeCatalog({ stable: 1, candidate: 2 }),
      portRegistry: makePortRegistry({}),
      scaleExec: exec,
      pin,
      ring,
    });
    await svc.executeResource(
      { kind: "scale", target: { v1: 2, v2: 2 }, reason: "load" },
      { v1: 2, v2: 1 },
      { cycleId: "01HXSCALE003" },
    );
    expect(exec).toHaveBeenCalledTimes(1);
    expect(ring.countAlerts({ kind: "scale-up-rejected" })).toBe(0);
  });

  it("(d) alert payload 에 reason / pinnedReplicas / attemptedReplicas 포함", async () => {
    const exec = vi.fn(async () => ({ stdout: "", stderr: "" }));
    const ring = new DecisionRingBuffer();
    const appendSpy = vi.spyOn(ring, "appendAlert");
    const pin = new ScalePinService(new ScaleStore());
    pin.pin("sim-approval-api-v2", 3);
    const svc = new ActionExecutorService({
      ...baseCfg,
      catalog: makeCatalog({ stable: 1, candidate: 2 }),
      portRegistry: makePortRegistry({}),
      scaleExec: exec,
      pin,
      ring,
    });
    await svc.executeResource(
      { kind: "scale", target: { v1: 2, v2: 4 }, reason: "load FAIL" },
      { v1: 2, v2: 3 },
      { cycleId: "01HXPIN0004" },
    );
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy.mock.calls[0]?.[0]).toMatchObject({
      cycleId: "01HXPIN0004",
      kind: "scale-up-rejected",
      details: {
        reason: "pin-active",
        service: "sim-approval-api-v2",
        pinnedReplicas: 3,
        attemptedReplicas: 4,
      },
    });
    // occurredAt 은 ISO-8601 (sim-decision-view 표준 — at 가 아닌 occurredAt 키).
    const event = appendSpy.mock.calls[0]?.[0] as { occurredAt: string };
    expect(typeof event.occurredAt).toBe("string");
    expect(() => new Date(event.occurredAt).toISOString()).not.toThrow();
  });
});
