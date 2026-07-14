#!/usr/bin/env pnpm exec tsx
/**
 * OIDC 브라우저 테스트 환경 시작
 *
 * 1. Zitadel에 SPA 앱 등록
 * 2. 정적 HTML 서버 시작 (localhost:5500)
 * 3. 브라우저에서 http://localhost:5500 접속
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 5500;

async function setupZitadelApp(): Promise<string> {
  try {
    const token = (await readFile('/tmp/zitadel-token.txt', 'utf-8')).trim();

    // 프로젝트 동적 조회 (DB 초기화 후 ID 변경됨)
    const projSearch = await fetch('http://localhost:8085/management/v1/projects/_search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(5000),
    });
    const projects = (await projSearch.json()) as { result?: Array<{ id: string; name: string }> };
    let projId = projects.result?.find((p) => p.name === 'qa-platform')?.id;

    // 프로젝트 없으면 생성
    if (!projId) {
      const projResp = await fetch('http://localhost:8085/management/v1/projects', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'qa-platform' }),
        signal: AbortSignal.timeout(5000),
      });
      const proj = (await projResp.json()) as { id: string };
      projId = proj.id;
      console.log(`[zitadel] 프로젝트 생성: ${projId}`);
    }

    if (!projId) throw new Error('프로젝트 ID를 가져올 수 없습니다');

    // 기존 앱 검색
    const searchResp = await fetch(
      `http://localhost:8085/management/v1/projects/${projId}/apps/_search`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
        signal: AbortSignal.timeout(5000),
      },
    );
    const apps = (await searchResp.json()) as {
      result?: Array<{
        name: string;
        oidcConfig?: { clientId: string };
      }>;
    };
    const existing = apps.result?.find((a) => a.name === 'qa-browser');
    if (existing?.oidcConfig?.clientId) {
      console.log(`[zitadel] 기존 SPA 앱 사용: ${existing.oidcConfig.clientId}`);
      return existing.oidcConfig.clientId;
    }

    // 새 SPA 앱 생성
    const resp = await fetch(`http://localhost:8085/management/v1/projects/${projId}/apps/oidc`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'qa-browser',
        redirectUris: [`http://localhost:${PORT}/callback`, `http://localhost:${PORT}`],
        postLogoutRedirectUris: [`http://localhost:${PORT}`],
        responseTypes: ['OIDC_RESPONSE_TYPE_CODE'],
        grantTypes: ['OIDC_GRANT_TYPE_AUTHORIZATION_CODE'],
        appType: 'OIDC_APP_TYPE_USER_AGENT',
        authMethodType: 'OIDC_AUTH_METHOD_TYPE_NONE',
        devMode: true,
      }),
      signal: AbortSignal.timeout(5000),
    });
    const app = (await resp.json()) as { clientId: string };
    console.log(`[zitadel] SPA 앱 생성: ${app.clientId}`);
    return app.clientId;
  } catch (err) {
    console.warn(
      `[zitadel] SPA 앱 등록 실패 — 수동으로 Client ID를 입력하세요: ${(err as Error).message}`,
    );
    return '';
  }
}

async function main(): Promise<void> {
  const clientId = await setupZitadelApp();

  const app = new Hono();

  // Zitadel/Enrichment 프록시 (CORS 우회)
  app.get('/proxy/zitadel/health', async (c) => {
    try {
      const res = await fetch('http://localhost:8085/debug/healthz', {
        signal: AbortSignal.timeout(3000),
      });
      return c.json({ status: res.ok ? 'ok' : 'fail' }, res.ok ? 200 : 502);
    } catch {
      return c.json({ status: 'fail' }, 502);
    }
  });
  app.get('/proxy/enrichment/health', async (c) => {
    try {
      const res = await fetch('http://localhost:3900/health', {
        signal: AbortSignal.timeout(3000),
      });
      return c.json(await res.json(), res.status);
    } catch {
      return c.json({ status: 'fail' }, 502);
    }
  });

  // 모든 경로에서 HTML 제공 (/callback 포함)
  app.get('*', async (c) => {
    let html = await readFile(resolve(__dirname, '../test/oidc-login.html'), 'utf-8');
    // Client ID 자동 주입
    if (clientId) {
      html = html.replace(
        'value="" size="40" placeholder="Zitadel SPA app client ID"',
        `value="${clientId}" size="40"`,
      );
    }
    return c.html(html);
  });

  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`\n========================================`);
    console.log(`  OIDC 브라우저 테스트 환경`);
    console.log(`========================================`);
    console.log(`  URL:       http://localhost:${PORT}`);
    console.log(`  Zitadel:   http://localhost:8085`);
    console.log(`  Client ID: ${clientId || '(수동 입력 필요)'}`);
    console.log(`  계정:      admin / (infra secrets show)`);
    console.log(`========================================\n`);
  });
}

main();
