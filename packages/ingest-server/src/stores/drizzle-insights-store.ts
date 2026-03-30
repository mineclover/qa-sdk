/**
 * DrizzleInsightsStore — SQLite 기반 InsightsStore 구현.
 *
 * ingest pipeline이 같은 DB에 이미 기록하므로 collect()는 no-op.
 * 읽기 메서드는 drizzle query builder로 집계 쿼리 수행.
 */

import { count, countDistinct, sum, min, max, eq, desc, asc, isNotNull, inArray, notInArray, like, gte, sql } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/node-sqlite";
import { traces, eventRecords, qaSessions } from "../db/schema.js";
import { parseJsonColumn, type AddressContextJson, type EventPayloadJson } from "../db/json-types.js";
import type {
  InsightsStore,
  InsightsCollectBatch,
  InsightsSummary,
  ServiceInsight,
  EventKeyInsight,
  PrefixUsageInsight,
  TimelineBucket,
  FlowInsight,
  SessionInsight,
  CoverageInsight,
  PermissionInsight,
  ServicePrefixInsight,
  CorrelationInsight,
  ErrorInsight,
  PrefixCorrelation,
  IntentLinkSuggestion,
} from "../ports/insights-store.port.js";

type DrizzleDb = ReturnType<typeof drizzle>;

const AUTO_EVENT_KEY_LIST = ["click", "page_view", "form_submit", "scroll", "visibility_change"] as const;
const AUTO_EVENT_KEYS = new Set<string>(AUTO_EVENT_KEY_LIST);

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

export class DrizzleInsightsStore implements InsightsStore {
  constructor(private readonly db: DrizzleDb) {}

  // ── 쓰기: no-op (같은 DB에 이미 기록됨) ──

  async collect(_batch: InsightsCollectBatch): Promise<void> {
    // local 모드 — ingest pipeline이 같은 DB에 직접 기록하므로 추가 작업 없음
  }

  // ── 읽기 ──

  async getSummary(): Promise<InsightsSummary> {
    // traces 테이블: trace 수 + 서비스 수 (1 쿼리)
    const [traceSummary] = this.db
      .select({
        traceCount: count(),
        serviceCount: countDistinct(traces.serviceName),
      })
      .from(traces)
      .all();

    // sessions 테이블 (1 쿼리)
    const [sessionSummary] = this.db.select({ cnt: count() }).from(qaSessions).all();

    // eventRecords 테이블: 전체 수 + auto/actor/error/eventKey 를 1 쿼리로 통합
    const [recordSummary] = this.db
      .select({
        total: count(),
        eventKeys: countDistinct(eventRecords.eventKey),
        autoRecords: sql<number>`SUM(CASE WHEN ${eventRecords.eventKey} IN (${sql.join(AUTO_EVENT_KEY_LIST.map(k => sql`${k}`), sql`, `)}) THEN 1 ELSE 0 END)`,
        actors: sql<number>`COUNT(DISTINCT CASE WHEN ${eventRecords.actorId} IS NOT NULL THEN ${eventRecords.actorId} END)`,
        errorRecords: sql<number>`SUM(CASE WHEN ${eventRecords.eventKey} LIKE 'error.%' THEN 1 ELSE 0 END)`,
      })
      .from(eventRecords)
      .all();

    const records = recordSummary?.total ?? 0;
    const autoRecords = Number(recordSummary?.autoRecords) || 0;

    return {
      traces: traceSummary?.traceCount ?? 0,
      records,
      sessions: sessionSummary?.cnt ?? 0,
      services: traceSummary?.serviceCount ?? 0,
      eventKeys: recordSummary?.eventKeys ?? 0,
      autoRecords,
      manualRecords: records - autoRecords,
      actors: Number(recordSummary?.actors) || 0,
      errorRecords: Number(recordSummary?.errorRecords) || 0,
    };
  }

