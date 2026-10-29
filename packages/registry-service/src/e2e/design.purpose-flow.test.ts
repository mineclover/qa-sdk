// @def.boundary registry-system
// @def.doc registry-system

/**
 * @purpose P1 설계 관리 — 핵심 흐름 (docs/proposals/swc-next-qa-sdk-optimization/07-purpose-alignment.md §5 단계 1)
 *
 * prefix draft → 변경 영향 시뮬레이션 → lock·release·activate → active 조회.
 * 주소 공간을 안전하게 표현할 수 없는 설계(overflow)는 release에서 거부된다.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildRegistryApp,
  closeRegistryApps,
  json,
  post,
  type CompatApp,
} from './registry-test-app.js';

afterEach(closeRegistryApps);

async function register(app: CompatApp, prefix: string, kind: 'leaf' | 'composite') {
  const res = await post(app, '/prefixes', { prefix, owner: 'design', kind, numberType: 'number' });
  expect(res.status, `register ${prefix}`).toBe(201);
}

async function draft(
  app: CompatApp,
  prefix: string,
  capacity: number,
  refs?: { prefix: string; versionId: string }[],
) {
  const res = await post(app, `/prefixes/${prefix}/versions`, {
    versionId: 'v1',
    baseVersionId: null,
    capacity,
    ...(refs ? { refs } : {}),
  });
  expect(res.status, `draft ${prefix}`).toBe(201);
}

describe('P1 설계 관리 — draft → 영향 분석 → release → active', () => {
  it('설계를 영향 분석 후 반영하고 active 판본으로 조회한다', async () => {
    const { app } = await buildRegistryApp();
    await register(app, 'role', 'leaf');
    await register(app, 'action', 'leaf');
    await register(app, 'permission', 'composite');
    await draft(app, 'role', 4);
    await draft(app, 'action', 3);
    await draft(app, 'permission', 0, [
      { prefix: 'role', versionId: 'v1' },
      { prefix: 'action', versionId: 'v1' },
    ]);

    // 변경 영향 — 첫 차원(role)은 capacity가 늘어도 stride가 그대로라 기존 주소가 유지된다
    const widenFirst = await json(
      await post(app, '/workspace/simulate', { changes: { role: { capacity: 8 } } }),
    );
    expect(widenFirst.impact).toEqual([
      expect.objectContaining({
        prefix: 'permission',
        currentProduct: 12,
        newProduct: 24,
        strideChanged: false,
        migrationRequired: false,
      }),
    ]);

    // 뒤 차원(action)을 늘리면 앞 차원 stride가 바뀌어 기존 주소를 옮겨야 한다
    const widenLast = await json(
      await post(app, '/workspace/simulate', { changes: { action: { capacity: 6 } } }),
    );
    expect(widenLast.impact).toEqual([
      expect.objectContaining({
        prefix: 'permission',
        currentStride: [3, 1],
        newStride: [6, 1],
        strideChanged: true,
        migrationRequired: true,
      }),
    ]);

    // 반영
    expect((await post(app, '/workspace/lock-all')).status).toBe(200);
    expect((await json(await post(app, '/workspace/release-all'))).released).toHaveLength(3);
    for (const prefix of ['role', 'action', 'permission']) {
      expect((await post(app, `/prefixes/${prefix}/versions/v1/activate`)).status).toBe(200);
    }

    const active = await json(await app.request('/resolve/active'));
    expect(JSON.stringify(active)).toContain('permission');
  });

  it('주소 공간이 2^53을 넘는 number 설계는 release에서 OVERFLOW로 거부한다', async () => {
    const { app } = await buildRegistryApp();
    await register(app, 'huge_a', 'leaf');
    await register(app, 'huge_b', 'leaf');
    await register(app, 'huge', 'composite');
    await draft(app, 'huge_a', 100_000_000);
    await draft(app, 'huge_b', 100_000_000);
    await draft(app, 'huge', 0, [
      { prefix: 'huge_a', versionId: 'v1' },
      { prefix: 'huge_b', versionId: 'v1' },
    ]);
    expect((await post(app, '/prefixes/huge_a/versions/v1/release')).status).toBe(200);
    expect((await post(app, '/prefixes/huge_b/versions/v1/release')).status).toBe(200);

    const res = await post(app, '/prefixes/huge/versions/v1/release');
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe('OVERFLOW');
  });
});
