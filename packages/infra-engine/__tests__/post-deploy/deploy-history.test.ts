import { describe, expect, it } from "vitest";

import {
  buildDeployHistoryEntry,
  readFleetRunContextFromEnv,
} from "../../src/post-deploy/deploy-history.js";

describe("deploy history helpers", () => {
  it("fleet env가 없으면 single mode history를 생성한다", () => {
    const entry = buildDeployHistoryEntry({
      deployedAt: "2026-04-23T00:00:00.000Z",
      version: "v1",
      env: "dev",
      provider: "local",
      endpoint: "http://localhost:3200",
      duration: 123,
      success: true,
      triggeredBy: "manual",
      configPath: "packages/infra-engine/config/dev.json",
    });

    expect(entry).toMatchObject({
      mode: "single",
      runId: undefined,
      configPath: "packages/infra-engine/config/dev.json",
    });
  });

  it("fleet env가 있으면 fleet-service mode history를 생성한다", () => {
    const fleet = readFleetRunContextFromEnv({
      QA_FLEET_RUN_ID: "fleet-123",
      QA_FLEET_MODE: "all",
      QA_FLEET_SCOPE: "all",
      QA_FLEET_CONFIG_PATH: "packages/infra-engine/config/dev.json",
    });
    const entry = buildDeployHistoryEntry({
      deployedAt: "2026-04-23T00:00:00.000Z",
      version: "v1",
      env: "dev",
      provider: "local",
      endpoint: "http://localhost:3200",
      duration: 123,
      success: true,
      triggeredBy: "manual",
    }, fleet);

    expect(entry).toMatchObject({
      mode: "fleet-service",
      runId: "fleet-123",
      scope: "all",
      configPath: "packages/infra-engine/config/dev.json",
    });
  });
});
