// @def.boundary registry-system
// @def.doc registry-system

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CompatApp } from '../test/nest-helpers.js';

const TEST_DKG_PATH = '/tmp/registry-service-dashboard-e2e.sqlite';
const originalDashboardEnabled = process.env.DEV_DASHBOARD_ENABLED;
const originalDashboardPath = process.env.DEV_DASHBOARD_DKG_PATH;
const closers: Array<() => Promise<void>> = [];

async function buildDashboardApp(): Promise<CompatApp> {
  vi.resetModules();
  process.env.DEV_DASHBOARD_ENABLED = 'true';
  process.env.DEV_DASHBOARD_DKG_PATH = TEST_DKG_PATH;

  const { AppModule } = await import('../app.module.js');
  const { createNestTestApp, wrapNestApp } = await import('../test/nest-helpers.js');
  const nestApp = await createNestTestApp({ imports: [AppModule] });
  closers.push(() => nestApp.close());
  return wrapNestApp(nestApp);
}

afterEach(async () => {
  while (closers.length > 0) {
    await closers.pop()!();
  }
  if (originalDashboardEnabled === undefined) {
    delete process.env.DEV_DASHBOARD_ENABLED;
  } else {
    process.env.DEV_DASHBOARD_ENABLED = originalDashboardEnabled;
  }
  if (originalDashboardPath === undefined) {
    delete process.env.DEV_DASHBOARD_DKG_PATH;
  } else {
    process.env.DEV_DASHBOARD_DKG_PATH = originalDashboardPath;
  }
});

describe('dashboard-api (Nest)', () => {
  it('GET /api/dashboard/overview — DKG 노드 요약', async () => {
    const app = await buildDashboardApp();
    const res = await app.request('/api/dashboard/overview');
    expect(res.status).toBe(200);
    const data = await res.json<any>();
    expect(data.nodes).toBeTruthy();
    expect(data.total.nodes).toBeGreaterThan(100);
    expect(data.total.edges).toBeGreaterThan(0);
    expect(data.health).toBeTruthy();
    expect(data.observations).toBeTruthy();
  });

  it('GET /api/dashboard/flow-map — 3-layer 구조', async () => {
    const app = await buildDashboardApp();
    const res = await app.request('/api/dashboard/flow-map');
    expect(res.status).toBe(200);
    const data = await res.json<any>();
    expect(data.layers.schema.length).toBeGreaterThan(0);
    expect(data.layers.prefix.length).toBeGreaterThan(30);
    expect(data.layers.consumer.length).toBeGreaterThan(0);
    expect(data.edges.length).toBeGreaterThan(0);
    expect(data.progress.defined).toBeGreaterThan(0);
    expect(data.progress.active).toBe(data.progress.defined);
  });

  it('GET /api/dashboard/metrics — DKG 메트릭 집계', async () => {
    const app = await buildDashboardApp();
    const res = await app.request('/api/dashboard/metrics');
    expect(res.status).toBe(200);
    const data = await res.json<any>();
    expect(data.summary.total).toBeGreaterThan(0);
    expect(data.metrics.length).toBe(data.summary.total);
    expect(data.byCategory).toBeTruthy();
    expect(data.observations).toBeTruthy();
  });

  it('GET /api/dashboard/timeline — 의사결정/관측 이벤트', async () => {
    const app = await buildDashboardApp();
    const res = await app.request('/api/dashboard/timeline');
    expect(res.status).toBe(200);
    const data = await res.json<any>();
    expect(data.total).toBeGreaterThan(0);
    expect(data.events.length).toBeLessThanOrEqual(30);
    for (const event of data.events) {
      expect(event.kind).toBeTruthy();
      expect(event.id).toBeTruthy();
    }
  });
});

