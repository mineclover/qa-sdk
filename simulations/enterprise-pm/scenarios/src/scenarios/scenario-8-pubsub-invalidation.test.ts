import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { runScenario } from "../runner/runner.js";
import { scenario8PubsubInvalidation } from "./scenario-8-pubsub-invalidation.js";
import type { InProcessHandle } from "../env/in-process-env.js";

// 본 시나리오는 in-process bootstrap 으로 동작 (BitmapCacheModule 비활성 — publish no-op 허용).
// 실 Redis 통합 검증은 http 모드 / Plan 14b 에서 수행.
const SKIP = process.env.SIM_SCENARIO_INPROC !== "1";

describe.skipIf(SKIP)("Scenario 8 — pub/sub invalidation", () => {
  let handle: InProcessHandle;
  beforeAll(async () => {
    const { bootstrapInProcess } = await import("../env/in-process-env.js");
    handle = await bootstrapInProcess({
      jwtSecret: "x".repeat(32),
      dialect: "sqlite",
    });
    const g = globalThis as unknown as {
      __simGatewayFetch: typeof handle.gatewayFetch;
      __simHandle: typeof handle;
    };
    g.__simGatewayFetch = handle.gatewayFetch;
    g.__simHandle = handle;
  }, 60_000);
  afterAll(async () => {
    if (handle) await handle.cleanup();
  });

  it("scenario 8 통과 — 권한 변경 후 새 login → fresh bitmap", async () => {
    const result = await runScenario(scenario8PubsubInvalidation, {
      gatewayUrl: "http://sim-inproc",
      mode: "in-process",
    });
    if (result.status !== "passed") {
      console.error("[Scenario 8 실패]", result.error);
    }
    expect(result.status).toBe("passed");
  }, 30_000);
});
