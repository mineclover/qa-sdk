import { Inject, Injectable } from "@nestjs/common";
import {
  allCoreEvents,
  coreEventsByCategory,
  getAllMappings,
  getAllPacks,
  getCoreEvent,
  getMapping,
  getPack,
  getPayloadGuide,
  isV1MinimalEvent,
  payloadGuides,
  v1MinimalSet,
} from "@qa-sdk/event-catalog";
import type { Channel, DimSource } from "@qa-sdk/event-catalog";
import { AppError } from "@qa-sdk/core";
import type { ConfigStore } from "../../stores/config-store.js";
import { CONFIG_STORE } from "../catalog/catalog.service.js";
import type { EventSchemaStore } from "../../stores/event-schema-store.js";
import { EVENT_SCHEMA_STORE } from "./event-schema.service.js";

type EventCatalogFilters = {
  category?: string;
  channel?: string;
};

@Injectable()
export class EventCatalogService {
  private static readonly ADOPTION_CONFIG_TYPE = "event-adoption";
  private static readonly SERVICES_CONFIG_TYPE = "services";

  constructor(
    @Inject(CONFIG_STORE) private readonly configStore: ConfigStore,
    @Inject(EVENT_SCHEMA_STORE) private readonly eventSchemaStore: EventSchemaStore,
  ) {}

  summary() {
    const categories: Record<string, number> = {};
    for (const [category, events] of Object.entries(coreEventsByCategory)) {
      categories[category] = events.length;
    }

    return {
      totalEvents: allCoreEvents.length,
      categories,
      v1MinimalCount: v1MinimalSet.length,
      autoCollectable: allCoreEvents.filter((event) => event.auto_collectable).length,
      mappingPacks: getAllPacks().length,
      prefixMappings: getAllMappings().length,
      payloadGuides: payloadGuides.length,
    };
  }

  listEvents(filters: EventCatalogFilters) {
    let events = [...allCoreEvents];
    const channel = filters.channel;

    if (filters.category) {
      events = events.filter((event) => event.category === filters.category);
    }

    if (channel && this.isChannel(channel)) {
      events = events.filter((event) => event.channel.includes(channel));
    }

    return events.map((event) => ({
      event_key: event.event_key,
      event_version: event.event_version,
      category: event.category,
      channel: event.channel,
      display_name: event.display_name,
      description: event.description,
      auto_collectable: event.auto_collectable,
      graph_hint: event.graph_hint,
      is_v1_minimal: isV1MinimalEvent(event.event_key),
    }));
  }

  getEventDetails(key: string) {
    const event = getCoreEvent(key);
    const payloadGuide = getPayloadGuide(key);
    const prefixMapping = getMapping(key);

    if (!event && !prefixMapping) {
      throw new AppError("NOT_FOUND", `Event '${key}' not found`, 404);
    }

    return {
      event: event ?? null,
      payloadGuide: payloadGuide ?? null,
      prefixMapping: prefixMapping
        ? {
            event_key: prefixMapping.event_key,
            domain: prefixMapping.domain,
            prefixes: prefixMapping.prefixes.map((prefix) => ({
              prefixId: prefix.prefixId,
              dims: Object.entries(prefix.dims).map(([label, source]: [string, DimSource]) => ({
                label,
                source: source.kind,
                value:
                  source.kind === "fixed"
                    ? source.value
                    : source.kind === "context"
                      ? `ctx.${source.contextKey}`
                      : `payload.${source.payloadKey}`,
              })),
            })),
          }
        : null,
    };
  }

  listMappings() {
    return getAllMappings().map((mapping) => ({
      event_key: mapping.event_key,
      domain: mapping.domain,
      prefixCount: mapping.prefixes.length,
      prefixes: mapping.prefixes.map((prefix) => prefix.prefixId),
    }));
  }

  listPacks() {
    return getAllPacks().map((pack) => ({
      packId: pack.packId,
      owner: pack.owner,
      domain: pack.domain,
      mappingCount: pack.mappings.length,
      eventKeys: pack.mappings.map((mapping) => mapping.event_key),
    }));
  }

  getPack(packId: string) {
    const pack = getPack(packId);
    if (!pack) {
      throw new AppError("NOT_FOUND", `Pack '${packId}' not found`, 404);
    }
    return {
      packId: pack.packId,
      owner: pack.owner,
      domain: pack.domain,
      mappings: pack.mappings.map((mapping) => ({
        event_key: mapping.event_key,
        domain: mapping.domain,
        prefixes: mapping.prefixes.map((prefix) => prefix.prefixId),
      })),
    };
  }

  async listAdoptions(catalogId: string) {
    const record = await this.configStore.get(catalogId, EventCatalogService.ADOPTION_CONFIG_TYPE);
    if (!record) return [];
    const parsed = JSON.parse(record.data);
    return Array.isArray(parsed) ? parsed : [];
  }

  async getServiceAdoption(catalogId: string, serviceId: string) {
    const adoptions = await this.listAdoptions(catalogId);
    const found = adoptions.find((item) => item.serviceId === serviceId);
    if (!found) {
      throw new AppError("NOT_FOUND", `Service adoption '${serviceId}' not found`, 404);
    }
    return found;
  }

