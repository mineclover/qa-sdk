/**
 * /api/event-catalog — 이벤트 카탈로그 + prefix 매핑 탐색 API.
 *
 * event-catalog 패키지의 데이터를 HTTP API로 노출.
 * platform-demo의 이벤트 탐색기에서 소비.
 */

import { Hono } from "hono";
import type { Channel, DimSource } from "@qa-sdk/event-catalog";

export function createEventCatalogRoutes() {
  const routes = new Hono();

  // 동적 import — event-catalog는 optional
  type EventCatalogModule = typeof import("@qa-sdk/event-catalog");

  function isChannel(value: string): value is Channel {
    return ["browser", "mobile", "backend", "sdk", "agent", "common", "qa"].includes(value);
  }

  let _loaded: EventCatalogModule | null = null;
  async function load(): Promise<EventCatalogModule | null> {
    if (_loaded) return _loaded;
    try {
      _loaded = await import("@qa-sdk/event-catalog");
      return _loaded;
    } catch {
      return null;
    }
  }

  // GET /api/event-catalog — 전체 카탈로그 요약
  routes.get("/api/event-catalog", async (c) => {
    const ec = await load();
    if (!ec) return c.json({ error: "event-catalog not available" }, 503);

    const categories: Record<string, number> = {};
    for (const [cat, evts] of Object.entries(ec.coreEventsByCategory)) {
      categories[cat] = evts.length;
    }

    return c.json({
      totalEvents: ec.allCoreEvents.length,
      categories,
      v1MinimalCount: ec.v1MinimalSet.length,
      autoCollectable: ec.allCoreEvents.filter((e) => e.auto_collectable).length,
      prefixMappings: ec.getAllMappings().length,
      payloadGuides: ec.payloadGuides.length,
    });
  });

  // GET /api/event-catalog/events — 전체 이벤트 목록
  routes.get("/api/event-catalog/events", async (c) => {
    const ec = await load();
    if (!ec) return c.json({ error: "event-catalog not available" }, 503);

    const category = c.req.query("category");
    const channel = c.req.query("channel");
    let events = [...ec.allCoreEvents];

    if (category) events = events.filter((e) => e.category === category);
    if (channel && isChannel(channel)) events = events.filter((e) => e.channel.includes(channel));

    return c.json(events.map((e) => ({
      event_key: e.event_key,
      event_version: e.event_version,
      category: e.category,
      channel: e.channel,
      display_name: e.display_name,
      description: e.description,
      auto_collectable: e.auto_collectable,
      graph_hint: e.graph_hint,
      is_v1_minimal: ec.isV1MinimalEvent(e.event_key),
    })));
  });

  // GET /api/event-catalog/events/:key — 단건 이벤트 상세
  routes.get("/api/event-catalog/events/:key", async (c) => {
    const ec = await load();
    if (!ec) return c.json({ error: "event-catalog not available" }, 503);

    const key = c.req.param("key");
    const event = ec.getCoreEvent(key);
    const guide = ec.getPayloadGuide(key);
    const mapping = ec.getMapping(key);

    if (!event && !mapping) return c.json({ error: `Event '${key}' not found` }, 404);

    return c.json({
      event: event ?? null,
      payloadGuide: guide ?? null,
      prefixMapping: mapping ? {
        event_key: mapping.event_key,
        domain: mapping.domain,
        prefixes: mapping.prefixes.map((p) => ({
          prefixId: p.prefixId,
          dims: Object.entries(p.dims).map(([label, source]: [string, DimSource]) => ({
            label,
            source: source.kind,
            value: source.kind === "fixed" ? source.value : source.kind === "context" ? `ctx.${source.contextKey}` : `payload.${source.payloadKey}`,
          })),
        })),
      } : null,
    });
  });

  // GET /api/event-catalog/mappings — prefix 매핑 목록
  routes.get("/api/event-catalog/mappings", async (c) => {
    const ec = await load();
    if (!ec) return c.json({ error: "event-catalog not available" }, 503);

    const mappings = ec.getAllMappings();
    return c.json(mappings.map((m) => ({
      event_key: m.event_key,
      domain: m.domain,
      prefixCount: m.prefixes.length,
      prefixes: m.prefixes.map((p) => p.prefixId),
    })));
  });

  // GET /api/event-catalog/categories — 카테고리별 이벤트 수
  routes.get("/api/event-catalog/categories", async (c) => {
    const ec = await load();
    if (!ec) return c.json({ error: "event-catalog not available" }, 503);

    return c.json(Object.entries(ec.coreEventsByCategory).map(([cat, evts]) => ({
      category: cat,
      count: evts.length,
      events: evts.map((e) => ({
        event_key: e.event_key,
        display_name: e.display_name,
        auto_collectable: e.auto_collectable,
      })),
    })));
  });

  return routes;
}
