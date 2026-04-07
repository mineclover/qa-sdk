import type { EventSchemaStore } from "../stores/event-schema-store.js";
import type { ConfigStore } from "../stores/config-store.js";
import type { SeedLogger } from "./types.js";

/** 기본 no-op 로거 */
const noopLogger: SeedLogger = {
  info() {},
  warn() {},
  debug() {},
};

interface SeedServiceConfigRecord {
  readonly serviceId: string;
  readonly ownedPrefixes?: readonly string[];
}

interface ServiceEventAdoptionRecord {
  readonly serviceId: string;
  readonly eventPacks?: readonly string[];
  readonly customEvents?: readonly string[];
  readonly allowedCategories?: readonly string[];
}

const MAPPING_SERVICE_ID = "_mapping";
const CORE_SERVICE_ID = "_core";
const ADOPTION_CONFIG_TYPE = "event-adoption";

async function listServices(
  configStore?: ConfigStore,
  catalogId = "demo",
): Promise<SeedServiceConfigRecord[]> {
  if (!configStore) return [];
  const record = await configStore.get(catalogId, "services");
  if (!record) return [];
  try {
    const parsed = JSON.parse(record.data);
    return Array.isArray(parsed) ? parsed as SeedServiceConfigRecord[] : [];
  } catch {
    return [];
  }
}

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

function findCandidateServices(
  services: readonly SeedServiceConfigRecord[],
  prefixes: readonly string[],
): string[] {
  return services
    .filter((service) => {
      const owned = service.ownedPrefixes ?? [];
      return owned.some((prefixId) => prefixes.includes(prefixId));
    })
    .map((service) => service.serviceId)
    .sort((a, b) => a.localeCompare(b));
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
    const services = await listServices(configStore, "demo");
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
        for (const packId of adoption.eventPacks ?? []) {
          const pack = ec.getPack(packId);
          if (!pack) continue;
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
              packs: [pack.packId],
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
      // 3. adoption이 없으면 Phase 0 fallback — 실제 서비스 귀속이 아닌 전역 해석 규칙
      for (const mapping of ec.getAllMappings()) {
        const prefixes = mapping.prefixes.map((p) => p.prefixId);
        const candidates = findCandidateServices(services, prefixes);
        const candidateSuffix = candidates.length > 0
          ? ` | candidates: ${candidates.join(", ")}`
          : " | candidates: none";
        await store.upsert({
          catalogId: "demo",
          serviceId: MAPPING_SERVICE_ID,
          eventKey: mapping.event_key,
          eventVersion: "001",
          displayName: `${mapping.event_key} (${mapping.domain})`,
          description: `prefix: ${prefixes.join(", ")}${candidateSuffix}`,
          recordKind: "log",
          status: "active",
          createdAt: now,
          updatedAt: now,
        });
        count++;
      }
    }

    logger.info({ count, services: services.length, adoptions: adoptions.length }, "seeded event schemas from event-catalog");
  } catch {
    logger.debug?.("event-catalog not available — event schema seed skipped");
  }
}