  async getServiceTaxonomy(catalogId: string, serviceId: string) {
    const [adoptions, services, materialized] = await Promise.all([
      this.listAdoptions(catalogId),
      this.listServices(catalogId),
      this.eventSchemaStore.listByService(catalogId, serviceId),
    ]);

    const adoption = adoptions.find((item) => item.serviceId === serviceId) ?? null;
    const service = services.find((item) => item.serviceId === serviceId) ?? null;
    const ownedPrefixes = service?.ownedPrefixes ?? [];
    const consumedPrefixes = service?.consumedPrefixes ?? [];
    const ownershipSet = new Set([...ownedPrefixes, ...consumedPrefixes]);

    const prefixUsage = new Set<string>();
    let recordsWithoutPackMetadata = 0;
    for (const record of materialized) {
      const prefixes = extractPrefixedList(record.description, "prefix:");
      prefixes.forEach((prefixId) => prefixUsage.add(prefixId));
      if (!record.description?.includes("packs:")) recordsWithoutPackMetadata++;
    }

    const prefixesWithoutOwnership = [...prefixUsage].filter((prefixId) => !ownershipSet.has(prefixId)).sort((a, b) => a.localeCompare(b));
    const packRefs = normalizePackRefs(adoption?.eventPacks);
    const missingPackIds = packRefs.map((ref) => ref.packId).filter((packId) => !getPack(packId)).sort((a, b) => a.localeCompare(b));
    const stalePackVersions = packRefs
      .filter((ref) => {
        const pack = getPack(ref.packId);
        return !!pack && !!ref.version && pack.version !== ref.version;
      })
      .map((ref) => ({
        packId: ref.packId,
        requestedVersion: ref.version!,
        currentVersion: getPack(ref.packId)!.version,
      }));

    return {
      serviceId,
      adoption,
      ownership: {
        ownedPrefixes,
        consumedPrefixes,
      },
      materialized: {
        count: materialized.length,
        eventKeys: materialized.map((record) => record.eventKey).sort((a, b) => a.localeCompare(b)),
        records: materialized.map((record) => ({
          eventKey: record.eventKey,
          eventVersion: record.eventVersion,
          description: record.description,
        })),
      },
      drift: {
        adoptionMissing: adoption === null,
        missingPackIds,
        stalePackVersions,
        recordsWithoutPackMetadata,
        prefixesWithoutOwnership,
      },
    };
  }

  async checkServiceTaxonomy(catalogId: string, serviceId: string) {
    const taxonomy = await this.getServiceTaxonomy(catalogId, serviceId);
    const issues: Array<{ severity: "warning"; code: string; detail?: unknown }> = [];

    if (taxonomy.drift.adoptionMissing) {
      issues.push({ severity: "warning", code: "adoption-missing" });
    }
    if (taxonomy.drift.missingPackIds.length > 0) {
      issues.push({ severity: "warning", code: "missing-pack-ids", detail: taxonomy.drift.missingPackIds });
    }
    if (taxonomy.drift.stalePackVersions.length > 0) {
      issues.push({ severity: "warning", code: "stale-pack-versions", detail: taxonomy.drift.stalePackVersions });
    }
    if (taxonomy.drift.recordsWithoutPackMetadata > 0) {
      issues.push({ severity: "warning", code: "records-without-pack-metadata", detail: taxonomy.drift.recordsWithoutPackMetadata });
    }
    if (taxonomy.drift.prefixesWithoutOwnership.length > 0) {
      issues.push({ severity: "warning", code: "prefixes-without-ownership", detail: taxonomy.drift.prefixesWithoutOwnership });
    }

    return {
      serviceId,
      ok: issues.length === 0,
      issueCount: issues.length,
      issues,
    };
  }

  private async listServices(catalogId: string): Promise<Array<{ serviceId: string; ownedPrefixes?: string[]; consumedPrefixes?: string[] }>> {
    const record = await this.configStore.get(catalogId, EventCatalogService.SERVICES_CONFIG_TYPE);
    if (!record) return [];
    const parsed = JSON.parse(record.data);
    return Array.isArray(parsed) ? parsed : [];
  }

  listCategories() {
    return Object.entries(coreEventsByCategory).map(([category, events]) => ({
      category,
      count: events.length,
      events: events.map((event) => ({
        event_key: event.event_key,
        display_name: event.display_name,
        auto_collectable: event.auto_collectable,
      })),
    }));
  }

  private isChannel(value: string): value is Channel {
    return ["browser", "mobile", "backend", "sdk", "agent", "common", "qa"].includes(value);
  }
}

function extractPrefixedList(description: string | undefined, marker: string): string[] {
  if (!description) return [];
  const start = description.indexOf(marker);
  if (start < 0) return [];
  const rest = description.slice(start + marker.length).trim();
  const untilPipe = rest.split("|")[0]?.trim() ?? "";
  if (!untilPipe) return [];
  return untilPipe
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizePackRefs(
  eventPacks: readonly (string | { packId: string; version?: string })[] | undefined,
): Array<{ packId: string; version?: string }> {
  return (eventPacks ?? []).map((entry) =>
    typeof entry === "string" ? { packId: entry } : { packId: entry.packId, version: entry.version },
  );
}