describe('dev-dashboard routes (Nest)', () => {
  it('GET /dev/api/overview 노드 종류별 카운트 반환', async () => {
    const app = await buildDashboardApp();
    const res = await app.request('/dev/api/overview');
    expect(res.status).toBe(200);
    const data = await res.json<any>();
    expect(data.nodes.axis).toBeGreaterThan(0);
    expect(data.nodes.prefix).toBeGreaterThan(0);
    expect(data.nodes.domain).toBeGreaterThan(0);
    expect(typeof data.observations.total).toBe('number');
    expect(typeof data.observations.unresolved).toBe('number');
  });

  it('GET /dev/api/flow-map 3-layer 구조 반환', async () => {
    const app = await buildDashboardApp();
    const res = await app.request('/dev/api/flow-map');
    expect(res.status).toBe(200);
    const data = await res.json<any>();
    expect(data.layers.schema).toBeInstanceOf(Array);
    expect(data.layers.prefix).toBeInstanceOf(Array);
    expect(data.layers.consumer).toBeInstanceOf(Array);
    expect(data.layers.schema.length).toBeGreaterThan(0);
    expect(data.layers.prefix.length).toBeGreaterThan(0);
    expect(data.edges).toBeInstanceOf(Array);
    expect(typeof data.progress.defined).toBe('number');
    expect(typeof data.progress.active).toBe('number');
  });

  it('GET /dev/api/metrics metric 요약 + 카테고리별 그룹 반환', async () => {
    const app = await buildDashboardApp();
    const res = await app.request('/dev/api/metrics');
    expect(res.status).toBe(200);
    const data = await res.json<any>();
    expect(typeof data.summary.ok).toBe('number');
    expect(typeof data.summary.total).toBe('number');
    expect(data.summary.ok + data.summary.warning + data.summary.critical).toBe(data.summary.total);
    expect(Object.keys(data.byCategory).length).toBeGreaterThan(0);
    expect(data.metrics.length).toBeGreaterThan(0);
    expect(data.observations).toBeDefined();
  });

  it('GET /dev/api/timeline 시간순 이벤트 반환', async () => {
    const app = await buildDashboardApp();
    const res = await app.request('/dev/api/timeline');
    expect(res.status).toBe(200);
    const data = await res.json<any>();
    expect(data.events.length).toBeGreaterThan(0);
    expect(typeof data.total).toBe('number');
    for (const event of data.events) {
      expect(event).toHaveProperty('kind');
      expect(event).toHaveProperty('id');
      expect(['decision', 'observation', 'version-event']).toContain(event.kind);
    }
    for (let index = 1; index < data.events.length; index++) {
      expect(data.events[index - 1].date >= data.events[index].date).toBe(true);
    }
  });

  it('GET /dev/api/timeline?limit=5 limit 파라미터 동작', async () => {
    const app = await buildDashboardApp();
    const data = await (await app.request('/dev/api/timeline?limit=5')).json<any>();
    expect(data.events.length).toBeLessThanOrEqual(5);
  });

  it('POST /dev/api/refresh 캐시 무효화', async () => {
    const app = await buildDashboardApp();
    const res = await app.request('/dev/api/refresh', { method: 'POST' });
    expect(res.status).toBe(200);
    expect((await res.json<any>()).ok).toBe(true);
  });
});

describe('diagrams routes (Nest)', () => {
  it('GET /api/diagrams 카테고리별 다이어그램 목록', async () => {
    const app = await buildDashboardApp();
    const res = await app.request('/api/diagrams');
    expect(res.status).toBe(200);
    const data = await res.json<Record<string, any[]>>();
    expect(data['intent-links']).toBeTruthy();
    expect(data['intent-links'].length).toBeGreaterThan(0);
    expect(data.dsl).toBeTruthy();
    expect(data.domain).toBeTruthy();
    expect(data.constraint).toBeTruthy();
  });

  it('IntentLink 다이어그램 생성', async () => {
    const app = await buildDashboardApp();
    const res = await app.request('/api/diagrams/intent-links/IL-checkout-flow');
    expect(res.status).toBe(200);
    const data = await res.json<any>();
    expect(data.kind).toBe('intent-links');
    expect(data.mmd).toContain('sequenceDiagram');
  });

  it('DSL 다이어그램 생성', async () => {
    const app = await buildDashboardApp();
    const list = await (await app.request('/api/diagrams')).json<Record<string, any[]>>();
    const firstDsl = list.dsl?.[0];
    if (!firstDsl) {
      return;
    }
    const res = await app.request(`/api/diagrams/dsl/${encodeURIComponent(firstDsl.id)}`);
    expect(res.status).toBe(200);
    expect((await res.json<any>()).mmd).toContain('sequenceDiagram');
  });

  it('Domain 다이어그램 생성', async () => {
    const app = await buildDashboardApp();
    const res = await app.request('/api/diagrams/domain/shopping-domain');
    expect(res.status).toBe(200);
    expect((await res.json<any>()).mmd).toBeTruthy();
  });

  it('Table ER 다이어그램', async () => {
    const app = await buildDashboardApp();
    const res = await app.request('/api/diagrams/table-er/__all__');
    expect(res.status).toBe(200);
    expect((await res.json<any>()).mmd).toContain('erDiagram');
  });

  it('Transition DAG', async () => {
    const app = await buildDashboardApp();
    const res = await app.request('/api/diagrams/transition-dag/__all__');
    expect(res.status).toBe(200);
    expect((await res.json<any>()).mmd).toBeTruthy();
  });

  it('없는 kind → 400', async () => {
    const app = await buildDashboardApp();
    expect((await app.request('/api/diagrams/nonexistent/test')).status).toBe(400);
  });

  it('없는 IntentLink → 400', async () => {
    const app = await buildDashboardApp();
    expect((await app.request('/api/diagrams/intent-links/IL-nonexistent')).status).toBe(400);
  });
});

