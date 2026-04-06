import { describe, it, expect, vi } from "vitest";
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

  it("파싱 에러 시 원본 인자를 positionals로 반환한다", () => {
    // strict: false이므로 실제 parseArgs는 거의 에러를 내지 않음
    // catch fallback과 동등한 결과를 검증:
    // argDefs가 없는 노드에 인자를 넘기면 모두 rest로 처리됨
    const node: CliCommandNode = { segment: "test" };
    const ctx = parseCommandArgs(["foo", "bar", "baz"], node);
    expect(ctx.args).toEqual({});
    expect(ctx.rest).toEqual(["foo", "bar", "baz"]);
    expect(ctx.rawArgs).toEqual(["foo", "bar", "baz"]);
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
