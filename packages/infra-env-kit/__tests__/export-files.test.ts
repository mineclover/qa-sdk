import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  writeDockerComposeExport,
  writeEnvExport,
  writeTypescriptExport,
} from "../src/export-files.js";
import type { EnvDiscoveryClient } from "../src/types.js";

let tempDir: string | undefined;

afterEach(async () => {
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
    {
      serviceId: "gateway",
      name: "Gateway",
      url: "http://localhost:8787",
      tier: "backend",
      ownedPrefixes: [],
      consumedPrefixes: ["ingest_event"],
    },
  ];

  return {
    resolve: async (serviceId, env) => {
      const service = services.find((entry) => entry.serviceId === serviceId);
      return service
        ? { ...service, urls: { [env ?? "dev"]: service.url } }
        : null;
    },
    resolveAll: async () => ({
      "ingest-server": "http://localhost:3200",
      gateway: "http://localhost:8787",
    }),
    listServices: async () => services,
  };
}

describe("infra-env-kit export-files", () => {
  it("env/ts/compose 파일을 생성한다", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "infra-env-kit-export-"));
    const envResult = await writeEnvExport(makeDiscovery(), {
      serviceId: "ingest-server",
      env: "dev",
      outPath: join(tempDir, ".env.ingest-server.dev"),
      configPath: join(process.cwd(), "packages/infra-engine/config/dev.json"),
    });
    const tsResult = await writeTypescriptExport(makeDiscovery(), {
      env: "dev",
      outPath: join(tempDir, "service-connections.dev.ts"),
    });
    const composeResult = await writeDockerComposeExport(makeDiscovery(), {
      env: "dev",
      outPath: join(tempDir, "docker-compose.override.dev.yml"),
    });

    expect((await readFile(envResult.outPath, "utf-8"))).toContain("PORT=3200");
    expect((await readFile(tsResult.outPath, "utf-8"))).toContain("SERVICE_URLS");
    expect((await readFile(composeResult.outPath, "utf-8"))).toContain("services:");
  });
});
