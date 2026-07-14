// @def.boundary registry-system
// @def.doc registry-system

import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../../app.module.js';
import { createNestTestApp, request, json } from '../../test/nest-helpers.js';

const apps: NestFastifyApplication[] = [];

afterEach(async () => {
  while (apps.length > 0) {
    await apps.pop()!.close();
  }
});

async function buildApp() {
  const app = await createNestTestApp({ imports: [AppModule] });
  apps.push(app);
  return app;
}

async function seedServiceRelease(app: NestFastifyApplication) {
  await request(app, 'PUT', '/api/services/order-svc/components/service-unit/su-v1?catalog=demo', {
    serviceId: 'order-svc',
    namespace: 'shop',
    name: 'order',
    tier: 'backend',
  });
  await request(app, 'PUT', '/api/services/order-svc/components/ownership/own-v1?catalog=demo', {
    serviceId: 'order-svc',
    ownedPrefixes: ['tracking'],
  });
  await request(app, 'PUT', '/api/services/order-svc/components/exposure/exp-v1?catalog=demo', {
    serviceId: 'order-svc',
    gatewayPath: '/orders',
    stripPrefix: true,
  });
  await request(
    app,
    'PUT',
    '/api/services/order-svc/components/runtime-address/ra-v1?catalog=demo',
    {
      serviceId: 'order-svc',
      namespace: 'shop',
      name: 'order',
      env: 'prod',
      region: 'asia',
    },
  );
  await request(
    app,
    'PUT',
    '/api/services/order-svc/components/deployment-binding/dep-v1?catalog=demo',
    {
      serviceId: 'order-svc',
      deploymentVersion: 'dep-v1',
      address: {
        serviceId: 'order-svc',
        runtime: {
          serviceId: 'order-svc',
          namespace: 'shop',
          name: 'order',
          env: 'prod',
          region: 'asia',
        },
        provider: 'pulumi',
        project: 'core',
        stack: 'prod',
        resourceKey: 'api',
      },
      observedAt: '2026-04-04T00:00:00.000Z',
      url: 'https://order.example.com',
    },
  );
  await request(
    app,
    'POST',
    '/api/services/order-svc/components/service-unit/su-v1/transition?catalog=demo',
    { state: 'published' },
  );
  await request(
    app,
    'POST',
    '/api/services/order-svc/components/ownership/own-v1/transition?catalog=demo',
    { state: 'published' },
  );
  await request(
    app,
    'POST',
    '/api/services/order-svc/components/exposure/exp-v1/transition?catalog=demo',
    { state: 'published' },
  );
  await request(
    app,
    'POST',
    '/api/services/order-svc/components/runtime-address/ra-v1/transition?catalog=demo',
    { state: 'published' },
  );
  await request(
    app,
    'POST',
    '/api/services/order-svc/components/deployment-binding/dep-v1/transition?catalog=demo',
    { state: 'published' },
  );

  await request(app, 'POST', '/manifests/prefixes', { prefixId: 'tracking', version: 'v1' });
  await request(app, 'POST', '/manifests/prefixes/tracking/v1/transition', { state: 'released' });
  await request(app, 'POST', '/manifests/assemble?catalog=demo', {
    serviceId: 'order-svc',
    manifestVersion: '1.0.0',
    runtimeAddressVersion: 'ra-v1',
    serviceUnitVersion: 'su-v1',
    ownershipVersion: 'own-v1',
    exposureVersion: 'exp-v1',
    deploymentVersion: 'dep-v1',
    prefixes: { tracking: 'v1' },
    changelog: 'initial release',
  });
  await request(app, 'POST', '/manifests/order-svc/1.0.0/transition', { state: 'published' });
  await request(app, 'POST', '/manifests/order-svc/1.0.0/transition', { state: 'active' });
}

