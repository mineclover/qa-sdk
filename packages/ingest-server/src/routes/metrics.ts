// @def.boundary ingest-system
// @def.doc ingest-system

import { Hono } from 'hono';
import type { DlqStore } from '@qa-sdk/core';
import type { StreamConnectionRegistry } from '../lib/stream-connection-registry.js';
import { type MetricsCollector, formatCounters, formatGauge } from '../lib/metrics-collector.js';

export interface MetricsRouteDeps {
  metricsCollector?: MetricsCollector;
  dlqStore: DlqStore;
  streamConnectionRegistry?: StreamConnectionRegistry;
  getUptimeSeconds?: () => number;
}

const COUNTER_HELP: Record<string, string> = {
  ingest_requests_total: 'Total ingest HTTP requests by status',
  ingest_records_total: 'Total event records ingested',
  rate_limit_rejected_total: 'Total requests rejected by rate limiter',
  convergence_flush_total: 'Total convergence pipeline flushes',
  convergence_sessions_classified_total: 'Total sessions classified by pattern',
  convergence_anomalies_detected_total: 'Total anomalies detected by kind',
};

export function createMetricsRoutes(deps: MetricsRouteDeps) {
  const routes = new Hono();
  const getUptimeSeconds = deps.getUptimeSeconds ?? (() => process.uptime());

  routes.get('/v1/metrics', async (c) => {
    const lines: string[] = [];

    // ── process metrics ──
    lines.push(
      ...formatGauge(
        'process_uptime_seconds',
        Math.round(getUptimeSeconds()),
        'Process uptime in seconds',
      ),
    );

    const mem = process.memoryUsage();
    lines.push(...formatGauge('process_heap_used_bytes', mem.heapUsed, 'Process heap used bytes'));
    lines.push(
      ...formatGauge('process_heap_total_bytes', mem.heapTotal, 'Process heap total bytes'),
    );
    lines.push(...formatGauge('process_rss_bytes', mem.rss, 'Process resident set size bytes'));

    // ── DLQ depth ──
    try {
      const pending = await deps.dlqStore.findPending(0);
      lines.push(...formatGauge('dlq_depth', pending.length, 'Current DLQ pending depth'));
    } catch {
      lines.push(...formatGauge('dlq_depth', -1, 'Current DLQ pending depth'));
    }

    // ── SSE connections ──
    if (deps.streamConnectionRegistry) {
      lines.push(
        ...formatGauge(
          'sse_connections_active',
          deps.streamConnectionRegistry.getConnectionCount(),
          'Active SSE stream connections',
        ),
      );
    }

    // ── counter metrics (from MetricsCollector) ──
    if (deps.metricsCollector) {
      lines.push(...formatCounters(deps.metricsCollector.getCounters(), COUNTER_HELP));
    }

    return c.text(lines.join('\n') + '\n', 200, {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
    });
  });

  return routes;
}