  async getServiceDistribution(): Promise<readonly ServiceInsight[]> {
    const rows = this.db
      .select({
        serviceName: traces.serviceName,
        traceCount: count(),
        recordSum: sum(traces.recordCount),
        firstSeen: min(traces.firstTimestamp),
        lastSeen: max(traces.lastTimestamp),
      })
      .from(traces)
      .where(isNotNull(traces.serviceName))
      .groupBy(traces.serviceName)
      .orderBy(desc(sum(traces.recordCount)))
      .all();

    return rows.map(r => ({
      service: r.serviceName ?? "",
      traces: r.traceCount,
      records: Number(r.recordSum) || 0,
      firstSeen: r.firstSeen,
      lastSeen: r.lastSeen,
    }));
  }

  async getEventKeyFrequency(opts?: { limit?: number }): Promise<readonly EventKeyInsight[]> {
    const rows = this.db
      .select({
        eventKey: eventRecords.eventKey,
        cnt: count(),
        firstTs: min(eventRecords.timestamp),
        lastTs: max(eventRecords.timestamp),
      })
      .from(eventRecords)
      .groupBy(eventRecords.eventKey)
      .orderBy(desc(count()))
      .limit(opts?.limit ?? 50)
      .all();

    return rows.map(r => ({
      eventKey: r.eventKey,
      count: r.cnt,
      source: AUTO_EVENT_KEYS.has(r.eventKey) ? "auto" as const : "manual" as const,
      category: categorizeEventKey(r.eventKey),
      firstSeen: r.firstTs,
      lastSeen: r.lastTs,
    }));
  }

  async getPrefixUsage(opts?: { limit?: number }): Promise<readonly PrefixUsageInsight[]> {
    const rows = this.db
      .select({ addressContext: eventRecords.addressContext })
      .from(eventRecords)
      .where(isNotNull(eventRecords.addressContext))
      .limit(opts?.limit ?? 500)
      .all();

    const prefixCounts: Record<string, number> = {};
    for (const r of rows) {
      if (!r.addressContext) continue;
      const ac = parseJsonColumn<AddressContextJson>(r.addressContext, {});
      for (const key of Object.keys(ac)) {
        prefixCounts[key] = (prefixCounts[key] ?? 0) + 1;
      }
    }
    return Object.entries(prefixCounts)
      .toSorted((a, b) => b[1] - a[1])
      .map(([prefix, cnt]) => ({ prefix, count: cnt }));
  }

  async getTimeline(opts?: { limit?: number }): Promise<readonly TimelineBucket[]> {
    const hour = sql<string>`SUBSTR(${eventRecords.timestamp}, 1, 13)`.as("hour");
    const rows = this.db
      .select({ hour, cnt: count() })
      .from(eventRecords)
      .groupBy(hour)
      .orderBy(desc(hour))
      .limit(opts?.limit ?? 48)
      .all();

    return rows.map(r => ({ hour: r.hour, count: r.cnt }));
  }

  async getFlows(opts?: { limit?: number }): Promise<readonly FlowInsight[]> {
    const traceRows = this.db
      .select({
        traceId: traces.traceId,
        serviceName: traces.serviceName,
        recordCount: traces.recordCount,
        firstTimestamp: traces.firstTimestamp,
      })
      .from(traces)
      .where(gte(traces.recordCount, 2))
      .orderBy(desc(traces.updatedAt))
      .limit(opts?.limit ?? 30)
      .all();

    if (traceRows.length === 0) return [];

    // 배치 쿼리: 관련 trace의 모든 record를 한번에 가져옴
    const traceIds = traceRows.map(t => t.traceId);
    const allRecords = this.db
      .select({
        traceId: eventRecords.traceId,
        eventKey: eventRecords.eventKey,
        addressContext: eventRecords.addressContext,
        timestamp: eventRecords.timestamp,
      })
      .from(eventRecords)
      .where(inArray(eventRecords.traceId, traceIds))
      .orderBy(asc(eventRecords.timestamp))
      .all();

    // traceId별 그룹핑
    const recordsByTrace = new Map<string, typeof allRecords>();
    for (const r of allRecords) {
      const group = recordsByTrace.get(r.traceId);
      if (group) group.push(r);
      else recordsByTrace.set(r.traceId, [r]);
    }

    return traceRows.map(t => {
      const records = recordsByTrace.get(t.traceId) ?? [];
      const prefixSet = new Set<string>();
      for (const r of records) {
        if (r.addressContext) {
          const ac = parseJsonColumn<AddressContextJson>(r.addressContext, {});
          for (const k of Object.keys(ac)) prefixSet.add(k);
        }
      }
      return {
        traceId: t.traceId,
        service: t.serviceName ?? "",
        recordCount: t.recordCount,
        firstTimestamp: t.firstTimestamp ?? "",
        sequence: records.map(r => r.eventKey),
        prefixes: [...prefixSet],
      };
    });
  }

