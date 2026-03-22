/**
 * Transition State 질의 API.
 *
 * GET /state/:contextId/:resourceId          — 현재 축 스냅샷
 * GET /state/:contextId/:resourceId/history   — transition instance 이력
 * GET /state/:contextId/:resourceId/at        — 시점 상태 (replay)
 * GET /transitions                            — context별 전이 목록
 *
 * StateStore가 없으면 501 Not Implemented.
 */

import { Hono } from "hono";

/** 최소 StateStore 인터페이스 (동기/비동기 모두 호환) */
export interface StateStorePort {
  snapshot(contextId: string, resourceId: string): Record<string, string> | Promise<Record<string, string>>;
}

/** TransitionInstance 저장소 (선택) */
export interface TransitionInstanceStorePort {
  findByContext(contextId: string, limit?: number): Promise<readonly Record<string, unknown>[]>;
  findByContextAndResource(contextId: string, resourceId: string): Promise<readonly Record<string, unknown>[]>;
}

export interface StateRouteDeps {
  stateStore?: StateStorePort;
  transitionStore?: TransitionInstanceStorePort;
}

export function createStateRoutes(deps: StateRouteDeps) {
  const app = new Hono();

  // GET /state/:contextId/:resourceId — 현재 축 스냅샷
  app.get("/:contextId/:resourceId", async (c) => {
    if (!deps.stateStore) return c.json({ error: "transition state store not configured" }, 501);

    const { contextId, resourceId } = c.req.param();
    const snapshot = await deps.stateStore.snapshot(contextId, resourceId);
    return c.json({ contextId, resourceId, state: snapshot });
  });

  // GET /state/:contextId/:resourceId/history — transition instance 이력
  app.get("/:contextId/:resourceId/history", async (c) => {
    if (!deps.transitionStore) return c.json({ error: "transition instance store not configured" }, 501);

    const { contextId, resourceId } = c.req.param();
    const instances = await deps.transitionStore.findByContextAndResource(contextId, resourceId);
    return c.json({ contextId, resourceId, instances });
  });

  // GET /state/:contextId/:resourceId/at?ts= — 시점 상태 (placeholder)
  app.get("/:contextId/:resourceId/at", async (c) => {
    const ts = c.req.query("ts");
    if (!ts) return c.json({ error: "ts query parameter required" }, 400);
    if (!deps.stateStore) return c.json({ error: "transition state store not configured" }, 501);

    // TODO: 시점 replay — 해당 시점까지의 이벤트만 replay하여 상태 재구성
    // 현재는 현재 상태 반환 (placeholder)
    const { contextId, resourceId } = c.req.param();
    const snapshot = await deps.stateStore.snapshot(contextId, resourceId);
    return c.json({ contextId, resourceId, timestamp: ts, state: snapshot, note: "current state (replay not yet implemented)" });
  });

  // GET /transitions?context_id=&limit= — context별 전이 목록
  app.get("/", async (c) => {
    if (!deps.transitionStore) return c.json({ error: "transition instance store not configured" }, 501);

    const contextId = c.req.query("context_id");
    if (!contextId) return c.json({ error: "context_id query parameter required" }, 400);

    const limit = Number(c.req.query("limit") ?? 50);
    const instances = await deps.transitionStore.findByContext(contextId, limit);
    return c.json({ contextId, instances, count: instances.length });
  });

  return app;
}
