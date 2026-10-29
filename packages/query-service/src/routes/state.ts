// @def.boundary query-api-spec
// @def.doc query-api-spec

/**
 * Transition State 질의 API.
 *
 * GET /state/:contextId/:resourceId          — 현재 축 스냅샷
 * GET /state/:contextId/:resourceId/history   — transition instance 이력
 * GET /state/:contextId/:resourceId/at        — 시점 상태 (replay)
 * GET /transitions?context_id=                — context별 전이 목록 (createTransitionRoutes)
 *
 * 필요한 저장소가 없으면 501 Not Implemented — 빈 결과로 성공을 가장하지 않는다.
 */

import { Hono } from 'hono';
import { AppError } from '../lib/errors.js';
import type { ReplayRecordStore } from '../lib/replay-record-store.js';
import type { ReplayCache } from '../lib/replay-cache.js';
import { replayCacheKey } from '../lib/replay-cache.js';
import type { StoredRecord } from '@qa-sdk/core';

/** 최소 StateStore 인터페이스 (동기/비동기 모두 호환) */
export interface StateStorePort {
  snapshot(
    contextId: string,
    resourceId: string,
  ): Record<string, string> | Promise<Record<string, string>>;
}

/** TransitionInstance 저장소 (선택) */
export interface TransitionInstanceStorePort {
  findByContext(contextId: string, limit?: number): Promise<readonly Record<string, unknown>[]>;
  findByContextAndResource(
    contextId: string,
    resourceId: string,
  ): Promise<readonly Record<string, unknown>[]>;
}

/** TransitionEngine 최소 포트 — 이벤트 replay */
export interface TransitionEnginePort {
  process(events: readonly TransitionEventLike[]): { instances: readonly unknown[] };
}

export interface ReplayStateStorePort extends StateStorePort {
  clear(): void;
}

export type ReplayTransitionResolver = (
  events: readonly TransitionEventLike[],
  contextId: string,
  resourceId: string,
) => Promise<Record<string, string>> | Record<string, string>;

interface TransitionEventLike {
  log_id: string;
  timestamp: string;
  event_key: string;
  address_context?: Readonly<Record<string, string>>;
  payload?: unknown;
}

export interface StateRouteDeps {
  stateStore?: StateStorePort;
  transitionStore?: TransitionInstanceStorePort;
  /** 시점 replay용 레코드 저장소 (선택) */
  recordStore?: ReplayRecordStore;
  /** TransitionEngine (선택 — 있으면 정확한 전이 replay, 없으면 address_context 축약) */
  transitionEngine?: TransitionEnginePort;
  /** 정확 replay용 상태 저장소 (없으면 transitionEngine은 fallback 모드) */
  replayStateStore?: ReplayStateStorePort;
  /** 상태 재생성 전용 resolver (있으면 transitionEngine보다 우선) */
  replayTransition?: ReplayTransitionResolver;
  /** replay 캐시 (선택) */
  replayCache?: ReplayCache;
}