  async getSessions(opts?: { limit?: number }): Promise<readonly SessionInsight[]> {
    const sessionRows = this.db
      .select({
        sessionId: qaSessions.sessionId,
        startedAt: qaSessions.startedAt,
        closedAt: qaSessions.closedAt,
        scenarioId: qaSessions.scenarioId,
      })
      .from(qaSessions)
      .orderBy(desc(qaSessions.startedAt))
      .limit(opts?.limit ?? 50)
      .all();

    if (sessionRows.length === 0) return [];

    // 배치 쿼리: 관련 session의 모든 trace를 한번에 가져옴
    const sessionIds = sessionRows.map(s => s.sessionId);
    const allTraces = this.db
      .select({
        sessionId: traces.sessionId,
        traceId: traces.traceId,
        recordCount: traces.recordCount,
        serviceName: traces.serviceName,
      })
      .from(traces)
      .where(inArray(traces.sessionId, sessionIds))
      .all();

    // sessionId별 그룹핑
    const tracesBySession = new Map<string, typeof allTraces>();
    for (const t of allTraces) {
      if (!t.sessionId) continue;
      const group = tracesBySession.get(t.sessionId);
      if (group) group.push(t);
      else tracesBySession.set(t.sessionId, [t]);
    }

    return sessionRows.map(s => {
      const sessionTraces = tracesBySession.get(s.sessionId) ?? [];
      return {
        sessionId: s.sessionId,
        startedAt: s.startedAt,
        closedAt: s.closedAt,
        scenarioId: s.scenarioId,
        traces: sessionTraces.length,
        records: sessionTraces.reduce((acc, t) => acc + t.recordCount, 0),
        services: [...new Set(sessionTraces.map(t => t.serviceName).filter(Boolean))] as string[],
      };
    });
  }

  async getCoverage(): Promise<CoverageInsight> {
    const rows = this.db
      .select({ eventKey: eventRecords.eventKey, cnt: count() })
      .from(eventRecords)
      .groupBy(eventRecords.eventKey)
      .orderBy(desc(count()))
      .all();

    const categories: Record<string, { observed: string[]; count: number }> = {};
    for (const cat of ["navigation", "interaction", "form", "session", "network", "execution", "outcome", "quality", "uncategorized"]) {
      categories[cat] = { observed: [], count: 0 };
    }
    for (const r of rows) {
      const cat = categorizeEventKey(r.eventKey);
      if (!categories[cat]) categories[cat] = { observed: [], count: 0 };
      categories[cat].observed.push(r.eventKey);
      categories[cat].count += r.cnt;
    }

    return {
      totalObservedKeys: rows.length,
      totalRecords: rows.reduce((s, r) => s + r.cnt, 0),
      categories: Object.entries(categories)
        .filter(([, v]) => v.observed.length > 0)
        .map(([cat, v]) => ({
          category: cat,
          observedKeys: v.observed,
          observedCount: v.count,
          coverage: v.observed.length,
        })),
    };
  }

  async getPermissionEvents(opts?: { limit?: number }): Promise<PermissionInsight> {
    const PERM_EVENT_KEYS = ["permission.check", "permission.denied", "auth.login", "auth.logout"];
    const rows = this.db
      .select({
        logId: eventRecords.logId,
        traceId: eventRecords.traceId,
        timestamp: eventRecords.timestamp,
        eventKey: eventRecords.eventKey,
        payload: eventRecords.payload,
        addressContext: eventRecords.addressContext,
        actorId: eventRecords.actorId,
        userId: eventRecords.userId,
        qaSessionId: eventRecords.qaSessionId,
      })
      .from(eventRecords)
      .where(inArray(eventRecords.eventKey, PERM_EVENT_KEYS))
      .orderBy(desc(eventRecords.timestamp))
      .limit(opts?.limit ?? 50)
      .all();

    const items = rows.map(r => ({
      logId: r.logId,
      traceId: r.traceId,
      timestamp: r.timestamp,
      eventKey: r.eventKey,
      actorId: r.actorId,
      userId: r.userId,
      sessionId: r.qaSessionId,
      payload: parseJsonColumn<Record<string, unknown> | undefined>(r.payload, undefined),
      addressContext: parseJsonColumn<Record<string, string> | undefined>(r.addressContext, undefined),
    }));

    const summary: Record<string, number> = {};
    for (const item of items) {
      summary[item.eventKey] = (summary[item.eventKey] ?? 0) + 1;
    }
    return { items, summary, total: items.length };
  }

