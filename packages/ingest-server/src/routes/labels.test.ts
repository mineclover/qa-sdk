import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { createRuntimeStores } from '../stores/runtime-stores.js';
import { createLabelsRoutes } from './labels.js';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

async function sqliteLabelsApp() {
  const stores = await createRuntimeStores({
    env: { STORE_DRIVER: 'sqlite', SQLITE_PATH: undefined, TRACE_DATABASE_URL: undefined },
    logger: { warn: vi.fn() },
    migrationsFolder,
  });
  return { stores, app: createLabelsRoutes({ driver: stores.sqlDriver }) };
}

function postJson(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

describe('/v1/labels (S-7)', () => {
  it('Node SQLite 런타임 store가 드라이버를 제공해 라벨을 저장·조회한다', async () => {
    const { stores, app } = await sqliteLabelsApp();
    expect(stores.sqlDriver).toBeDefined();

    const created = await app.request(
      '/v1/labels',
      postJson({ kind: 'correlation', targetId: 'svc:a|svc:b', label: '결제 흐름' }),
    );
    expect(created.status).toBe(200);
    const { id } = (await created.json()) as { id: string };

    const one = await app.request(`/v1/labels/${id}`);
    expect(one.status).toBe(200);
    expect(await one.json()).toMatchObject({ kind: 'correlation', label: '결제 흐름' });

    const summary = (await (await app.request('/v1/labels/summary')).json()) as unknown;
    expect(JSON.stringify(summary)).toContain('correlation');
  });

  it('필수 필드가 없으면 400', async () => {
    const { app } = await sqliteLabelsApp();
    const res = await app.request('/v1/labels', postJson({ kind: 'correlation' }));
    expect(res.status).toBe(400);
  });

  it('SQL 드라이버가 없는 구성(pg·InMemory)에서는 라우트를 등록하지 않는다', async () => {
    const app = createLabelsRoutes({});
    expect((await app.request('/v1/labels')).status).toBe(404);
  });
});
