import { describe, it, expect } from "vitest";
import { parseCommandArgs } from "../src/parse.js";
import type { CliCommandNode } from "../src/types.js";

describe("parseCommandArgs", () => {
  it("위치 인자 파싱", () => {
    const node: CliCommandNode = {
      segment: "deploy",
      args: [{ name: "service" }, { name: "env" }],
    };
    const ctx = parseCommandArgs(["nginx", "dev"], node);
    expect(ctx.args.service).toBe("nginx");
    expect(ctx.args.env).toBe("dev");
  });

  it("옵션 파싱", () => {
    const node: CliCommandNode = {
      segment: "deploy",
      options: [
        { flag: "--dry-run", type: "boolean" },
        { flag: "--provider", type: "string" },
      ],
    };
    const ctx = parseCommandArgs(["--dry-run", "--provider", "cloudflare"], node);
    expect(ctx.options.dryRun).toBe(true);
    expect(ctx.options.provider).toBe("cloudflare");
  });

  it("인자 + 옵션 혼합", () => {
    const node: CliCommandNode = {
      segment: "deploy",
      args: [{ name: "service" }],
      options: [{ flag: "--env", type: "string" }],
    };
    const ctx = parseCommandArgs(["nginx", "--env", "dev"], node);
    expect(ctx.args.service).toBe("nginx");
    expect(ctx.options.env).toBe("dev");
  });
});
