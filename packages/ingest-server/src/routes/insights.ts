/**
 * /v1/insights — D1 집계 기반 인사이트 API.
 *
 * traces + event_records 테이블에서 SQL 집계로 인사이트 제공.
 * D1RecordStore의 driver를 직접 사용하여 집계 쿼리 실행.
 */

import { Hono } from "hono";
import type { SqlDriver } from "index-meta";

export interface InsightsDeps {
  driver?: SqlDriver;
}

interface CountRow { key: string; count: number }
interface TimeRow { hour: string; count: number }

export function createInsightsRoutes(deps: InsightsDeps) {
  const app = new Hono();

  if (!deps.driver) return app;
  const db = deps.driver;

  // GET /v1/insights/summary — 전체 요약
  app.get("/v1/insights/summary", async (c) => {
    const [traceCount, recordCount, sessionCount, serviceCount, eventKeyCount, autoCount, manualCount, actorCount] = await Promise.all([
      db.queryOne<{ cnt: number }>("SELECT COUNT(*) as cnt FROM traces"),
      db.queryOne<{ cnt: number }>("SELECT COUNT(*) as cnt FROM event_records"),
      db.queryOne<{ cnt: number }>("SELECT COUNT(*) as cnt FROM qa_sessions"),
      db.queryOne<{ cnt: number }>("SELECT COUNT(DISTINCT service_name) as cnt FROM traces WHERE service_name IS NOT NULL"),
      db.queryOne<{ cnt: number }>("SELECT COUNT(DISTINCT event_key) as cnt FROM event_records"),
      db.queryOne<{ cnt: number }>("SELECT COUNT(*) as cnt FROM event_records WHERE event_key IN ('click','page_view','form_submit','scroll','visibility_change')"),
      db.queryOne<{ cnt: number }>("SELECT COUNT(*) as cnt FROM event_records WHERE event_key NOT IN ('click','page_view','form_submit','scroll','visibility_change')"),
      db.queryOne<{ cnt: number }>("SELECT COUNT(DISTINCT actor_id) as cnt FROM event_records WHERE actor_id IS NOT NULL"),
    ]);

    return c.json({
      traces: traceCount?.cnt ?? 0,
      records: recordCount?.cnt ?? 0,
      sessions: sessionCount?.cnt ?? 0,
      services: serviceCount?.cnt ?? 0,
      eventKeys: eventKeyCount?.cnt ?? 0,
      autoRecords: autoCount?.cnt ?? 0,
      manualRecords: manualCount?.cnt ?? 0,
      actors: actorCount?.cnt ?? 0,
    });
  });

  // GET /v1/insights/services — 서비스별 trace/record 분포
  app.get("/v1/insights/services", async (c) => {
    const rows = await db.query<{ service_name: string; trace_count: number; record_sum: number; first_seen: string; last_seen: string }>(
      `SELECT service_name,
              COUNT(*) as trace_count,
              SUM(record_count) as record_sum,
              MIN(first_timestamp) as first_seen,
              MAX(last_timestamp) as last_seen
       FROM traces
       WHERE service_name IS NOT NULL
       GROUP BY service_name
       ORDER BY record_sum DESC`,
    );
    return c.json(rows.map(r => ({
      service: r.service_name,
      traces: r.trace_count,
      records: r.record_sum,
      firstSeen: r.first_seen,
      lastSeen: r.last_seen,
    })));
  });

  const AUTO_EVENT_KEYS = new Set(["click", "page_view", "form_submit", "scroll", "visibility_change"]);

  /**
   * 도메인 event_key를 범용 카테고리로 매핑.
   * event-catalog의 8개 카테고리와 연결.
   */
  const EVENT_CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
    { pattern: /^page\.|^screen\.|^route\./, category: "navigation" },
    { pattern: /^click|^tap|^scroll|^drag|^select/, category: "interaction" },
    { pattern: /^form\.|^input\./, category: "form" },
    { pattern: /^auth\.|^session\.|^login|^logout/, category: "session" },
    { pattern: /^api\.|^http\.|^rpc\.|^endpoint\./, category: "network" },
    { pattern: /^cart\.|^checkout\.|^order\.|^payment\.|^purchase/, category: "outcome" },
    { pattern: /^permission\.|^rbac\.|^guard\./, category: "quality" },
    { pattern: /^deploy\.|^build\.|^test\.|^pipeline\./, category: "execution" },
    { pattern: /^error\.|^warn\.|^metric\./, category: "quality" },
  ];

  function categorizeEventKey(key: string): string {
    for (const { pattern, category } of EVENT_CATEGORY_PATTERNS) {
      if (pattern.test(key)) return category;
    }
    return "uncategorized";
  }

  // GET /v1/insights/event-keys — 이벤트 키별 빈도
  app.get("/v1/insights/event-keys", async (c) => {
    const rows = await db.query<{ event_key: string; cnt: number; first_ts: string; last_ts: string }>(
      `SELECT event_key,
              COUNT(*) as cnt,
              MIN(timestamp) as first_ts,
              MAX(timestamp) as last_ts
       FROM event_records
       GROUP BY event_key
       ORDER BY cnt DESC
       LIMIT 50`,
    );
    return c.json(rows.map(r => ({
      eventKey: r.event_key,
      count: r.cnt,
      source: AUTO_EVENT_KEYS.has(r.event_key) ? "auto" : "manual",
      category: categorizeEventKey(r.event_key),
      firstSeen: r.first_ts,
      lastSeen: r.last_ts,
    })));
  });

  // GET /v1/insights/prefixes — address_context prefix 사용 빈도
  app.get("/v1/insights/prefixes", async (c) => {
    const rows = await db.query<{ address_context: string }>(
      "SELECT address_context FROM event_records WHERE address_context IS NOT NULL LIMIT 500",
    );
    const prefixCounts: Record<string, number> = {};
    for (const r of rows) {
      try {
        const ac = JSON.parse(r.address_context);
        for (const key of Object.keys(ac)) {
          prefixCounts[key] = (prefixCounts[key] ?? 0) + 1;
        }
      } catch { /* skip */ }
    }
    const sorted = Object.entries(prefixCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([prefix, count]) => ({ prefix, count }));
    return c.json(sorted);
  });

  // GET /v1/insights/timeline — 시간대별 이벤트 분포
  app.get("/v1/insights/timeline", async (c) => {
    const rows = await db.query<{ hour: string; cnt: number }>(
      `SELECT SUBSTR(timestamp, 1, 13) as hour,
              COUNT(*) as cnt
       FROM event_records
       GROUP BY hour
       ORDER BY hour DESC
       LIMIT 48`,
    );
    return c.json(rows.map(r => ({ hour: r.hour, count: r.cnt })));
  });

  // GET /v1/insights/flows — 이벤트 시퀀스 패턴 (trace별 event_key 체인)
  app.get("/v1/insights/flows", async (c) => {
    const limit = parseInt(c.req.query("limit") ?? "30");
    const rows = await db.query<{ trace_id: string; service_name: string; record_count: number; first_timestamp: string }>(
      `SELECT trace_id, service_name, record_count, first_timestamp
       FROM traces
       WHERE record_count >= 2
       ORDER BY updated_at DESC
       LIMIT ${limit}`,
    );

    const flows: Array<{
      traceId: string;
      service: string;
      recordCount: number;
      firstTimestamp: string;
      sequence: string[];
      prefixes: string[];
    }> = [];

    for (const t of rows) {
      const records = await db.query<{ event_key: string; address_context: string | null }>(
        "SELECT event_key, address_context FROM event_records WHERE trace_id = ? ORDER BY timestamp",
        [t.trace_id],
      );
      const seq = records.map(r => r.event_key);
      const prefixSet = new Set<string>();
      for (const r of records) {
        if (r.address_context) {
          try {
            for (const k of Object.keys(JSON.parse(r.address_context))) prefixSet.add(k);
          } catch { /* skip */ }
        }
      }
      flows.push({
        traceId: t.trace_id,
        service: t.service_name,
        recordCount: t.record_count,
        firstTimestamp: t.first_timestamp,
        sequence: seq,
        prefixes: [...prefixSet],
      });
    }

    return c.json(flows);
  });

  // GET /v1/insights/sessions — 세션별 요약
  app.get("/v1/insights/sessions", async (c) => {
    const rows = await db.query<{ session_id: string; started_at: string; closed_at: string | null; scenario_id: string | null }>(
      "SELECT session_id, started_at, closed_at, scenario_id FROM qa_sessions ORDER BY started_at DESC LIMIT 50",
    );

    const sessions = [];
    for (const s of rows) {
      const traceRows = await db.query<{ trace_id: string; record_count: number; service_name: string }>(
        "SELECT trace_id, record_count, service_name FROM traces WHERE session_id = ?",
        [s.session_id],
      );
      sessions.push({
        sessionId: s.session_id,
        startedAt: s.started_at,
        closedAt: s.closed_at,
        scenarioId: s.scenario_id,
        traces: traceRows.length,
        records: traceRows.reduce((sum, t) => sum + t.record_count, 0),
        services: [...new Set(traceRows.map(t => t.service_name).filter(Boolean))],
      });
    }

    return c.json(sessions);
  });

  // GET /v1/insights/coverage — 이벤트 카테고리별 커버리지
  app.get("/v1/insights/coverage", async (c) => {
    const rows = await db.query<{ event_key: string; cnt: number }>(
      "SELECT event_key, COUNT(*) as cnt FROM event_records GROUP BY event_key ORDER BY cnt DESC",
    );

    const categories: Record<string, { defined: string[]; observed: string[]; count: number }> = {};
    for (const cat of ["navigation", "interaction", "form", "session", "network", "execution", "outcome", "quality", "uncategorized"]) {
      categories[cat] = { defined: [], observed: [], count: 0 };
    }

    for (const r of rows) {
      const cat = categorizeEventKey(r.event_key);
      if (!categories[cat]) categories[cat] = { defined: [], observed: [], count: 0 };
      categories[cat].observed.push(r.event_key);
      categories[cat].count += r.cnt;
    }

    const totalObserved = rows.length;
    const totalRecords = rows.reduce((s, r) => s + r.cnt, 0);

    return c.json({
      totalObservedKeys: totalObserved,
      totalRecords,
      categories: Object.entries(categories)
        .filter(([, v]) => v.observed.length > 0 || v.defined.length > 0)
        .map(([cat, v]) => ({
          category: cat,
          observedKeys: v.observed,
          observedCount: v.count,
          coverage: v.observed.length,
        })),
    });
  });

  // GET /v1/insights/permissions — 권한 체크 히스토리
  app.get("/v1/insights/permissions", async (c) => {
    const limit = parseInt(c.req.query("limit") ?? "50");
    const rows = await db.query<{
      log_id: string; trace_id: string; timestamp: string;
      event_key: string; payload: string | null; address_context: string | null;
      actor_id: string | null; user_id: string | null; qa_session_id: string | null;
    }>(
      `SELECT log_id, trace_id, timestamp, event_key, payload, address_context, actor_id, user_id, qa_session_id
       FROM event_records
       WHERE event_key IN ('permission.check', 'permission.denied', 'auth.login', 'auth.logout')
       ORDER BY timestamp DESC
       LIMIT ${limit}`,
    );

    const items = rows.map(r => {
      let payload: Record<string, unknown> | undefined;
      let addressContext: Record<string, string> | undefined;
      try { if (r.payload) payload = JSON.parse(r.payload); } catch {}
      try { if (r.address_context) addressContext = JSON.parse(r.address_context); } catch {}
      return {
        logId: r.log_id,
        traceId: r.trace_id,
        timestamp: r.timestamp,
        eventKey: r.event_key,
        actorId: r.actor_id,
        userId: r.user_id,
        sessionId: r.qa_session_id,
        payload,
        addressContext,
      };
    });

    // 집계: 이벤트별 카운트
    const summary: Record<string, number> = {};
    for (const item of items) {
      summary[item.eventKey] = (summary[item.eventKey] ?? 0) + 1;
    }

    return c.json({ items, summary, total: items.length });
  });

  return app;
}
