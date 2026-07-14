/**
 * Cloudflare Worker 엔트리포인트 — query-service.
 *
 * D1 바인딩으로 SQLite 대신 D1 사용.
 */

import { createApp } from './src/app.js';
import type { ConflictStrategy } from 'index-meta';

export interface Env {
  DB: D1Database;
  GATE_SERVICE_URL?: string;
  QUERY_DEFAULT_STRATEGY?: string;
  QUERY_GATE_FAILURE_MODE?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const app = createApp({
      defaultStrategy: env.QUERY_DEFAULT_STRATEGY as ConflictStrategy | undefined,
      gateFailureMode: (env.QUERY_GATE_FAILURE_MODE as 'fail-open' | 'fail-closed') ?? 'fail-open',
    });
    return app.fetch(request);
  },
};
