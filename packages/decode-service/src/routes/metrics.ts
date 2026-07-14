// @def.boundary decode-service-system
// @def.doc decode-service-system

import { Hono } from 'hono';
import type { DecoderPool } from '../lib/decoder-pool.js';

export interface MetricsRouteDeps {
  pool: DecoderPool;
  getUptimeSeconds?: () => number;
  getMemoryUsage?: () => { heapUsed: number; rss: number };
}

function gauge(
  name: string,
  value: number,
  help?: string,
  labels: Record<string, string> = {},
): string[] {
  const lines: string[] = [];
  if (help) lines.push(`# HELP ${name} ${help}`);
  lines.push(`# TYPE ${name} gauge`);
  const labelStr =
    Object.keys(labels).length > 0
      ? `{${Object.entries(labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',')}}`
      : '';
  lines.push(`${name}${labelStr} ${value}`);
  return lines;
}

export function createMetricsRoutes(deps: MetricsRouteDeps) {
  const routes = new Hono();
  const getUptimeSeconds = deps.getUptimeSeconds ?? getRuntimeUptimeSeconds;
  const getMemoryUsage = deps.getMemoryUsage ?? getRuntimeMemoryUsage;

  routes.get('/metrics', (c) => {
    const lines: string[] = [];

    // ── process metrics ──
    lines.push(
      ...gauge(
        'process_uptime_seconds',
        Math.round(getUptimeSeconds()),
        'Process uptime in seconds',
      ),
    );

    const mem = getMemoryUsage();
    lines.push(...gauge('process_heap_used_bytes', mem.heapUsed, 'Process heap used bytes'));
    lines.push(...gauge('process_rss_bytes', mem.rss, 'Process resident set size bytes'));

    // ── decoder pool ──
    lines.push(...gauge('decode_pool_size', deps.pool.size, 'Number of cached decoders in pool'));

    return c.text(lines.join('\n') + '\n', 200, {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
    });
  });

  return routes;
}

function getRuntimeUptimeSeconds(): number {
  return typeof process !== 'undefined' && typeof process.uptime === 'function'
    ? process.uptime()
    : 0;
}

function getRuntimeMemoryUsage(): { heapUsed: number; rss: number } {
  return typeof process !== 'undefined' && typeof process.memoryUsage === 'function'
    ? process.memoryUsage()
    : { heapUsed: 0, rss: 0 };
}
