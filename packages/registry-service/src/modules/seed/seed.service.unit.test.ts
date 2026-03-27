import { afterEach, describe, expect, it, vi } from "vitest";
import type { DefinitionClient } from "@qa-sdk/definition-client";
import { InMemoryAxisProfileStore } from "../../stores/in-memory-axis-profile-store.js";
import { InMemoryCatalogStore } from "../../stores/in-memory-catalog-store.js";
import { InMemoryConfigStore } from "../../stores/in-memory-config-store.js";
import { InMemoryEventSchemaStore } from "../../stores/in-memory-event-schema-store.js";
import { InMemoryServiceEndpointStore } from "../../stores/in-memory-service-endpoint-store.js";
import { SeedService } from "./seed.service.js";

function createService(definitionClient?: Partial<DefinitionClient>) {
  const catalogStore = new InMemoryCatalogStore();
  const configStore = new InMemoryConfigStore();
  const endpointStore = new InMemoryServiceEndpointStore();
  const eventSchemaStore = new InMemoryEventSchemaStore();
  const axisStore = new InMemoryAxisProfileStore();

  return {
    service: new SeedService(
      catalogStore,
      configStore,
      endpointStore,
      eventSchemaStore,
      axisStore,
      definitionClient as DefinitionClient,
    ),
    catalogStore,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SeedService definition-client integration", () => {
  it("seed 완료 후 definition-service sync를 트리거한다", async () => {
    const triggerSync = vi.fn<DefinitionClient["triggerSync"]>().mockResolvedValue({
      synced: 4,
      unchanged: 2,
      created: 2,
      errors: [],
      timestamp: "2026-03-27T00:00:00.000Z",
    });
    const { service, catalogStore } = createService({ triggerSync });

    await service.onModuleInit();

    expect(triggerSync).toHaveBeenCalledTimes(1);
    expect(await catalogStore.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "demo" }),
      ]),
    );
  });

  it("definition-service가 실패해도 seed는 fail-open으로 완료된다", async () => {
    const triggerSync = vi.fn<DefinitionClient["triggerSync"]>().mockRejectedValue(new Error("offline"));
    const { service, catalogStore } = createService({ triggerSync });

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(triggerSync).toHaveBeenCalledTimes(1);
    expect(await catalogStore.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "demo" }),
      ]),
    );
  });
});