  async getServicePrefixes(): Promise<readonly ServicePrefixInsight[]> {
    const rows = this.db
      .select({
        addressContext: eventRecords.addressContext,
        serviceName: traces.serviceName,
      })
      .from(eventRecords)
      .innerJoin(traces, eq(eventRecords.traceId, traces.traceId))
      .where(isNotNull(eventRecords.addressContext))
      .limit(1000)
      .all();

    const servicePrefixMap: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      const svc = r.serviceName ?? "unknown";
      if (!servicePrefixMap[svc]) servicePrefixMap[svc] = {};
      const ac = parseJsonColumn<AddressContextJson>(r.addressContext, {});
      for (const prefix of Object.keys(ac)) {
        servicePrefixMap[svc][prefix] = (servicePrefixMap[svc][prefix] ?? 0) + 1;
      }
    }

    const services = Object.entries(servicePrefixMap).map(([svc, prefixes]) => ({
      service: svc,
      activePrefixes: Object.keys(prefixes),
      prefixCounts: prefixes,
      totalEvents: Object.values(prefixes).reduce((s, v) => s + v, 0),
    }));
    services.sort((a, b) => b.totalEvents - a.totalEvents);
    return services;
  }

  async getCorrelations(opts?: { minSupport?: number }): Promise<CorrelationInsight> {
    const minSupport = opts?.minSupport ?? 2;
    const EXCLUDED_KEYS = ["synthetic.coverage", "system.change", "error.service", "health.check"];

    const rows = this.db
      .select({
        addressContext: eventRecords.addressContext,
        traceId: eventRecords.traceId,
        qaSessionId: eventRecords.qaSessionId,
      })
      .from(eventRecords)
      .where(
        sql`${eventRecords.addressContext} IS NOT NULL AND ${eventRecords.eventKey} NOT IN (${sql.join(EXCLUDED_KEYS.map(k => sql`${k}`), sql`, `)})`,
      )
      .limit(2000)
      .all();

    // 세션별 prefix set + session/trace 구분 (qaSessionId 존재 여부 기반)
    const sessionPrefixes: Map<string, Set<string>> = new Map();
    const isSessionGroup = new Set<string>();
    for (const r of rows) {
      const ac = parseJsonColumn<AddressContextJson>(r.addressContext, {});
      const prefixes = Object.keys(ac);
      if (prefixes.length === 0) continue;
      const groupKey = r.qaSessionId ?? r.traceId;
      if (r.qaSessionId) isSessionGroup.add(groupKey);
      if (!sessionPrefixes.has(groupKey)) sessionPrefixes.set(groupKey, new Set());
      const set = sessionPrefixes.get(groupKey)!;
      for (const p of prefixes) set.add(p);
    }

    const sessionCount = isSessionGroup.size;
    const traceCount = sessionPrefixes.size - sessionCount;

    // 쌍 공출현
    const pairCounts: Record<string, number> = {};
    const prefixCounts: Record<string, number> = {};
    for (const [, prefixes] of sessionPrefixes) {
      const arr = [...prefixes].toSorted();
      for (const p of arr) prefixCounts[p] = (prefixCounts[p] ?? 0) + 1;
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const key = `${arr[i]}|${arr[j]}`;
          pairCounts[key] = (pairCounts[key] ?? 0) + 1;
        }
      }
    }

    // Jaccard
    const correlations: PrefixCorrelation[] = [];
    for (const [key, cnt] of Object.entries(pairCounts)) {
      if (cnt < minSupport) continue;
      const [a, b] = key.split("|");
      const countA = prefixCounts[a] ?? 0;
      const countB = prefixCounts[b] ?? 0;
      const union = countA + countB - cnt;
      const jaccard = union > 0 ? Math.round((cnt / union) * 100) / 100 : 0;
      correlations.push({ prefixA: a, prefixB: b, cooccurrence: cnt, jaccard, support: cnt });
    }
    correlations.sort((a, b) => b.jaccard - a.jaccard || b.cooccurrence - a.cooccurrence);

    // IntentLink 클러스터링 (Jaccard ≥ 0.5)
    const graph: Record<string, Set<string>> = {};
    for (const corr of correlations) {
      if (corr.jaccard < 0.5) continue;
      if (!graph[corr.prefixA]) graph[corr.prefixA] = new Set();
      if (!graph[corr.prefixB]) graph[corr.prefixB] = new Set();
      graph[corr.prefixA].add(corr.prefixB);
      graph[corr.prefixB].add(corr.prefixA);
    }

    const visited = new Set<string>();
    const suggestions: IntentLinkSuggestion[] = [];
    let clusterId = 0;
    for (const node of Object.keys(graph)) {
      if (visited.has(node)) continue;
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
        let totalJaccard = 0;
        let pairCount = 0;
        for (let i = 0; i < cluster.length; i++) {
          for (let j = i + 1; j < cluster.length; j++) {
            const key = `${[cluster[i], cluster[j]].toSorted().join("|")}`;
            const pair = correlations.find(c => `${c.prefixA}|${c.prefixB}` === key);
            if (pair) { totalJaccard += pair.jaccard; pairCount++; }
          }
        }
        suggestions.push({
          id: `IL-AUTO-${++clusterId}`,
          endpoints: cluster.toSorted(),
          avgJaccard: pairCount > 0 ? Math.round((totalJaccard / pairCount) * 100) / 100 : 0,
          evidence: sessionPrefixes.size,
        });
      }
    }

    // solo rate
    const soloRates: Record<string, number> = {};
    for (const [, prefixes] of sessionPrefixes) {
      if (prefixes.size === 1) {
        const p = [...prefixes][0];
        soloRates[p] = (soloRates[p] ?? 0) + 1;
      }
    }

    return {
      totalGroups: sessionPrefixes.size,
      sessionGroups: sessionCount,
      traceGroups: traceCount,
      totalPairs: correlations.length,
      correlations: correlations.slice(0, 50),
      suggestions,
      prefixFrequency: Object.entries(prefixCounts)
        .map(([prefix, cnt]) => ({ prefix, count: cnt, soloRate: soloRates[prefix] ?? 0 }))
        .toSorted((a, b) => b.count - a.count),
    };
  }

  async getErrors(opts?: { limit?: number }): Promise<ErrorInsight> {
    const rows = this.db
      .select({
        logId: eventRecords.logId,
        traceId: eventRecords.traceId,
        timestamp: eventRecords.timestamp,
        eventKey: eventRecords.eventKey,
        payload: eventRecords.payload,
        actorId: eventRecords.actorId,
        qaSessionId: eventRecords.qaSessionId,
      })
      .from(eventRecords)
      .where(like(eventRecords.eventKey, "error.%"))
      .orderBy(desc(eventRecords.timestamp))
      .limit(opts?.limit ?? 50)
      .all();

    const items = rows.map(r => {
      const payload = parseJsonColumn<EventPayloadJson | undefined>(r.payload, undefined);
      return {
        logId: r.logId,
        traceId: r.traceId,
        timestamp: r.timestamp,
        eventKey: r.eventKey,
        service: (payload?.service as string) ?? "unknown",
        code: (payload?.code as string) ?? "UNKNOWN",
        message: (payload?.message as string) ?? "",
        path: payload?.path as string | undefined,
        statusCode: payload?.statusCode as number | undefined,
      };
    });

    const byService: Record<string, number> = {};
    const byCode: Record<string, number> = {};
    for (const item of items) {
      byService[item.service] = (byService[item.service] ?? 0) + 1;
      byCode[item.code] = (byCode[item.code] ?? 0) + 1;
    }
    return { items, total: items.length, byService, byCode };
  }
}
