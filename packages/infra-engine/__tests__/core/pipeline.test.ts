import { describe, it, expect, vi } from "vitest";
import { createPipeline } from "../../src/core/pipeline.js";
import type { DeployContext, Stage } from "../../src/core/types.js";

function makeCtx(overrides?: Partial<DeployContext>): DeployContext {
  return {
    service: "test-svc",
    provider: "local",
    env: "dev",
    region: "local",
    configPath: "config/dev.yaml",
    triggeredBy: "manual",
    ...overrides,
  };
}

function stubStage(name: string, effect?: (ctx: DeployContext) => DeployContext): Stage {
  return {
    name,
    execute: vi.fn(async (ctx) => (effect ? effect(ctx) : ctx)),
    rollback: vi.fn(async () => {}),
  };
}

describe("createPipeline", () => {
  it("순차 실행 — 모든 스테이지가 순서대로 호출", async () => {
    const order: string[] = [];
    const s1 = stubStage("a", (ctx) => { order.push("a"); return ctx; });
    const s2 = stubStage("b", (ctx) => { order.push("b"); return ctx; });

    const pipeline = createPipeline([s1, s2]);
    const result = await pipeline.run(makeCtx());

    expect(order).toEqual(["a", "b"]);
    expect(result.success).toBe(true);
    expect(result.stageResults).toHaveLength(2);
    expect(result.stageResults[0].stage).toBe("a");
    expect(result.stageResults[0].status).toBe("success");
  });

  it("실패 시 역순 rollback", async () => {
    const rollbackOrder: string[] = [];
    const s1: Stage = {
      name: "s1",
      execute: vi.fn(async (ctx) => ctx),
      rollback: vi.fn(async () => { rollbackOrder.push("s1"); }),
    };
    const s2: Stage = {
      name: "s2",
      execute: vi.fn(async () => { throw new Error("boom"); }),
      rollback: vi.fn(async () => { rollbackOrder.push("s2"); }),
    };

    const pipeline = createPipeline([s1, s2]);
    const result = await pipeline.run(makeCtx());

    expect(result.success).toBe(false);
    expect(rollbackOrder).toEqual(["s1"]); // s2는 실패했으므로 s1만 rollback
    expect(result.stageResults[1].status).toBe("failed");
    expect(result.stageResults[0].status).toBe("rolled_back");
  });

  it("rollback 없는 스테이지는 건너뜀", async () => {
    const s1: Stage = { name: "s1", execute: vi.fn(async (ctx) => ctx) }; // rollback 없음
    const s2: Stage = {
      name: "s2",
      execute: vi.fn(async () => { throw new Error("fail"); }),
    };

    const pipeline = createPipeline([s1, s2]);
    const result = await pipeline.run(makeCtx());

    expect(result.success).toBe(false);
    expect(result.stageResults[0].status).toBe("skipped"); // rollback 없어서 skipped
  });

  it("duration 측정", async () => {
    const slow: Stage = {
      name: "slow",
      execute: async (ctx) => {
        await new Promise((r) => setTimeout(r, 50));
        return ctx;
      },
    };

    const pipeline = createPipeline([slow]);
    const result = await pipeline.run(makeCtx());

    expect(result.duration).toBeGreaterThanOrEqual(40);
    expect(result.stageResults[0].duration).toBeGreaterThanOrEqual(40);
  });
});