async function seedRuntimeOnlyRelease(app: NestFastifyApplication) {
  await request(app, 'PUT', '/api/services/report-svc/components/service-unit/su-v1?catalog=demo', {
    serviceId: 'report-svc',
    namespace: 'shop',
    name: 'report',
    tier: 'backend',
  });
  await request(app, 'PUT', '/api/services/report-svc/components/ownership/own-v1?catalog=demo', {
    serviceId: 'report-svc',
    ownedPrefixes: ['tracking'],
  });
  await request(
    app,
    'PUT',
    '/api/services/report-svc/components/runtime-address/ra-v1?catalog=demo',
    {
      serviceId: 'report-svc',
      namespace: 'shop',
      name: 'report',
      env: 'prod',
      region: 'asia',
    },
  );
  await request(
    app,
    'PUT',
    '/api/services/report-svc/components/deployment-binding/dep-v1?catalog=demo',
    {
      serviceId: 'report-svc',
      deploymentVersion: 'dep-v1',
      address: {
        serviceId: 'report-svc',
        runtime: {
          serviceId: 'report-svc',
          namespace: 'shop',
          name: 'report',
          env: 'prod',
          region: 'asia',
        },
        provider: 'pulumi',
        project: 'core',
        stack: 'prod',
        resourceKey: 'api',
      },
      observedAt: '2026-04-04T00:00:00.000Z',
      url: 'https://report-binding.example.com',
    },
  );
  await request(app, 'PUT', '/api/endpoints/shop/report/prod/asia?catalog=demo', {
    url: 'https://report-endpoint.example.com',
  });
  await request(
    app,
    'POST',
    '/api/services/report-svc/components/service-unit/su-v1/transition?catalog=demo',
    { state: 'published' },
  );
  await request(
    app,
    'POST',
    '/api/services/report-svc/components/ownership/own-v1/transition?catalog=demo',
    { state: 'published' },
  );
  await request(
    app,
    'POST',
    '/api/services/report-svc/components/runtime-address/ra-v1/transition?catalog=demo',
    { state: 'published' },
  );
  await request(
    app,
    'POST',
    '/api/services/report-svc/components/deployment-binding/dep-v1/transition?catalog=demo',
    { state: 'published' },
  );

  await request(app, 'POST', '/manifests/prefixes', { prefixId: 'tracking', version: 'v1' });
  await request(app, 'POST', '/manifests/prefixes/tracking/v1/transition', { state: 'released' });
  await request(app, 'POST', '/manifests/assemble?catalog=demo', {
    serviceId: 'report-svc',
    manifestVersion: '1.0.0',
    runtimeAddressVersion: 'ra-v1',
    serviceUnitVersion: 'su-v1',
    ownershipVersion: 'own-v1',
    prefixes: { tracking: 'v1' },
  });
  await request(app, 'POST', '/manifests/report-svc/1.0.0/transition', { state: 'published' });
  await request(app, 'POST', '/manifests/report-svc/1.0.0/transition', { state: 'active' });
}

