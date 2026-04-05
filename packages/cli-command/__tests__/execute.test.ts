import { describe, it, expect, vi } from "vitest";
import { executeCommand } from "../src/execute.js";
import type { CliCommandNode } from "../src/types.js";

describe("executeCommand", () => {
  it("handler 직접 실행", async () => {
    const fn = vi.fn(async () => {});
    const tree: CliCommandNode[] = [
      { segment: "status", handler: fn, args: [{ name: "env" }] },
    ];

    const ok = await executeCommand(["status", "dev"], tree);
    expect(ok).toBe(true);
    expect(fn).toHaveBeenCalledOnce();
    expect(fn.mock.calls[0][0].args.env).toBe("dev");
  });

  it("handlerKey + handlers 매핑", async () => {
    const fn = vi.fn(async () => {});
    const tree: CliCommandNode[] = [
      { segment: "deploy", handlerKey: "do.deploy" },
    ];

    const ok = await executeCommand(["deploy", "svc"], tree, {
      handlers: { "do.deploy": fn },
    });
    expect(ok).toBe(true);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("미매칭 → false", async () => {
    const ok = await executeCommand(["unknown"], []);
    expect(ok).toBe(false);
  });

  it("옵션 파싱", async () => {
    const fn = vi.fn(async () => {});
    const tree: CliCommandNode[] = [{
      segment: "deploy",
      handler: fn,
      args: [{ name: "service" }],
      options: [
        { flag: "--dry-run", type: "boolean" },
        { flag: "--provider", type: "string" },
      ],
    }];

    await executeCommand(["deploy", "nginx", "--dry-run", "--provider", "cloudflare"], tree);
    const ctx = fn.mock.calls[0][0];
    expect(ctx.args.service).toBe("nginx");
    expect(ctx.options.dryRun).toBe(true);
    expect(ctx.options.provider).toBe("cloudflare");
  });
});
