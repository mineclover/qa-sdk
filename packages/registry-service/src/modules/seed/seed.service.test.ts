import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { RuntimeModule } from '../../runtime.module.js';
import { createNestTestApp, request, json } from '../../test/nest-helpers.js';

const apps: NestFastifyApplication[] = [];

afterEach(async () => {
  while (apps.length > 0) {
    await apps.pop()!.close();
  }
});

describe('SeedModule (Nest runtime)', () => {
  it('seeds catalog, axis profiles, endpoints, and leaves prefixes empty on startup', async () => {
    const app = await createNestTestApp({ imports: [RuntimeModule] });
    apps.push(app);

    const catalogsResponse = await request(app, 'GET', '/catalogs');
    expect(catalogsResponse.statusCode).toBe(200);
    const catalogs = json<Array<{ id: string }>>(catalogsResponse);
    expect(catalogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'demo' }),
        expect.objectContaining({ id: 'definition' }),
      ]),
    );

    const prefixesResponse = await request(app, 'GET', '/prefixes');
    expect(prefixesResponse.statusCode).toBe(200);
    expect(json<unknown[]>(prefixesResponse)).toEqual([]);

    const axesResponse = await request(app, 'GET', '/catalogs/demo/axes');
    expect(axesResponse.statusCode).toBe(200);
    expect(json<Array<{ id: string }>>(axesResponse).length).toBeGreaterThan(0);

    const svcAxisResponse = await request(app, 'GET', '/catalogs/demo/axes/svc_name');
    expect(svcAxisResponse.statusCode).toBe(200);
    const svcAxis = json<{ id: string; currentVersion: string; entryCount: number }>(
      svcAxisResponse,
    );
    expect(svcAxis.id).toBe('svc_name');
    expect(svcAxis.currentVersion).toBe('v1');
    expect(svcAxis.entryCount).toBeGreaterThanOrEqual(16);

    const demoCatalogResponse = await request(app, 'GET', '/catalogs/demo');
    expect(demoCatalogResponse.statusCode).toBe(200);
    const demoCatalog = json<{ data: string }>(demoCatalogResponse);
    const parsedCatalog = JSON.parse(demoCatalog.data) as {
      axes?: { svc_name?: { versions?: { v1?: { entries?: string[] } } } };
    };
    const svcEntries = parsedCatalog.axes?.svc_name?.versions?.v1?.entries ?? [];
    expect(svcEntries).toContain('roleplay-web');
    expect(svcEntries).toContain('viteplus-sdk-smoke');

    const endpointsResponse = await request(app, 'GET', '/api/endpoints?catalog=demo');
    expect(endpointsResponse.statusCode).toBe(200);
    expect(
      json<Array<{ namespace: string; svcName: string }>>(endpointsResponse).length,
    ).toBeGreaterThan(0);
  }, 20_000);
});
