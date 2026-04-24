import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { runSupplyExportCommand } from "../src/export-command.js";
import type { EnvDiscoveryClient } from "../src/types.js";

let tempDir: string | undefined;

afterEach(async () => {
  vi.restoreAllMocks();
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

function makeDiscovery(): EnvDiscoveryClient {
  const services = [
    {
      serviceId: "ingest-server",
      name: "Ingest",
      url: "http://localhost:3200",
      tier: "backend",
      ownedPrefixes: ["ingest_event"],
      consumedPrefixes: [],
    },
  ];

  return {
    resolve: async (serviceId, env) => {
      const service = services.find((entry) => entry.serviceId === serviceId);
      return service
        ? { ...service, urls: { [env ?? "dev"]: service.url } }
        : null;
    },
    resolveAll: async () => ({ "ingest-server": "http://localhost:3200" }),
    listServices: async () => services,
  };
}

describe("infra-env-kit export-command", () => {
  it("env command는 파일을 생성한다", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "infra-env-kit-command-"));
    const outPath = join(tempDir, ".env.ingest-server.dev");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await runSupplyExportCommand({
      discovery: makeDiscovery(),
      command: "env",
      arg1: "ingest-server",
      arg2: "dev",
      rawArgs: ["env", "ingest-server", "dev"],
      exportOut: outPath,
      defaultConfigDir: join(process.cwd(), "packages/infra-engine/config"),
    });

    expect(await readFile(outPath, "utf-8")).toContain("PORT=3200");
    expect(log).toHaveBeenCalledWith(`생성됨: ${outPath}`);
  });
});
