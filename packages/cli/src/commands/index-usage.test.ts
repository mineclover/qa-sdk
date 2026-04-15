import { describe, expect, it } from "vitest";
import { USAGE, main, resolveSubcommand } from "../index.js";

describe("top-level usage contracts", () => {
  it("service/ingest/obs/review request usage를 구체적으로 노출한다", () => {
    expect(USAGE).toContain("qa-sdk service mode [local|staging|prod] [--set key=value]");
    expect(USAGE).toContain("qa-sdk ingest mode [local|dev|staging|prod] [--set key=value]");
    expect(USAGE).toContain("qa-sdk ingest insights [--limit N]");
    expect(USAGE).toContain("qa-sdk obs list [prefix] [--vault <name>]");
    expect(USAGE).toContain("qa-sdk obs stats [--vault <name>]");
    expect(USAGE).toContain("qa-sdk docs status [doc-id|path] [--json]");
    expect(USAGE).toContain("qa-sdk docs collect <doc-id|path> [--json]");
    expect(USAGE).toContain("qa-sdk docs search <query> [--kind <kind>] [--metadata key=value] [--json]");
    expect(USAGE).toContain("qa-sdk docs drift [--prd <file>] [--json]");
    expect(USAGE).toContain("qa-sdk docs transform metadata --rule <json-file|inline-json> [--dry-run]");
    expect(USAGE).toContain("[--dkg-target <nodeId>] [--decision-id <id>]");
    expect(USAGE).toContain("[--decision-type <type> --title <text> --rationale <text>]");
  });

  it("dkg transition 하위 명령을 개별 surface로 해석한다", () => {
    expect(USAGE).toContain("qa-sdk dkg transition coverage");
    expect(USAGE).toContain("qa-sdk dkg transition orphans");
    expect(USAGE).toContain("qa-sdk dkg transition violations");

    expect(resolveSubcommand(["dkg", "transition", "coverage"])).toEqual({
      name: "dkg transition coverage",
      rest: [],
    });
    expect(resolveSubcommand(["dkg", "transition", "orphans"])).toEqual({
      name: "dkg transition orphans",
      rest: [],
    });
    expect(resolveSubcommand(["dkg", "transition", "violations"])).toEqual({
      name: "dkg transition violations",
      rest: [],
    });
  });

  it("tree 그룹은 서브트리 help를 생성한다", async () => {
    const stdout: string[] = [];
    const log = console.log;
    console.log = (...args: unknown[]) => {
      stdout.push(args.join(" "));
    };

    try {
      await main(["service", "--help"]);
      const serviceHelp = stdout.join("\n");
      expect(serviceHelp).toContain("qa-sdk service");
      expect(serviceHelp).toContain("qa-sdk service list");
      expect(serviceHelp).not.toContain("qa-sdk init [options]");

      stdout.length = 0;
      await main(["dkg", "decisions", "--help"]);
      const dkgHelp = stdout.join("\n");
      expect(dkgHelp).toContain("qa-sdk dkg decisions");
      expect(dkgHelp).toContain("export");
      expect(dkgHelp).toContain("import");
      expect(dkgHelp).toContain("list");

      stdout.length = 0;
      await main(["ingest", "--help"]);
      const ingestHelp = stdout.join("\n");
      expect(ingestHelp).toContain("qa-sdk ingest");
      expect(ingestHelp).toContain("qa-sdk ingest health");
      expect(ingestHelp).toContain("qa-sdk ingest insights");

      stdout.length = 0;
      await main(["obs", "--help"]);
      const obsHelp = stdout.join("\n");
      expect(obsHelp).toContain("qa-sdk obs");
      expect(obsHelp).toContain("qa-sdk obs read");
      expect(obsHelp).toContain("qa-sdk obs stats");

      stdout.length = 0;
      await main(["gate", "--help"]);
      const gateHelp = stdout.join("\n");
      expect(gateHelp).toContain("qa-sdk gate");
      expect(gateHelp).toContain("qa-sdk gate health");
      expect(gateHelp).toContain("qa-sdk gate classify");

      stdout.length = 0;
      await main(["query", "--help"]);
      const queryHelp = stdout.join("\n");
      expect(queryHelp).toContain("qa-sdk query");
      expect(queryHelp).toContain("qa-sdk query health");
      expect(queryHelp).toContain("qa-sdk query resolve");

      stdout.length = 0;
      await main(["spec", "--help"]);
      const specHelp = stdout.join("\n");
      expect(specHelp).toContain("qa-sdk spec");
      expect(specHelp).toContain("qa-sdk spec list");
      expect(specHelp).toContain("qa-sdk spec codegen");

      stdout.length = 0;
      await main(["test", "--help"]);
      const testHelp = stdout.join("\n");
      expect(testHelp).toContain("qa-sdk test");
      expect(testHelp).toContain("qa-sdk test scan");
      expect(testHelp).toContain("qa-sdk test report");

      stdout.length = 0;
      await main(["catalog", "--help"]);
      const catalogHelp = stdout.join("\n");
      expect(catalogHelp).toContain("qa-sdk catalog");
      expect(catalogHelp).toContain("qa-sdk catalog list");
      expect(catalogHelp).toContain("qa-sdk catalog info");

      stdout.length = 0;
      await main(["motion", "--help"]);
      const motionHelp = stdout.join("\n");
      expect(motionHelp).toContain("qa-sdk motion");
      expect(motionHelp).toContain("qa-sdk motion validate");
      expect(motionHelp).toContain("workspace:");

      stdout.length = 0;
      await main(["flow", "--help"]);
      const flowHelp = stdout.join("\n");
      expect(flowHelp).toContain("qa-sdk flow");
      expect(flowHelp).toContain("qa-sdk flow list");
      expect(flowHelp).toContain("policy:");

      stdout.length = 0;
      await main(["prefix", "--help"]);
      const prefixHelp = stdout.join("\n");
      expect(prefixHelp).toContain("qa-sdk prefix");
      expect(prefixHelp).toContain("qa-sdk prefix stamp");
      expect(prefixHelp).toContain("qa-sdk prefix impact");

      stdout.length = 0;
      await main(["docs", "--help"]);
      const docsHelp = stdout.join("\n");
      expect(docsHelp).toContain("qa-sdk docs");
      expect(docsHelp).toContain("qa-sdk docs status");
      expect(docsHelp).toContain("qa-sdk docs collect");
      expect(docsHelp).toContain("qa-sdk docs search");
      expect(docsHelp).toContain("qa-sdk docs drift");
      expect(docsHelp).toContain("qa-sdk docs transform metadata");

      stdout.length = 0;
      await main(["scan", "--help"]);
      const scanHelp = stdout.join("\n");
      expect(scanHelp).toContain("qa-sdk scan");
      expect(scanHelp).toContain("qa-sdk scan git");

      stdout.length = 0;
      await main(["init", "--help"]);
      const initHelp = stdout.join("\n");
      expect(initHelp).toContain("qa-sdk init");
      expect(initHelp).toContain("qa-sdk init [options]");
    } finally {
      console.log = log;
    }
  });

  it("ingest/obs 하위 명령을 tree 기반으로 해석한다", () => {
    expect(resolveSubcommand(["ingest", "mode", "prod", "--set", "a=b"])).toEqual({
      name: "ingest mode",
      rest: ["prod", "--set", "a=b"],
    });
    expect(resolveSubcommand(["obs", "list", "docs", "--vault", "spec-prefix"])).toEqual({
      name: "obs list",
      rest: ["docs", "--vault", "spec-prefix"],
    });
    expect(resolveSubcommand(["gate", "check", "tracking", "v1"])).toEqual({
      name: "gate check",
      rest: ["tracking", "v1"],
    });
    expect(resolveSubcommand(["query", "resolve", "--coord", "d=v"])).toEqual({
      name: "query resolve",
      rest: ["--coord", "d=v"],
    });
    expect(resolveSubcommand(["spec", "trace", "spec-id"])).toEqual({
      name: "spec trace",
      rest: ["spec-id"],
    });
    expect(resolveSubcommand(["test", "status", "--db", "tmp.sqlite"])).toEqual({
      name: "test status",
      rest: ["--db", "tmp.sqlite"],
    });
    expect(resolveSubcommand(["catalog", "info", "demo"])).toEqual({
      name: "catalog info",
      rest: ["demo"],
    });
    expect(resolveSubcommand(["motion", "workspace", "list"])).toEqual({
      name: "motion workspace list",
      rest: [],
    });
    expect(resolveSubcommand(["flow", "policy", "learn", "coordinate-design"])).toEqual({
      name: "flow policy learn",
      rest: ["coordinate-design"],
    });
    expect(resolveSubcommand(["prefix", "stamp", "a.ts", "--dry-run"])).toEqual({
      name: "prefix stamp",
      rest: ["a.ts", "--dry-run"],
    });
    expect(resolveSubcommand(["docs", "status", "checkout-spec", "--json"])).toEqual({
      name: "docs status",
      rest: ["checkout-spec", "--json"],
    });
    expect(resolveSubcommand(["docs", "collect", "docs/specs/checkout/checkout.spec.md"])).toEqual({
      name: "docs collect",
      rest: ["docs/specs/checkout/checkout.spec.md"],
    });
    expect(resolveSubcommand(["docs", "search", "checkout", "--kind", "prd"])).toEqual({
      name: "docs search",
      rest: ["checkout", "--kind", "prd"],
    });
    expect(resolveSubcommand(["docs", "drift", "--prd", "tasks/checkout-prd.json"])).toEqual({
      name: "docs drift",
      rest: ["--prd", "tasks/checkout-prd.json"],
    });
    expect(resolveSubcommand(["docs", "transform", "metadata", "--rule", "{}"])).toEqual({
      name: "docs transform metadata",
      rest: ["--rule", "{}"],
    });
    expect(resolveSubcommand(["scan", "git", "--root", "."])).toEqual({
      name: "scan git",
      rest: ["--root", "."],
    });
    expect(resolveSubcommand(["git", "conflicts", "--json"])).toEqual({
      name: "git conflicts",
      rest: ["--json"],
    });
    expect(resolveSubcommand(["facet", "scan", "--service", "gate-service"])).toEqual({
      name: "facet scan",
      rest: ["--service", "gate-service"],
    });
    expect(resolveSubcommand(["init", "--vite-consumer", "packages/web"])).toEqual({
      name: "init",
      rest: ["--vite-consumer", "packages/web"],
    });
  });
});
