// @def.boundary registry-system
// @def.doc registry-system

// DEPRECATED: CompatApp createApp → NestJS 전환으로 비활성화. registry-service 자체 테스트(25파일, 212건)로 대체.

/**
 * Registry Service E2E — 데모 쇼핑 플랫폼 데이터 기반 검증
 *
 * demo-snapshot의 쇼핑 플랫폼 시나리오를 Registry Service에 등록하고,
 * DAG 조회 → capacity 시뮬레이션 → analyze → lock → release → resolve 전체 워크플로우를 검증한다.
 *
 * 데모 시나리오 구조:
 *
 *   Leaf prefixes:
 *     env(5), region(2), svc_name(5), namespace(2)  — infra 소유
 *     perm_svc(10), role(5→6)                        — auth 소유
 *     event_svc(10), event_name(7→9), initiator(2)   — tracking 소유
 *
 *   Composite prefixes:
 *     service     = env × region × svc_name × namespace  → 100   (infra)
 *     permission  = perm_svc × role                       → 50/60 (auth)
 *     event       = event_svc × event_name × initiator   → 140/180 (tracking)
 *
 *   v1→v2 시나리오:
 *     role:       5→6 (customer 추가)
 *     event_name: 7→9 (payment.cancel_requested, payment.cancel_approved 추가)
 *     → permission product: 50→60 (stride 변경: [5,1]→[6,1])
 *     → event product:     140→180 (stride 변경: [14,2,1]→[18,2,1])
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  buildRegistryApp,
  closeRegistryApps,
  json,
  post,
  type CompatApp,
} from './registry-test-app.js';

// ── 데모 상수 ──────────────────────────────────────────────

const DEMO = {
  // leaf capacities (v1)
  env: 5,
  region: 2,
  svc_name: 5,
  namespace: 2,
  perm_svc: 10,
  role_v1: 5,
  role_v2: 6,
  event_svc: 10,
  event_name_v1: 7,
  event_name_v2: 9,
  initiator: 2,

  // composite products
  service_product: 100, // 5×2×5×2
  perm_v1_product: 50, // 10×5
  perm_v2_product: 60, // 10×6
  event_v1_product: 140, // 10×7×2
  event_v2_product: 180, // 10×9×2
} as const;

// ── helpers ─────────────────────────────────────────────────

async function registerPrefix(
  app: CompatApp,
  prefix: string,
  owner: string,
  kind: 'leaf' | 'composite',
) {
  const res = await post(app, '/prefixes', { prefix, owner, kind, numberType: 'number' });
  expect(res.status).toBe(201);
}

async function createDraft(
  app: CompatApp,
  prefix: string,
  versionId: string,
  capacity: number,
  refs?: { prefix: string; versionId: string }[],
) {
  const res = await post(app, `/prefixes/${prefix}/versions`, {
    versionId,
    baseVersionId: null,
    capacity,
    ...(refs ? { refs } : {}),
  });
  return res;
}

// ══════════════════════════════════════════════════════════════
// §1. 쇼핑 플랫폼 prefix 등록 + DAG 구성
// ══════════════════════════════════════════════════════════════

afterEach(closeRegistryApps);

describe('Registry Service — 쇼핑 플랫폼 데모', () => {
  let app: CompatApp;

  async function setupV1() {
    const built = await buildRegistryApp();
    app = built.app;

    // 1. Leaf prefix 등록
    await registerPrefix(app, 'env', 'infra', 'leaf');
    await registerPrefix(app, 'region', 'infra', 'leaf');
    await registerPrefix(app, 'svc_name', 'infra', 'leaf');
    await registerPrefix(app, 'namespace', 'infra', 'leaf');
    await registerPrefix(app, 'perm_svc', 'auth', 'leaf');
    await registerPrefix(app, 'role', 'auth', 'leaf');
    await registerPrefix(app, 'event_svc', 'tracking', 'leaf');
    await registerPrefix(app, 'event_name', 'tracking', 'leaf');
    await registerPrefix(app, 'initiator', 'tracking', 'leaf');

    // 2. Composite prefix 등록
    await registerPrefix(app, 'service', 'infra', 'composite');
    await registerPrefix(app, 'permission', 'auth', 'composite');
    await registerPrefix(app, 'event', 'tracking', 'composite');

    // 3. Leaf draft v1
    await createDraft(app, 'env', 'v1', DEMO.env);
    await createDraft(app, 'region', 'v1', DEMO.region);
    await createDraft(app, 'svc_name', 'v1', DEMO.svc_name);
    await createDraft(app, 'namespace', 'v1', DEMO.namespace);
    await createDraft(app, 'perm_svc', 'v1', DEMO.perm_svc);
    await createDraft(app, 'role', 'v1', DEMO.role_v1);
    await createDraft(app, 'event_svc', 'v1', DEMO.event_svc);
    await createDraft(app, 'event_name', 'v1', DEMO.event_name_v1);
    await createDraft(app, 'initiator', 'v1', DEMO.initiator);

    // 4. Composite draft v1
    const svcRes = await createDraft(app, 'service', 'v1', 0, [
      { prefix: 'env', versionId: 'v1' },
      { prefix: 'region', versionId: 'v1' },
      { prefix: 'svc_name', versionId: 'v1' },
      { prefix: 'namespace', versionId: 'v1' },
    ]);
    expect(svcRes.status).toBe(201);

    const permRes = await createDraft(app, 'permission', 'v1', 0, [
      { prefix: 'perm_svc', versionId: 'v1' },
      { prefix: 'role', versionId: 'v1' },
    ]);
    expect(permRes.status).toBe(201);

    const evtRes = await createDraft(app, 'event', 'v1', 0, [
      { prefix: 'event_svc', versionId: 'v1' },
      { prefix: 'event_name', versionId: 'v1' },
      { prefix: 'initiator', versionId: 'v1' },
    ]);
    expect(evtRes.status).toBe(201);

    return built;
  }

  it('v1 composite capacities 검증', async () => {
    await setupV1();

    // service: 5×2×5×2 = 100
    const svc = await json(await app.request('/prefixes/service/versions/v1'));
    expect(svc.capacity).toBe(DEMO.service_product);
    expect(svc.shape).toEqual([5, 2, 5, 2]);
    expect(svc.stride).toEqual([20, 10, 2, 1]);
    expect(svc.product).toBe(100);

    // permission: 10×5 = 50
    const perm = await json(await app.request('/prefixes/permission/versions/v1'));
    expect(perm.capacity).toBe(DEMO.perm_v1_product);
    expect(perm.shape).toEqual([10, 5]);
    expect(perm.stride).toEqual([5, 1]);

    // event: 10×7×2 = 140
    const evt = await json(await app.request('/prefixes/event/versions/v1'));
    expect(evt.capacity).toBe(DEMO.event_v1_product);
    expect(evt.shape).toEqual([10, 7, 2]);
    expect(evt.stride).toEqual([14, 2, 1]);
  });

  it('DAG: service composite의 deps', async () => {
    await setupV1();

    const deps = await json(await app.request('/dag/service/v1/deps'));
    expect(deps.length).toBeGreaterThanOrEqual(1);
    // 구조 검증: 각 dep에 prefix 필드 존재
    for (const d of deps) expect(typeof (d as { prefix: string }).prefix).toBe('string');
  });

  it('DAG: role을 참조하는 composite 역추적', async () => {
    await setupV1();

    const refs = await json(await app.request('/dag/role/v1/reverse-refs'));
    expect(refs).toHaveLength(1);
    expect(refs[0].prefix).toBe('permission');
  });

  it('DAG: event_name을 참조하는 composite 역추적', async () => {
    await setupV1();

    const refs = await json(await app.request('/dag/event_name/v1/reverse-refs'));
    expect(refs).toHaveLength(1);
    expect(refs[0].prefix).toBe('event');
  });

  // ══════════════════════════════════════════════════════════
  // §2. v1→v2 시뮬레이션: role(5→6), event_name(7→9)
  // ══════════════════════════════════════════════════════════

  it('simulate: role 5→6 → permission stride 변경 감지', async () => {
    await setupV1();

    const res = await post(app, '/workspace/simulate', {
      changes: { role: { capacity: 6 } },
    });
    const body = await json(res);

    expect(body.impact).toHaveLength(1);
    const permImpact = body.impact[0];
    expect(permImpact.prefix).toBe('permission');
    expect(permImpact.owner).toBe('auth');
    expect(permImpact.currentShape).toEqual([10, 5]);
    expect(permImpact.newShape).toEqual([10, 6]);
    expect(permImpact.currentStride).toEqual([5, 1]);
    expect(permImpact.newStride).toEqual([6, 1]);
    expect(permImpact.strideChanged).toBe(true);
    expect(permImpact.currentProduct).toBe(50);
    expect(permImpact.newProduct).toBe(60);
    expect(permImpact.migrationRequired).toBe(true);
    expect(body.ready).toBe(true);
  });

  it('simulate: event_name 7→9 → event stride 변경 감지', async () => {
    await setupV1();

    const res = await post(app, '/workspace/simulate', {
      changes: { event_name: { capacity: 9 } },
    });
    const body = await json(res);

    expect(body.impact).toHaveLength(1);
    const evtImpact = body.impact[0];
    expect(evtImpact.prefix).toBe('event');
    expect(evtImpact.owner).toBe('tracking');
    expect(evtImpact.currentShape).toEqual([10, 7, 2]);
    expect(evtImpact.newShape).toEqual([10, 9, 2]);
    expect(evtImpact.currentStride).toEqual([14, 2, 1]);
    expect(evtImpact.newStride).toEqual([18, 2, 1]);
    expect(evtImpact.strideChanged).toBe(true);
    expect(evtImpact.newProduct).toBe(180);
  });

  it('simulate: 동시 변경 (role + event_name) → 양쪽 impact', async () => {
    await setupV1();

    const res = await post(app, '/workspace/simulate', {
      changes: {
        role: { capacity: 6 },
        event_name: { capacity: 9 },
      },
    });
    const body = await json(res);

    expect(body.impact).toHaveLength(2);
    const prefixes = body.impact.map((i: any) => i.prefix).toSorted();
    expect(prefixes).toEqual(['event', 'permission']);
    expect(body.ready).toBe(true);
  });

  it('simulate: env 변경 → service만 영향 (permission/event는 무관)', async () => {
    await setupV1();

    // env capacity 5→8 → service shape 변경, permission/event는 perm_svc/event_svc가 leaf이므로 무관
    const res = await post(app, '/workspace/simulate', {
      changes: { env: { capacity: 8 } },
    });
    const body = await json(res);

    expect(body.impact).toHaveLength(1);
    expect(body.impact[0].prefix).toBe('service');
    expect(body.impact[0].newShape).toEqual([8, 2, 5, 2]);
    expect(body.impact[0].newProduct).toBe(160);
  });

  // ══════════════════════════════════════════════════════════
  // §3. Analyze (Readiness Gate) + Release Order
  // ══════════════════════════════════════════════════════════

  it('analyze: v1 전체 draft 정합성 + 위상정렬 순서', async () => {
    await setupV1();

    const res = await post(app, '/workspace/analyze');
    const body = await json(res);

    expect(body.ready).toBe(true);
    expect(body.drafts.length).toBeGreaterThanOrEqual(1);

    // 위상정렬 불변조건: composite prefix의 dim 참조 대상이 composite보다 앞에 와야 함
    const order = body.releaseOrder as string[];
    const compositePrefixes = ['service', 'permission', 'event'];

    for (const comp of compositePrefixes) {
      const compIdx = order.indexOf(comp);
      if (compIdx === -1) continue;
      // composite의 모든 dim ref가 composite보다 앞에 위치
      const draft = body.drafts.find((d: { prefix: string }) => d.prefix === comp);
      if (!draft) continue;
      for (const dep of (draft as { deps?: string[] }).deps ?? []) {
        const depIdx = order.indexOf(dep);
        if (depIdx !== -1) expect(depIdx).toBeLessThan(compIdx);
      }
    }
  });

  // ══════════════════════════════════════════════════════════
  // §4. 전체 워크플로우: lock → release → activate → resolve
  // ══════════════════════════════════════════════════════════

  it('E2E: v1 lock-all → release-all → activate → resolve/active', async () => {
    await setupV1();

    // lock-all
    const lockRes = await post(app, '/workspace/lock-all');
    const lockBody = await json(lockRes);
    expect(lockBody.locked).toHaveLength(12);

    // locked 상태에서 capacity 변경 시도 → 거부
    const patchRes = await app.request('/prefixes/role/versions/v1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capacity: 99 }),
    });
    expect(patchRes.status).toBe(409);

    // release-all (위상정렬 순서로 자동 처리)
    const releaseRes = await post(app, '/workspace/release-all');
    const releaseBody = await json(releaseRes);
    expect(releaseBody.released).toHaveLength(12);

    // activate all
    const allPrefixes = [
      'env',
      'region',
      'svc_name',
      'namespace',
      'perm_svc',
      'role',
      'event_svc',
      'event_name',
      'initiator',
      'service',
      'permission',
      'event',
    ];
    for (const p of allPrefixes) {
      const activateRes = await post(app, `/prefixes/${p}/versions/v1/activate`);
      expect(activateRes.status).toBe(200);
    }

    // resolve/active → 전체 active 버전 조회
    const resolveRes = await json(await app.request('/resolve/active'));
    expect(Object.keys(resolveRes)).toHaveLength(12);

    // service composite 검증
    expect(resolveRes.service.versionId).toBe('v1');
    expect(resolveRes.service.capacity).toBe(100);
    expect(resolveRes.service.shape).toEqual([5, 2, 5, 2]);
    expect(resolveRes.service.stride).toEqual([20, 10, 2, 1]);

    // permission composite 검증
    expect(resolveRes.permission.versionId).toBe('v1');
    expect(resolveRes.permission.capacity).toBe(50);
    expect(resolveRes.permission.shape).toEqual([10, 5]);
    expect(resolveRes.permission.stride).toEqual([5, 1]);

    // event composite 검증
    expect(resolveRes.event.versionId).toBe('v1');
    expect(resolveRes.event.capacity).toBe(140);
    expect(resolveRes.event.shape).toEqual([10, 7, 2]);
    expect(resolveRes.event.stride).toEqual([14, 2, 1]);
  });

  it('manifest: 배포 아티팩트에 shape/stride 포함', async () => {
    await setupV1();

    // release + activate all
    await post(app, '/workspace/lock-all');
    await post(app, '/workspace/release-all');
    const allPrefixes = [
      'env',
      'region',
      'svc_name',
      'namespace',
      'perm_svc',
      'role',
      'event_svc',
      'event_name',
      'initiator',
      'service',
      'permission',
      'event',
    ];
    for (const p of allPrefixes) {
      await post(app, `/prefixes/${p}/versions/v1/activate`);
    }

    const manifest = await json(await app.request('/resolve/manifest'));
    expect(manifest.generatedAt).toBeDefined();
    expect(manifest.versions.service.stride).toEqual([20, 10, 2, 1]);
    expect(manifest.versions.permission.stride).toEqual([5, 1]);
    expect(manifest.versions.event.stride).toEqual([14, 2, 1]);
  });
});
