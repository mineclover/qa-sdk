import { describe, expect, it } from "vitest";
import { InMemoryConfigStore } from "../stores/in-memory-config-store.js";
import { InMemoryEventSchemaStore } from "../stores/in-memory-event-schema-store.js";
import { seedEventSchemas } from "./seed-events.js";

describe("seedEventSchemas", () => {
  it("mapping 기반 이벤트를 _mapping bucket에 seed하고 후보 서비스를 description에 남긴다", async () => {
    const eventStore = new InMemoryEventSchemaStore();
    const configStore = new InMemoryConfigStore();

    await configStore.set("demo", "services", JSON.stringify([
      {
        serviceId: "shopping-web",
        ownedPrefixes: ["page_view", "tracking", "cart_event", "auth_event"],
      },
      {
        serviceId: "shopping-backend",
        ownedPrefixes: ["order_event", "endpoint", "event"],
      },
    ]));

    await seedEventSchemas(eventStore, configStore);

    const pageView = await eventStore.get("demo", "_mapping", "page.view", "001");
    expect(pageView).not.toBeNull();
    expect(pageView?.description).toContain("prefix: page_view, tracking");
    expect(pageView?.description).toContain("candidates: shopping-web");

    const paymentSuccess = await eventStore.get("demo", "_mapping", "payment.success", "001");
    expect(paymentSuccess).not.toBeNull();
    expect(paymentSuccess?.description).toContain("candidates: shopping-backend, shopping-web");

    const legacy = await eventStore.get("demo", "shopping-web", "page.view", "001");
    expect(legacy).toBeNull();
  });

  it("services config가 없어도 mapping 이벤트를 _mapping bucket에 seed한다", async () => {
    const eventStore = new InMemoryEventSchemaStore();

    await seedEventSchemas(eventStore);

    const pageView = await eventStore.get("demo", "_mapping", "page.view", "001");
    expect(pageView).not.toBeNull();
    expect(pageView?.description).toContain("candidates: none");
  });
});