describe('ResolveController service release read model', () => {
  it('GET /resolve/services/:serviceId returns manifest-linked child components', async () => {
    const app = await buildApp();
    await seedServiceRelease(app);

    const res = await request(app, 'GET', '/resolve/services/order-svc?catalog=demo');
    expect(res.statusCode).toBe(200);
    expect(json(res)).toMatchObject({
      serviceId: 'order-svc',
      manifestVersion: '1.0.0',
      runtimeAddress: {
        serviceId: 'order-svc',
        namespace: 'shop',
        name: 'order',
        env: 'prod',
        region: 'asia',
      },
      unit: {
        serviceId: 'order-svc',
        namespace: 'shop',
        name: 'order',
      },
      ownership: {
        serviceId: 'order-svc',
        ownedPrefixes: ['tracking'],
      },
      exposure: {
        serviceId: 'order-svc',
        gatewayPath: '/orders',
        stripPrefix: true,
      },
      deploymentBinding: {
        deploymentVersion: 'dep-v1',
        url: 'https://order.example.com',
      },
      endpoint: {
        url: 'https://order.example.com',
      },
      prefixes: { tracking: 'v1' },
      versions: {
        runtimeAddressVersion: 'ra-v1',
        serviceUnitVersion: 'su-v1',
        ownershipVersion: 'own-v1',
        exposureVersion: 'exp-v1',
        deploymentVersion: 'dep-v1',
      },
    });
  });

  it('GET /resolve/services/:serviceId returns 404 when no active manifest exists', async () => {
    const app = await buildApp();
    const res = await request(app, 'GET', '/resolve/services/missing-svc?catalog=demo');
    expect(res.statusCode).toBe(404);
  });

  it('does not auto-select deploymentBinding when manifest does not pin one', async () => {
    const app = await buildApp();
    await seedRuntimeOnlyRelease(app);

    const res = await request(
      app,
      'GET',
      '/resolve/services/report-svc?catalog=demo&env=prod&region=asia&project=core&stack=prod&resourceKey=api',
    );
    expect(res.statusCode).toBe(200);
    const body = json<{
      serviceId: string;
      manifestVersion: string;
      deploymentBinding?: unknown;
      endpoint?: { url: string };
      versions: { deploymentVersion?: string };
      selection: { deploymentBinding: string; endpoint: string };
    }>(res);
    expect(body).toMatchObject({
      serviceId: 'report-svc',
      manifestVersion: '1.0.0',
      endpoint: {
        url: 'https://report-endpoint.example.com',
      },
      selection: {
        deploymentBinding: 'none',
        endpoint: 'service-endpoint',
      },
    });
    expect(body.deploymentBinding).toBeUndefined();
    expect(body.versions.deploymentVersion).toBeUndefined();
  });

  it('exposes deprecated component references on a separate warning surface', async () => {
    const app = await buildApp();
    await seedServiceRelease(app);
    await request(
      app,
      'POST',
      '/api/services/order-svc/components/exposure/exp-v1/transition?catalog=demo',
      { state: 'deprecated' },
    );

    const res = await request(app, 'GET', '/resolve/services/order-svc/warnings?catalog=demo');
    expect(res.statusCode).toBe(200);
    expect(json(res)).toMatchObject({
      serviceId: 'order-svc',
      manifestVersion: '1.0.0',
      summary: {
        total: 1,
        deprecatedReferences: 1,
        byKind: {
          exposure: 1,
        },
      },
      warnings: [
        {
          code: 'DEPRECATED_COMPONENT_REFERENCE',
          severity: 'warning',
          kind: 'exposure',
          version: 'exp-v1',
        },
      ],
    });
  });

  it('builds a cleanup plan with suggested replacement versions', async () => {
    const app = await buildApp();
    await seedServiceRelease(app);
    await request(app, 'PUT', '/api/services/order-svc/components/exposure/exp-v2?catalog=demo', {
      serviceId: 'order-svc',
      gatewayPath: '/orders-v2',
      stripPrefix: true,
    });
    await request(
      app,
      'POST',
      '/api/services/order-svc/components/exposure/exp-v2/transition?catalog=demo',
      { state: 'published' },
    );
    await request(
      app,
      'POST',
      '/api/services/order-svc/components/exposure/exp-v1/transition?catalog=demo',
      { state: 'deprecated' },
    );

    const res = await request(app, 'GET', '/resolve/services/order-svc/cleanup-plan?catalog=demo');
    expect(res.statusCode).toBe(200);
    expect(json(res)).toMatchObject({
      serviceId: 'order-svc',
      manifestVersion: '1.0.0',
      ready: true,
      items: [
        {
          kind: 'exposure',
          currentVersion: 'exp-v1',
          candidateVersions: ['exp-v2'],
          suggestedVersion: 'exp-v2',
          status: 'replaceable',
        },
      ],
    });
  });

  it('creates a non-destructive cleanup draft manifest', async () => {
    const app = await buildApp();
    await seedServiceRelease(app);
    await request(app, 'PUT', '/api/services/order-svc/components/exposure/exp-v2?catalog=demo', {
      serviceId: 'order-svc',
      gatewayPath: '/orders-v2',
      stripPrefix: true,
    });
    await request(
      app,
      'POST',
      '/api/services/order-svc/components/exposure/exp-v2/transition?catalog=demo',
      { state: 'published' },
    );
    await request(
      app,
      'POST',
      '/api/services/order-svc/components/exposure/exp-v1/transition?catalog=demo',
      { state: 'deprecated' },
    );

    const res = await request(app, 'POST', '/resolve/services/order-svc/cleanup-draft', {
      catalogId: 'demo',
      newManifestVersion: '1.0.1-cleanup',
    });
    expect(res.statusCode).toBe(201);
    expect(json(res)).toMatchObject({
      ok: true,
      sourceManifestVersion: '1.0.0',
      manifestVersion: '1.0.1-cleanup',
      replacements: {
        exposureVersion: 'exp-v2',
      },
    });

    const draft = await request(app, 'GET', '/manifests/order-svc/1.0.1-cleanup');
    expect(draft.statusCode).toBe(200);
    expect(json(draft)).toMatchObject({
      manifestVersion: '1.0.1-cleanup',
      exposureVersion: 'exp-v2',
      state: 'draft',
    });
  });

  it('activates a cleanup draft and supersedes the previous active manifest', async () => {
    const app = await buildApp();
    await seedServiceRelease(app);
    await request(app, 'PUT', '/api/services/order-svc/components/exposure/exp-v2?catalog=demo', {
      serviceId: 'order-svc',
      gatewayPath: '/orders-v2',
      stripPrefix: true,
    });
    await request(
      app,
      'POST',
      '/api/services/order-svc/components/exposure/exp-v2/transition?catalog=demo',
      { state: 'published' },
    );
    await request(
      app,
      'POST',
      '/api/services/order-svc/components/exposure/exp-v1/transition?catalog=demo',
      { state: 'deprecated' },
    );

    await request(app, 'POST', '/resolve/services/order-svc/cleanup-draft', {
      catalogId: 'demo',
      newManifestVersion: '1.0.1-cleanup',
    });

    const activate = await request(app, 'POST', '/resolve/services/order-svc/cleanup-activate', {
      catalogId: 'demo',
      manifestVersion: '1.0.1-cleanup',
    });
    expect(activate.statusCode).toBe(201);
    expect(json(activate)).toMatchObject({
      ok: true,
      previousActiveManifestVersion: '1.0.0',
      activatedManifestVersion: '1.0.1-cleanup',
      state: 'active',
      warningsCleared: true,
    });

    const active = await request(app, 'GET', '/manifests/order-svc/active');
    expect(active.statusCode).toBe(200);
    expect(json(active)).toMatchObject({
      manifestVersion: '1.0.1-cleanup',
      exposureVersion: 'exp-v2',
      state: 'active',
    });

    const warnings = await request(app, 'GET', '/resolve/services/order-svc/warnings?catalog=demo');
    expect(warnings.statusCode).toBe(200);
    expect(json(warnings)).toMatchObject({
      summary: {
        total: 0,
      },
      warnings: [],
    });
  });

  it('blocks cleanup activation when deprecated references remain', async () => {
    const app = await buildApp();
    await seedServiceRelease(app);
    await request(
      app,
      'POST',
      '/api/services/order-svc/components/exposure/exp-v1/transition?catalog=demo',
      { state: 'deprecated' },
    );

    const blocked = await request(app, 'POST', '/resolve/services/order-svc/cleanup-activate', {
      catalogId: 'demo',
      manifestVersion: '1.0.0',
    });
    expect(blocked.statusCode).toBe(409);
  });
});
