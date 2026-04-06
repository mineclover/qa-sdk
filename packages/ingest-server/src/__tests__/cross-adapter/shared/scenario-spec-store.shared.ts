import type { ScenarioSpecStore } from "@qa-sdk/core";
import type { ScenarioSpec } from "@qa-sdk/core";
import { expect, it, beforeEach, afterEach } from "vitest";

function makeSpec(overrides: Partial<ScenarioSpec> = {}): ScenarioSpec {
  return {
    scenario_id: "sc-1",
    version: "1.0.0",
    domain: "checkout",
    description: "테스트 시나리오",
    steps: [
      {
        id: "step-1",
        event_key: "page.view",
        required: true,
        kind: "sequence",
      },
    ],
    ...overrides,
  };
}

export function scenarioSpecStoreTests(
  factory: () => Promise<{ store: ScenarioSpecStore; cleanup: () => Promise<void> }>,
) {
  let store: ScenarioSpecStore;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ store, cleanup } = await factory());
  });
  afterEach(async () => cleanup());

  it("upsert + findById", async () => {
    const spec = makeSpec();
    await store.upsert(spec);
    const result = await store.findById("sc-1");
    expect(result).not.toBeNull();
    expect(result!.scenario_id).toBe("sc-1");
    expect(result!.domain).toBe("checkout");
    expect(result!.steps).toHaveLength(1);
  });

  it("findByDomain 필터링", async () => {
    await store.upsert(makeSpec({ scenario_id: "sc-1", domain: "checkout" }));
    await store.upsert(makeSpec({ scenario_id: "sc-2", domain: "checkout" }));
    await store.upsert(makeSpec({ scenario_id: "sc-3", domain: "payment" }));

    const checkoutSpecs = await store.findByDomain("checkout");
    expect(checkoutSpecs).toHaveLength(2);

    const paymentSpecs = await store.findByDomain("payment");
    expect(paymentSpecs).toHaveLength(1);
  });

  it("remove → true, 이후 findById → null", async () => {
    await store.upsert(makeSpec({ scenario_id: "sc-remove" }));
    const removed = await store.remove("sc-remove");
    expect(removed).toBe(true);
    const result = await store.findById("sc-remove");
    expect(result).toBeNull();
  });

  it("findById 미존재 → null", async () => {
    const result = await store.findById("nonexistent");
    expect(result).toBeNull();
  });

  it("upsert 덮어쓰기 — 같은 scenarioId", async () => {
    await store.upsert(makeSpec({ scenario_id: "sc-overwrite", version: "1.0.0", description: "v1" }));
    await store.upsert(makeSpec({ scenario_id: "sc-overwrite", version: "2.0.0", description: "v2" }));
    const result = await store.findById("sc-overwrite");
    expect(result).not.toBeNull();
    expect(result!.version).toBe("2.0.0");
  });

  it("findAll limit 적용", async () => {
    await store.upsert(makeSpec({ scenario_id: "sc-a", domain: "auth" }));
    await store.upsert(makeSpec({ scenario_id: "sc-b", domain: "auth" }));
    await store.upsert(makeSpec({ scenario_id: "sc-c", domain: "payment" }));
    const results = await store.findAll(2);
    expect(results).toHaveLength(2);
  });
}
