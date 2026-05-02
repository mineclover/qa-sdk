import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { DeployResult } from "../../src/core/types.js";
import {
  buildDeploymentOutputArtifactRegistryRecord,
  buildFleetDeploymentArtifactRegistryRecord,
  writeDeploymentOutputArtifactRegistryRecord,
} from "../../src/post-deploy/artifact-registry.js";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

function successfulDeployResult(): DeployResult {
  return {
    success: true,
    endpoint: "https://api.example.com",
    healthStatus: "healthy",
    gateVerdict: "pass",
    duration: 1234,
    stageResults: [
      { stage: "config", status: "success", duration: 10 },
      { stage: "provision", status: "success", duration: 1000 },
      { stage: "register", status: "success", duration: 20 },
      { stage: "verify", status: "success", duration: 200 },
      { stage: "observe", status: "success", duration: 4 },
    ],
  };
}

describe("deployment output artifact registry", () => {
  it("배포 결과를 deployment-output registry record로 변환한다", () => {
    const record = buildDeploymentOutputArtifactRegistryRecord({
      service: "order-api",
      env: "prod",
      provider: "cloudflare",
      configPath: "packages/infra-engine/config/cloudflare-prod.json",
      result: successfulDeployResult(),
      createdAt: "2026-04-13T00:00:00.000Z",
      fleetRunId: "fleet-123",
      fleetMode: "all",
      fleetScope: "all",
    });

    expect(record).toMatchObject({
      artifactId: "deployment-output-order-api-prod-cloudflare",
      artifactRef: "https://api.example.com",
      kind: "deployment-output",
      producedByRef: "infra deploy order-api prod --provider cloudflare",
      ownerDefinitionId: "infra-engine-pipeline",
      materializesOutputRefs: [
        "service:order-api",
        "env:prod",
        "endpoint:https://api.example.com",
      ],
      sourceRefs: ["packages/infra-engine/config/cloudflare-prod.json"],
      createdAt: "2026-04-13T00:00:00.000Z",
    });
    expect(record.derivedFromRefs).toEqual([
      "packages/infra-engine/config/cloudflare-prod.json",
      "service:order-api",
      "env:prod",
      "fleet-run:fleet-123",
    ]);
    expect(record.verifiesRefs).toEqual([
      "service:order-api",
      "endpoint:https://api.example.com",
    ]);
    expect(record.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "produced_by",
          toRef: "infra deploy order-api prod --provider cloudflare",
        }),
        expect.objectContaining({
          kind: "materializes_output",
          toRef: "endpoint:https://api.example.com",
        }),
      ]),
    );
    expect(record.metadata).toMatchObject({
      fleetRunId: "fleet-123",
      fleetMode: "all",
      fleetScope: "all",
    });
  });

  it("fleet 배포 결과를 deployment-batch registry record로 변환한다", () => {
    const record = buildFleetDeploymentArtifactRegistryRecord({
      env: "dev",
      configPath: "packages/infra-engine/config/dev.json",
      runId: "fleet-456",
      mode: "all",
      scope: "all",
      options: {
        dryRun: false,
        continueOnError: true,
        provider: "local",
        sync: true,
      },
      result: {
        env: "dev",
        results: [
          { serviceId: "svc-a", success: true, duration: 10 },
          { serviceId: "svc-b", success: false, duration: 20, error: "boom" },
        ],
        summary: {
          total: 2,
          success: 1,
          failed: 1,
          totalDuration: 30,
        },
      },
      createdAt: "2026-04-13T00:00:00.000Z",
    });

    expect(record).toMatchObject({
      artifactId: "fleet-deployment-dev-all-fleet-456",
      artifactRef: "fleet-run:fleet-456",
      kind: "deployment-batch",
      ownerDefinitionId: "infra-engine-pipeline",
      createdAt: "2026-04-13T00:00:00.000Z",
    });
    expect(record.verifiesRefs).toEqual(["service:svc-a"]);
    expect(record.metadata).toMatchObject({
      env: "dev",
      runId: "fleet-456",
      mode: "all",
      scope: "all",
      successCount: 1,
      failedCount: 1,
    });
  });

  it("성공한 배포 결과를 registry JSON에 append/upsert한다", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "infra-artifact-registry-"));
    const registryPath = join(tempDir, "programming-artifacts.json");

    await writeDeploymentOutputArtifactRegistryRecord({
      artifactRegistry: registryPath,
      service: "order-api",
      env: "prod",
      provider: "cloudflare",
      configPath: "packages/infra-engine/config/cloudflare-prod.json",
      result: successfulDeployResult(),
      createdAt: "2026-04-13T00:00:00.000Z",
    });
    await writeDeploymentOutputArtifactRegistryRecord({
      artifactRegistry: registryPath,
      service: "order-api",
      env: "prod",
      provider: "cloudflare",
      configPath: "packages/infra-engine/config/cloudflare-prod.json",
      result: successfulDeployResult(),
      createdAt: "2026-04-13T00:00:01.000Z",
    });

    const payload = JSON.parse(await readFile(registryPath, "utf8")) as {
      artifacts: Array<{ artifactId: string; kind: string; createdAt: string }>;
    };
    expect(payload.artifacts).toHaveLength(1);
    expect(payload.artifacts[0]).toMatchObject({
      artifactId: "deployment-output-order-api-prod-cloudflare",
      kind: "deployment-output",
      createdAt: "2026-04-13T00:00:01.000Z",
    });
  });
});
