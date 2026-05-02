// @def.boundary registry-system
// @def.doc registry-system

import type { EventSchemaStore } from "../stores/event-schema-store.js";
import type { ConfigStore } from "../stores/config-store.js";
import type { SeedLogger } from "./types.js";

/** 기본 no-op 로거 */
const noopLogger: SeedLogger = {
  info() {},
  warn() {},
  debug() {},
};

interface ServiceEventAdoptionRecord {
  readonly serviceId: string;
  readonly eventPacks?: readonly { packId: string; version?: string }[];
  readonly allowedCategories?: readonly string[];
}

type AdoptionPackRef = {
  packId: string;
  version?: string;
};

const CORE_SERVICE_ID = "_core";
const ADOPTION_CONFIG_TYPE = "event-adoption";

async function listAdoptions(
  configStore?: ConfigStore,
  catalogId = "demo",
): Promise<ServiceEventAdoptionRecord[]> {
  if (!configStore) return [];
  const record = await configStore.get(catalogId, ADOPTION_CONFIG_TYPE);
  if (!record) return [];
  try {
    const parsed = JSON.parse(record.data);
    return Array.isArray(parsed) ? parsed as ServiceEventAdoptionRecord[] : [];
  } catch {
    return [];
  }
}

function normalizePackRefs(
  eventPacks: readonly { packId: string; version?: string }[] | undefined,
): AdoptionPackRef[] {
  return (eventPacks ?? []).map((entry) => ({ packId: entry.packId, version: entry.version }));
}

type MaterializedMappingRecord = {
  serviceId: string;
  eventKey: string;
  domain: string;
  prefixes: string[];
  packs: string[];
};

function mergeMaterializedRecord(
  records: Map<string, MaterializedMappingRecord>,
  next: MaterializedMappingRecord,
) {
  const key = `${next.serviceId}:${next.eventKey}`;
  const existing = records.get(key);
  if (!existing) {
    records.set(key, {
      ...next,
      prefixes: [...next.prefixes].sort((a, b) => a.localeCompare(b)),
      packs: [...next.packs].sort((a, b) => a.localeCompare(b)),
    });
    return;
  }

  existing.prefixes = [...new Set([...existing.prefixes, ...next.prefixes])].sort((a, b) => a.localeCompare(b));
  existing.packs = [...new Set([...existing.packs, ...next.packs])].sort((a, b) => a.localeCompare(b));
}

/** EventSchema seed — event-catalog + prefix-mapping 기반 자동 등록 */
export async function seedEventSchemas(
  store: EventSchemaStore,
  configStore?: ConfigStore,
  logger: SeedLogger = noopLogger,
) {
  try {
    const ec = await import("@qa-sdk/event-catalog");
    const now = new Date().toISOString();
    const adoptions = await listAdoptions(configStore, "demo");
    let count = 0;

    // 1. core events — SDK 표준 전역 vocabulary
    for (const event of ec.allCoreEvents) {
      await store.upsert({
        catalogId: "demo",
        serviceId: CORE_SERVICE_ID,
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

    // 2. adoption config가 있으면 service별 materialization을 우선
    if (adoptions.length > 0) {
      const materialized = new Map<string, MaterializedMappingRecord>();
      for (const adoption of adoptions) {
        if (Array.isArray(adoption.eventPacks) && adoption.eventPacks.some((entry) => typeof (entry as unknown) === "string")) {
          logger.warn({ serviceId: adoption.serviceId }, "legacy event pack refs are not supported in runtime seed — migrate adoption config first");
          continue;
        }
        for (const packRef of normalizePackRefs(adoption.eventPacks)) {
          const pack = ec.getPack(packRef.packId);
          if (!pack) continue;
          if (packRef.version && pack.version !== packRef.version) continue;
          for (const mapping of pack.mappings) {
            const category = ec.getCoreEvent(mapping.event_key)?.category ?? mapping.domain;
            if (
              adoption.allowedCategories
              && adoption.allowedCategories.length > 0
              && !adoption.allowedCategories.includes(category)
            ) {
              continue;
            }
            mergeMaterializedRecord(materialized, {
              serviceId: adoption.serviceId,
              eventKey: mapping.event_key,
              domain: mapping.domain,
              prefixes: mapping.prefixes.map((prefix) => prefix.prefixId),
              packs: [`${pack.packId}@${pack.version}`],
            });
          }
        }
      }

      for (const record of materialized.values()) {
        await store.upsert({
          catalogId: "demo",
          serviceId: record.serviceId,
          eventKey: record.eventKey,
          eventVersion: "001",
          displayName: `${record.eventKey} (${record.domain})`,
          description: `prefix: ${record.prefixes.join(", ")} | packs: ${record.packs.join(", ")}`,
          recordKind: "log",
          status: "active",
          createdAt: now,
          updatedAt: now,
        });
        count++;
      }
    } else {
      logger.warn({ catalogId: "demo" }, "event-adoption config missing — mapping event materialization skipped");
    }

    logger.info({ count, adoptions: adoptions.length }, "seeded event schemas from event-catalog");
  } catch {
    logger.debug?.("event-catalog not available — event schema seed skipped");
  }
}
