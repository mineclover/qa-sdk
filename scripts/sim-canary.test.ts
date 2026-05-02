// scripts/sim-canary.test.ts
// Plan E Stage 12 Task 12.5 — sim-canary dry-run 단위 테스트.
// dry-run은 fetch/transitionState 어떤 부수효과도 일으키지 않으므로 mock 없이
// stdout 캡처로 의도된 호출 셋을 검증한다.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildSimCanary } from "./sim-canary.js";

function captureStdout(fn: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  (process.stdout.write as unknown as (s: string) => boolean) = ((
    s: string,
  ) => {
    lines.push(s.replace(/\n$/, ""));
    return true;
  }) as never;
  return fn()
    .finally(() => {
      process.stdout.write = orig;
    })
    .then(() => lines);
}

describe("sim-canary dry-run", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("abort — weight=0 push + controller hold 두 호출", async () => {
    const lines = await captureStdout(() =>
      buildSimCanary().parseAsync([
        "node",
        "sim-canary",
        "abort",
        "--service",
        "approval-api",
        "--prefix",
        "sim.approval",
        "--reason",
        "test",
        "--dry-run",
      ]),
    );
    const calls = lines.map((l) => JSON.parse(l));
    expect(calls).toEqual([
      expect.objectContaining({
        call: "POST /admin/routing",
        body: expect.objectContaining({
          service: "approval-api",
          weight: 0,
        }),
      }),
      expect.objectContaining({
        call: "POST /admin/controller/hold",
        body: expect.objectContaining({ service: "approval-api" }),
      }),
    ]);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("force-promote — catalog 두 전이 + weight=100 push", async () => {
    const lines = await captureStdout(() =>
      buildSimCanary().parseAsync([
        "node",
        "sim-canary",
        "force-promote",
        "--service",
        "approval-api",
        "--prefix",
        "sim.approval",
        "--reason",
        "test",
        "--dry-run",
      ]),
    );
    expect(lines.map((l) => JSON.parse(l).call)).toEqual([
      "transitionState",
      "transitionState",
      "POST /admin/routing",
    ]);
  });

  it("controller stop — admin/controller/stop 한 호출", async () => {
    const lines = await captureStdout(() =>
      buildSimCanary().parseAsync([
        "node",
        "sim-canary",
        "controller",
        "stop",
        "--service",
        "approval-api",
        "--prefix",
        "sim.approval",
        "--reason",
        "test",
        "--dry-run",
      ]),
    );
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({
      call: "POST /admin/controller/stop",
    });
  });
});
