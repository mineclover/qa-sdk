// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * /v1/key-observations — 관측된 좌표(packed_key) 조회 API (U-4).
 *
 * 설계한 좌표 공간과 실제 관측된 좌표 공간의 차이를 본다.
 * - summary: 전체·prefix별 관측 현황
 * - unregistered: catalog에 없는 key (drift)
 * - prefixes/:prefixId: 한 prefix의 관측 key 목록
 */
import type { KeyObservationStore } from '@qa-sdk/core';
import { Hono } from 'hono';

export interface KeyObservationRouteDeps {
  keyObservationStore?: KeyObservationStore;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

function parseLimit(raw: string | undefined): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) return DEFAULT_LIMIT;
  return Math.min(value, MAX_LIMIT);
}

export function createKeyObservationRoutes(deps: KeyObservationRouteDeps) {
  const routes = new Hono();

  routes.use('/v1/key-observations/*', async (c, next) => {
    if (!deps.keyObservationStore) {
      return c.json({ status: 'inactive', message: 'key observation store 미구성' }, 503);
    }
    await next();
  });

  routes.get('/v1/key-observations/summary', async (c) => {
    const store = deps.keyObservationStore!;
    const [summary, prefixes] = await Promise.all([store.summary(), store.prefixSummary()]);
    return c.json({ summary, prefixes });
  });

  routes.get('/v1/key-observations/unregistered', async (c) => {
    const items = await deps.keyObservationStore!.findUnregistered({
      limit: parseLimit(c.req.query('limit')),
    });
    return c.json({ items });
  });

  routes.get('/v1/key-observations/prefixes/:prefixId', async (c) => {
    const orderBy = c.req.query('orderBy') === 'last_seen' ? 'last_seen' : 'count';
    const items = await deps.keyObservationStore!.findByPrefix(c.req.param('prefixId'), {
      limit: parseLimit(c.req.query('limit')),
      orderBy,
    });
    return c.json({ items });
  });

  return routes;
}