describe('event-catalog routes (Nest)', () => {
  it('GET /api/event-catalog 전체 요약 반환', async () => {
    const app = await buildDashboardApp();
    const res = await app.request('/api/event-catalog');
    expect(res.status).toBe(200);
    const data = await res.json<any>();
    expect(data.totalEvents).toBeGreaterThan(0);
    expect(Object.keys(data.categories).length).toBeGreaterThanOrEqual(5);
    expect(data.v1MinimalCount).toBeGreaterThan(0);
    expect(data.mappingPacks).toBeGreaterThan(0);
    expect(data.prefixMappings).toBeGreaterThan(0);
  });

  it('GET /api/event-catalog/events 전체 이벤트 목록', async () => {
    const app = await buildDashboardApp();
    const items = await (await app.request('/api/event-catalog/events')).json<any[]>();
    expect(items.length).toBeGreaterThan(0);
    for (const event of items.slice(0, 3)) {
      expect(event.event_key).toBeTruthy();
      expect(event.category).toBeTruthy();
      expect(Array.isArray(event.channel)).toBe(true);
    }
  });

  it('GET /api/event-catalog/events?category=navigation category 필터', async () => {
    const app = await buildDashboardApp();
    const items = await (
      await app.request('/api/event-catalog/events?category=navigation')
    ).json<any[]>();
    expect(items.length).toBeGreaterThan(0);
    for (const event of items) {
      expect(event.category).toBe('navigation');
    }
  });

  it('GET /api/event-catalog/events/:key 이벤트 상세 + payload guide', async () => {
    const app = await buildDashboardApp();
    const res = await app.request('/api/event-catalog/events/click');
    expect(res.status).toBe(200);
    const data = await res.json<any>();
    expect(data.event.event_key).toBe('click');
    expect(data.event.category).toBe('interaction');
  });

  it('GET /api/event-catalog/events/:key 없는 이벤트 → 404', async () => {
    const app = await buildDashboardApp();
    expect((await app.request('/api/event-catalog/events/nonexistent_event_xyz')).status).toBe(404);
  });

  it('GET /api/event-catalog/categories 카테고리별 이벤트 목록', async () => {
    const app = await buildDashboardApp();
    const items = await (await app.request('/api/event-catalog/categories')).json<any[]>();
    expect(items.length).toBeGreaterThanOrEqual(5);
    for (const category of items) {
      expect(category.category).toBeTruthy();
      expect(category.count).toBeGreaterThan(0);
      expect(Array.isArray(category.events)).toBe(true);
    }
  });

  it('GET /api/event-catalog/mappings prefix 매핑 목록', async () => {
    const app = await buildDashboardApp();
    const items = await (await app.request('/api/event-catalog/mappings')).json<any[]>();
    expect(items.length).toBeGreaterThan(0);
    for (const mapping of items) {
      expect(mapping.event_key).toBeTruthy();
      expect(mapping.domain).toBeTruthy();
      expect(Array.isArray(mapping.prefixes)).toBe(true);
    }
  });

  it('GET /api/event-catalog/packs mapping pack 목록', async () => {
    const app = await buildDashboardApp();
    const items = await (await app.request('/api/event-catalog/packs')).json<any[]>();
    expect(items.length).toBeGreaterThan(0);
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packId: 'shop-pack',
          owner: 'shopping-web',
        }),
      ]),
    );
  });

  it('GET /api/event-catalog/adoptions adoption 목록', async () => {
    const app = await buildDashboardApp();
    const items = await (await app.request('/api/event-catalog/adoptions')).json<any[]>();
    expect(Array.isArray(items)).toBe(true);
  });
});
