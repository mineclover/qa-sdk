// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec 01 §5 — 5 케이스: routing push body, noop, scale no-op, scale exec argv, error.

import { describe, it, expect, vi, afterEach } from "vitest";
import { ActionExecutorService } from "./action-executor.service.js";

const cfg = {
  gatewayUrl: "http://gw",
  composeProject: "enterprise-pm",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ActionExecutorService (spec 01 §5 t=5s)", () => {
  it("(a) safety weight-update → POST /admin/routing body에 revision 포함", async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const svc = new ActionExecutorService(cfg);
    await svc.executeSafety({ kind: "weight-update", weight: 25, revision: 7 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0] as [
      string,
      { body?: string },
    ];
    expect(url).toBe("http://gw/admin/routing");
    expect(JSON.parse(opts.body!)).toEqual({ revision: 7, weight: 25 });
  });

  it("(b) safety noop → no fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const svc = new ActionExecutorService(cfg);
    await svc.executeSafety({ kind: "noop" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("(c) resource scale target == current → no exec", async () => {
    const execSpy = vi.fn(async () => ({ stdout: "", stderr: "" }));
    const svc = new ActionExecutorService({ ...cfg, scaleExec: execSpy });
    await svc.executeResource(
      { kind: "scale", target: { v1: 2, v2: 1 }, reason: "test" },
      { v1: 2, v2: 1 },
    );
    expect(execSpy).not.toHaveBeenCalled();
  });

  it("(d) scale-up v2+1 → exec docker compose --scale sim-approval-api-v2=N", async () => {
    const execSpy = vi.fn(async () => ({ stdout: "", stderr: "" }));
    const svc = new ActionExecutorService({ ...cfg, scaleExec: execSpy });
    await svc.executeResource(
      { kind: "scale", target: { v1: 2, v2: 2 }, reason: "scale-up" },
      { v1: 2, v2: 1 },
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

  it("(e) gateway 500 → throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    const svc = new ActionExecutorService(cfg);
    await expect(
      svc.executeSafety({ kind: "weight-update", weight: 25, revision: 1 }),
    ).rejects.toThrow(/500/);
  });
});
