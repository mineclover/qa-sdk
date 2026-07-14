/**
 * Cloudflare Worker 엔트리포인트 — gate-service.
 *
 * D1 바인딩으로 SQLite 대신 D1 사용.
 * 로컬 개발: wrangler dev
 * 배포: wrangler deploy
 */

import { createApp } from './src/app.js';

export interface Env {
  DB: D1Database;
  GATE_FAILURE_MODE?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const app = createApp({
      d1: env.DB,
      gateFailureMode: (env.GATE_FAILURE_MODE as 'fail-open' | 'fail-closed') ?? 'fail-open',
    });
    return app.fetch(request);
  },
};
