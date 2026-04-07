import { Injectable } from "@nestjs/common";
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

type EventCatalogFilters = {
  category?: string;
  channel?: string;
};

@Injectable()
export class EventCatalogService {
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
