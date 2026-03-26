import type { EventSchemaStore } from "../stores/event-schema-store.js";
import type { SeedLogger } from "./types.js";

/** 기본 no-op 로거 */
const noopLogger: SeedLogger = {
  info() {},
  warn() {},
  debug() {},
};

/** EventSchema seed — event-catalog + prefix-mapping 기반 자동 등록 */
export async function seedEventSchemas(store: EventSchemaStore, logger: SeedLogger = noopLogger) {
  try {
    const ec = await import("@qa-sdk/event-catalog");
    const now = new Date().toISOString();
    let count = 0;

    // 1. core events (60개) — SDK 표준 이벤트
    for (const event of ec.allCoreEvents) {
      await store.upsert({
        catalogId: "demo",
        serviceId: "_core",
        eventKey: event.event_key,
        eventVersion: event.event_version.padStart(3, "0"),
        displayName: event.display_name,
        description: event.description,
        recordKind: "log",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      count++;
    }

    // 2. prefix-mapping 이벤트 (11개) — 비즈니스 이벤트
    for (const mapping of ec.getAllMappings()) {
      const prefixes = mapping.prefixes.map((p) => p.prefixId);
      await store.upsert({
        catalogId: "demo",
        serviceId: "shopping-web",
        eventKey: mapping.event_key,
        eventVersion: "001",
        displayName: `${mapping.event_key} (${mapping.domain})`,
        description: `prefix: ${prefixes.join(", ")}`,
        recordKind: "log",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      count++;
    }

    logger.info({ count }, "seeded event schemas from event-catalog");
  } catch {
    logger.debug?.("event-catalog not available — event schema seed skipped");
  }
}
