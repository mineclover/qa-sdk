// @def.boundary registry-system
// @def.doc registry-system

import { describe, expect, it } from "vitest";
import { InMemoryConfigStore } from "../stores/in-memory-config-store.js";
import { InMemoryEventSchemaStore } from "../stores/in-memory-event-schema-store.js";
import { seedEventSchemas } from "./seed-events.js";

describe("seedEventSchemas", () => {
  it("event-adoption config가 없으면 core vocabulary만 seed한다", async () => {
    const eventStore = new InMemoryEventSchemaStore();

    await seedEventSchemas(eventStore);

    const core = await eventStore.get("demo", "_core", "click", "001");
    expect(core).not.toBeNull();
    expect(await eventStore.get("demo", "_mapping", "page.view", "001")).toBeNull();
    expect(await eventStore.get("demo", "shopping-web", "page.view", "001")).toBeNull();
  });

  it("event-adoption config가 있으면 service별로 materialize한다", async () => {
    const eventStore = new InMemoryEventSchemaStore();
    const configStore = new InMemoryConfigStore();

    await configStore.set("demo", "event-adoption", JSON.stringify([
      { serviceId: "shopping-web", eventPacks: [{ packId: "shop-pack", version: "v1" }] },
      { serviceId: "infra-controller", eventPacks: [{ packId: "infra-observe-pack", version: "v1" }] },
    ]));

    await seedEventSchemas(eventStore, configStore);

    const shop = await eventStore.get("demo", "shopping-web", "page.view", "001");
    expect(shop).not.toBeNull();
    expect(shop?.description).toContain("packs: shop-pack@v1");

    const infra = await eventStore.get("demo", "infra-controller", "metric.collected", "001");
    expect(infra).not.toBeNull();
    expect(infra?.description).toContain("packs: infra-observe-pack@v1");

    expect(await eventStore.get("demo", "_mapping", "page.view", "001")).toBeNull();
  });

  it("allowedCategories가 있으면 해당 category의 event만 materialize한다", async () => {
    const eventStore = new InMemoryEventSchemaStore();
    const configStore = new InMemoryConfigStore();

    await configStore.set("demo", "event-adoption", JSON.stringify([
      {
        serviceId: "shopping-web",
        eventPacks: [{ packId: "shop-pack", version: "v1" }],
        allowedCategories: ["navigation"],
      },
    ]));

    await seedEventSchemas(eventStore, configStore);

    expect(await eventStore.get("demo", "shopping-web", "page.view", "001")).not.toBeNull();
    expect(await eventStore.get("demo", "shopping-web", "auth.login", "001")).toBeNull();
  });

  it("pack version이 맞지 않으면 materialize하지 않는다", async () => {
    const eventStore = new InMemoryEventSchemaStore();
    const configStore = new InMemoryConfigStore();

    await configStore.set("demo", "event-adoption", JSON.stringify([
      { serviceId: "shopping-web", eventPacks: [{ packId: "shop-pack", version: "v999" }] },
    ]));

    await seedEventSchemas(eventStore, configStore);

    expect(await eventStore.get("demo", "shopping-web", "page.view", "001")).toBeNull();
  });

  it("legacy string adoption config는 runtime seed에서 materialize하지 않는다", async () => {
    const eventStore = new InMemoryEventSchemaStore();
    const configStore = new InMemoryConfigStore();

    await configStore.set("demo", "event-adoption", JSON.stringify([
      { serviceId: "shopping-web", eventPacks: ["shop-pack"] },
    ]));

    await seedEventSchemas(eventStore, configStore);

    expect(await eventStore.get("demo", "shopping-web", "page.view", "001")).toBeNull();
  });
});
