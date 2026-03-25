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

    const errorCount = await db.queryOne<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM event_records WHERE event_key LIKE 'error.%'",
    );

    return c.json({
      traces: traceCount?.cnt ?? 0,
      records: recordCount?.cnt ?? 0,
      sessions: sessionCount?.cnt ?? 0,
      services: serviceCount?.cnt ?? 0,
      eventKeys: eventKeyCount?.cnt ?? 0,
      autoRecords: autoCount?.cnt ?? 0,
      manualRecords: manualCount?.cnt ?? 0,
      actors: actorCount?.cnt ?? 0,
      errorRecords: errorCount?.cnt ?? 0,
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

  // GET /v1/insights/service-prefixes — 서비스별 prefix 활성도
  // registry의 ownedPrefixes + 실제 수집된 address_context를 매칭
  app.get("/v1/insights/service-prefixes", async (c) => {
    // 1. 실제 수집된 prefix별 카운트
    const rows = await db.query<{ address_context: string; service_name: string }>(
      `SELECT e.address_context, t.service_name
       FROM event_records e
       JOIN traces t ON e.trace_id = t.trace_id
       WHERE e.address_context IS NOT NULL
       LIMIT 1000`,
    );

    // 서비스별 prefix 사용 집계
    const servicePrefixMap: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      const svc = r.service_name ?? "unknown";
      if (!servicePrefixMap[svc]) servicePrefixMap[svc] = {};
      try {
        const ac = JSON.parse(r.address_context);
        for (const prefix of Object.keys(ac)) {
          servicePrefixMap[svc][prefix] = (servicePrefixMap[svc][prefix] ?? 0) + 1;
        }
      } catch { /* skip */ }
    }

    // 서비스별 요약
    const services = Object.entries(servicePrefixMap).map(([svc, prefixes]) => ({
      service: svc,
      activePrefixes: Object.keys(prefixes),
      prefixCounts: prefixes,
      totalEvents: Object.values(prefixes).reduce((s, c) => s + c, 0),
    }));

    services.sort((a, b) => b.totalEvents - a.totalEvents);

    return c.json(services);
  });

  // GET /v1/insights/correlations — prefix 공출현 분석 + IntentLink 자동 제안
  // 세션 단위: 같은 qa_session_id 안에서 어떤 prefix가 함께 관측되는지 분석
  // 세션 없는 records는 trace_id로 fallback
  app.get("/v1/insights/correlations", async (c) => {
    const minSupport = parseInt(c.req.query("min_support") ?? "2");

    // 1. address_context가 있는 records (synthetic/system 이벤트 제외)
    const rows = await db.query<{ address_context: string; trace_id: string; qa_session_id: string | null }>(
      `SELECT address_context, trace_id, qa_session_id FROM event_records
       WHERE address_context IS NOT NULL
         AND event_key NOT IN ('synthetic.coverage', 'system.change', 'error.service', 'health.check')
       LIMIT 2000`,
    );

    // 2. 세션별 prefix set 구성 (세션 없으면 trace_id fallback)
    const sessionPrefixes: Map<string, Set<string>> = new Map();
    for (const r of rows) {
      try {
        const ac = JSON.parse(r.address_context);
        const prefixes = Object.keys(ac);
        if (prefixes.length === 0) continue;

        const groupKey = r.qa_session_id ?? r.trace_id;
        if (!sessionPrefixes.has(groupKey)) sessionPrefixes.set(groupKey, new Set());
        const set = sessionPrefixes.get(groupKey)!;
        for (const p of prefixes) set.add(p);
      } catch { /* skip */ }
    }
    const sessionCount = [...sessionPrefixes.keys()].filter(k => !k.startsWith("trace-") && !k.startsWith("sim-")).length;
    const traceCount = sessionPrefixes.size - sessionCount;

    // 3. prefix 쌍 공출현 카운트
    const pairCounts: Record<string, number> = {};
    const prefixCounts: Record<string, number> = {};
    for (const [, prefixes] of sessionPrefixes) {
      const arr = [...prefixes].sort();
      for (const p of arr) {
        prefixCounts[p] = (prefixCounts[p] ?? 0) + 1;
      }
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const key = `${arr[i]}|${arr[j]}`;
          pairCounts[key] = (pairCounts[key] ?? 0) + 1;
        }
      }
    }

    // 4. 상관 점수 계산 (Jaccard similarity)
    const correlations: Array<{
      prefixA: string; prefixB: string; cooccurrence: number;
      jaccard: number; support: number;
    }> = [];

    for (const [key, count] of Object.entries(pairCounts)) {
      if (count < minSupport) continue;
      const [a, b] = key.split("|");
      const countA = prefixCounts[a] ?? 0;
      const countB = prefixCounts[b] ?? 0;
      const union = countA + countB - count;
      const jaccard = union > 0 ? Math.round((count / union) * 100) / 100 : 0;
      correlations.push({ prefixA: a, prefixB: b, cooccurrence: count, jaccard, support: count });
    }

    correlations.sort((a, b) => b.jaccard - a.jaccard || b.cooccurrence - a.cooccurrence);

    // 5. IntentLink 자동 제안: 높은 상관의 prefix 클러스터
    const suggestions: Array<{
      id: string; endpoints: string[]; avgJaccard: number; evidence: number;
    }> = [];

    // 클러스터링: Jaccard >= 0.5인 쌍에서 connected component 추출
    const graph: Record<string, Set<string>> = {};
    for (const c of correlations) {
      if (c.jaccard < 0.5) continue;
      if (!graph[c.prefixA]) graph[c.prefixA] = new Set();
      if (!graph[c.prefixB]) graph[c.prefixB] = new Set();
      graph[c.prefixA].add(c.prefixB);
      graph[c.prefixB].add(c.prefixA);
    }

    const visited = new Set<string>();
    let clusterId = 0;
    for (const node of Object.keys(graph)) {
      if (visited.has(node)) continue;
      // BFS
      const cluster: string[] = [];
      const queue = [node];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (visited.has(curr)) continue;
        visited.add(curr);
        cluster.push(curr);
        for (const neighbor of graph[curr] ?? []) {
          if (!visited.has(neighbor)) queue.push(neighbor);
        }
      }
      if (cluster.length >= 3) {
        // 클러스터 내 평균 jaccard
        let totalJaccard = 0;
        let pairCount = 0;
        for (let i = 0; i < cluster.length; i++) {
          for (let j = i + 1; j < cluster.length; j++) {
            const key = `${[cluster[i], cluster[j]].sort().join("|")}`;
            const pair = correlations.find(c => `${c.prefixA}|${c.prefixB}` === key);
            if (pair) { totalJaccard += pair.jaccard; pairCount++; }
          }
        }
        suggestions.push({
          id: `IL-AUTO-${++clusterId}`,
          endpoints: cluster.sort(),
          avgJaccard: pairCount > 0 ? Math.round((totalJaccard / pairCount) * 100) / 100 : 0,
          evidence: sessionPrefixes.size,
        });
      }
    }

    // 6. prefix별 단독 출현 비율 (다른 prefix 없이 혼자 나타나는 빈도)
    const soloRates: Record<string, number> = {};
    for (const [, prefixes] of sessionPrefixes) {
      if (prefixes.size === 1) {
        const p = [...prefixes][0];
        soloRates[p] = (soloRates[p] ?? 0) + 1;
      }
    }

    return c.json({
      totalGroups: sessionPrefixes.size,
      sessionGroups: sessionCount,
      traceGroups: traceCount,
      totalPairs: correlations.length,
      correlations: correlations.slice(0, 50),
      suggestions,
      prefixFrequency: Object.entries(prefixCounts)
        .map(([prefix, count]) => ({ prefix, count, soloRate: soloRates[prefix] ?? 0 }))
        .sort((a, b) => b.count - a.count),
    });
  });

  // GET /v1/insights/errors — 에러 이벤트 히스토리
  app.get("/v1/insights/errors", async (c) => {
    const limit = parseInt(c.req.query("limit") ?? "50");
    const rows = await db.query<{
      log_id: string; trace_id: string; timestamp: string;
      event_key: string; payload: string | null;
      actor_id: string | null; qa_session_id: string | null;
    }>(
      `SELECT log_id, trace_id, timestamp, event_key, payload, actor_id, qa_session_id
       FROM event_records
       WHERE event_key LIKE 'error.%'
       ORDER BY timestamp DESC
       LIMIT ${limit}`,
    );

    const items = rows.map(r => {
      let payload: Record<string, unknown> | undefined;
      try { if (r.payload) payload = JSON.parse(r.payload); } catch {}
      return {
        logId: r.log_id,
        traceId: r.trace_id,
        timestamp: r.timestamp,
        eventKey: r.event_key,
        service: payload?.service ?? "unknown",
        code: payload?.code ?? "UNKNOWN",
        message: payload?.message ?? "",
        path: payload?.path,
        statusCode: payload?.statusCode,
      };
    });

    // 서비스별 집계
    const byService: Record<string, number> = {};
    const byCode: Record<string, number> = {};
    for (const item of items) {
      byService[item.service as string] = (byService[item.service as string] ?? 0) + 1;
      byCode[item.code as string] = (byCode[item.code as string] ?? 0) + 1;
    }

    return c.json({ items, total: items.length, byService, byCode });
  });

  return app;
}