export function createStateRoutes(deps: StateRouteDeps) {
  const app = new Hono();

  // GET /state/:contextId/:resourceId — 현재 축 스냅샷
  app.get('/:contextId/:resourceId', async (c) => {
    if (!deps.stateStore) return c.json({ error: 'transition state store not configured' }, 501);

    const { contextId, resourceId } = c.req.param();
    const snapshot = await deps.stateStore.snapshot(contextId, resourceId);
    return c.json({ contextId, resourceId, state: snapshot });
  });

  // GET /state/:contextId/:resourceId/history — transition instance 이력
  app.get('/:contextId/:resourceId/history', async (c) => {
    if (!deps.transitionStore)
      return c.json({ error: 'transition instance store not configured' }, 501);

    const { contextId, resourceId } = c.req.param();
    const instances = await deps.transitionStore.findByContextAndResource(contextId, resourceId);
    return c.json({ contextId, resourceId, instances });
  });

  // GET /state/:contextId/:resourceId/at?ts= — 시점 상태 (replay)
  app.get('/:contextId/:resourceId/at', async (c) => {
    const ts = c.req.query('ts');
    if (!ts) return c.json({ error: 'ts query parameter required' }, 400);

    const { contextId, resourceId } = c.req.param();

    // recordStore가 있으면 시점 replay
    if (deps.recordStore) {
      const targetTime = new Date(ts);
      if (Number.isNaN(targetTime.getTime())) {
        return c.json({ error: 'invalid timestamp format (ISO-8601 required)' }, 400);
      }

      // 캐시 확인
      const cacheKey = replayCacheKey(contextId, resourceId, ts);
      const cached = deps.replayCache?.get(cacheKey);
      if (cached) {
        return c.json({
          contextId,
          resourceId,
          timestamp: ts,
          state: cached.state,
          recordCount: cached.recordCount,
          mode: 'replay',
          cached: true,
        });
      }

      const records = await deps.recordStore.findByTimeRange({ to: targetTime, limit: 10000 });
      const relevant = filterByContext(records, contextId, resourceId);

      let replayedState: Record<string, string>;
      let mode: string;

      if (deps.replayTransition && relevant.length > 0) {
        replayedState = await deps.replayTransition(
          relevant.map(toTransitionEvent),
          contextId,
          resourceId,
        );
        mode = 'engine-replay';
      } else if (deps.transitionEngine && deps.replayStateStore && relevant.length > 0) {
        deps.replayStateStore.clear();
        deps.transitionEngine.process(relevant.map(toTransitionEvent));
        replayedState = await deps.replayStateStore.snapshot(contextId, resourceId);
        mode = 'engine-replay';
      } else {
        // 정확 replay resolver가 없으면 address_context 기반 축약으로만 응답
        replayedState = mergeAddressContexts(relevant);
        mode = deps.transitionEngine ? 'replay-fallback' : 'replay';
      }

      // 캐시 저장
      deps.replayCache?.set(cacheKey, {
        state: replayedState,
        recordCount: relevant.length,
        cachedAt: Date.now(),
      });

      return c.json({
        contextId,
        resourceId,
        timestamp: ts,
        state: replayedState,
        recordCount: relevant.length,
        mode,
        cached: false,
      });
    }

    // recordStore 없으면 현재 상태 fallback
    if (!deps.stateStore) return c.json({ error: 'state store or record store required' }, 501);
    const snapshot = await deps.stateStore.snapshot(contextId, resourceId);
    return c.json({
      contextId,
      resourceId,
      timestamp: ts,
      state: snapshot,
      mode: 'current-fallback',
    });
  });

  return app;
}

/** `/transitions` 마운트 — context별 전이 목록 (`/state`와 따로 마운트해 경로가 겹치지 않게 한다) */
export function createTransitionRoutes(deps: Pick<StateRouteDeps, 'transitionStore'>) {
  const app = new Hono();

  // GET /transitions?context_id=&limit= — context별 전이 목록
  app.get('/', async (c) => {
    if (!deps.transitionStore)
      return c.json({ error: 'transition instance store not configured' }, 501);

    const contextId = c.req.query('context_id');
    if (!contextId) return c.json({ error: 'context_id query parameter required' }, 400);

    const limit = Number(c.req.query('limit') ?? 50);
    const instances = await deps.transitionStore.findByContext(contextId, limit);
    return c.json({ contextId, instances, count: instances.length });
  });

  return app;
}

// ── 헬퍼 ──────────────────────────────────────────────

function filterByContext(
  records: StoredRecord[],
  contextId: string,
  resourceId: string,
): StoredRecord[] {
  return records.filter((r) => {
    const addressContext = r.addressContext ?? {};
    const payload = isRecordObject(r.payload) ? r.payload : null;

    const matchedContext = hasExplicitId(addressContext, payload, contextId, [
      'context_id',
      'contextId',
    ]);
    const matchedResource = hasExplicitId(addressContext, payload, resourceId, [
      'resource_id',
      'resourceId',
    ]);

    return matchedContext && matchedResource;
  });
}

function mergeAddressContexts(records: StoredRecord[]): Record<string, string> {
  const state: Record<string, string> = {};
  for (const r of records) {
    if (r.addressContext) Object.assign(state, r.addressContext);
  }
  return state;
}

function toTransitionEvent(r: StoredRecord): TransitionEventLike {
  return {
    log_id: r.logId,
    timestamp: r.timestamp.toISOString(),
    event_key: r.eventKey,
    address_context: r.addressContext,
    payload: r.payload,
  };
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExplicitId(
  addressContext: Record<string, string>,
  payload: Record<string, unknown> | null,
  expected: string,
  keys: readonly string[],
): boolean {
  for (const key of keys) {
    if (addressContext[key] === expected) return true;
    if (payload && payload[key] === expected) return true;
  }
  return false;
}
