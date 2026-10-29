// @def.boundary registry-system
// @def.doc registry-system

// DEPRECATED: CompatApp createApp → NestJS 전환으로 비활성화. registry-service 자체 테스트(25파일, 212건)로 대체.

/**
 * Registry Hardening E2E — 서비스 경화 검증
 *
 * 1. 순환참조 write 거부
 * 2. Readiness gate release 차단
 * 3. Lock store 동작 검증
 * 4. Overflow release 차단
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  buildRegistryApp,
  closeRegistryApps,
  json,
  post,
  type CompatApp,
} from './registry-test-app.js';

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
  return post(app, `/prefixes/${prefix}/versions`, {
    versionId,
    baseVersionId: null,
    capacity,
    ...(refs ? { refs } : {}),
  });
}

// ══════════════════════════════════════════════════════════════
// §1. 순환참조 검증
// ══════════════════════════════════════════════════════════════

afterEach(closeRegistryApps);

describe('Registry Hardening E2E', () => {
  describe('Circular Reference Detection', () => {
    it('자기 참조 — createDraft에서 거부', async () => {
      const { app } = await buildRegistryApp();

      await registerPrefix(app, 'self_ref', 'test', 'composite');
      await registerPrefix(app, 'leaf_a', 'test', 'leaf');
      await createDraft(app, 'leaf_a', 'v1', 10);

      const res = await createDraft(app, 'self_ref', 'v1', 0, [
        { prefix: 'self_ref', versionId: 'v1' },
      ]);
      expect(res.status).toBe(400);
      const body = await json(res);
      expect(body.error.code).toBe('CIRCULAR_REF');
      expect(body.error.message).toContain('Self-reference');
    });

    it('간접 순환 — A→B→A 참조 거부', async () => {
      const { app } = await buildRegistryApp();

      await registerPrefix(app, 'leaf_x', 'test', 'leaf');
      await registerPrefix(app, 'comp_a', 'test', 'composite');
      await registerPrefix(app, 'comp_b', 'test', 'composite');

      await createDraft(app, 'leaf_x', 'v1', 10);

      // comp_a → leaf_x (정상)
      const resA = await createDraft(app, 'comp_a', 'v1', 0, [
        { prefix: 'leaf_x', versionId: 'v1' },
      ]);
      expect(resA.status).toBe(201);

      // comp_b → comp_a (정상)
      const resB = await createDraft(app, 'comp_b', 'v1', 0, [
        { prefix: 'comp_a', versionId: 'v1' },
      ]);
      expect(resB.status).toBe(201);

      // comp_a를 comp_b에 refs로 patch → comp_a → comp_b → comp_a 순환
      const patchRes = await app.request('/prefixes/comp_a/versions/v1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refs: [
            { prefix: 'leaf_x', versionId: 'v1' },
            { prefix: 'comp_b', versionId: 'v1' },
          ],
        }),
      });
      expect(patchRes.status).toBe(400);
      const body = await json(patchRes);
      expect(body.error.code).toBe('CIRCULAR_REF');
    });

    it('정상적인 diamond DAG는 허용', async () => {
      const { app } = await buildRegistryApp();

      await registerPrefix(app, 'base', 'test', 'leaf');
      await registerPrefix(app, 'mid_a', 'test', 'composite');
      await registerPrefix(app, 'mid_b', 'test', 'composite');
      await registerPrefix(app, 'top', 'test', 'composite');

      await createDraft(app, 'base', 'v1', 10);

      // mid_a → base, mid_b → base (diamond 아래쪽)
      const rA = await createDraft(app, 'mid_a', 'v1', 0, [{ prefix: 'base', versionId: 'v1' }]);
      expect(rA.status).toBe(201);

      const rB = await createDraft(app, 'mid_b', 'v1', 0, [{ prefix: 'base', versionId: 'v1' }]);
      expect(rB.status).toBe(201);

      // top → mid_a, mid_b (diamond 위쪽) — 순환 아님
      const rTop = await createDraft(app, 'top', 'v1', 0, [
        { prefix: 'mid_a', versionId: 'v1' },
        { prefix: 'mid_b', versionId: 'v1' },
      ]);
      expect(rTop.status).toBe(201);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // §2. Readiness Gate
  // ══════════════════════════════════════════════════════════════

  describe('Readiness Gate', () => {
    it('release-all: overflow 시 NOT_READY로 차단', async () => {
      const { app } = await buildRegistryApp();

      await registerPrefix(app, 'huge_a', 'test', 'leaf');
      await registerPrefix(app, 'huge_b', 'test', 'leaf');
      await registerPrefix(app, 'huge_comp', 'test', 'composite');

      // 각각 1억 → product = 1e16 > MAX_SAFE_INTEGER
      await createDraft(app, 'huge_a', 'v1', 100_000_000);
      await createDraft(app, 'huge_b', 'v1', 100_000_000);
      await createDraft(app, 'huge_comp', 'v1', 0, [
        { prefix: 'huge_a', versionId: 'v1' },
        { prefix: 'huge_b', versionId: 'v1' },
      ]);

      // lock all
      await post(app, '/workspace/lock-all');

      // release-all → NOT_READY (overflow error)
      const res = await post(app, '/workspace/release-all');
      expect(res.status).toBe(409);
      const body = await json(res);
      expect(body.error.code).toBe('NOT_READY');
      expect(body.error.message).toContain('Release blocked');
    });

    it('release 개별: overflow composite은 release 거부', async () => {
      const { app } = await buildRegistryApp();

      await registerPrefix(app, 'big_x', 'test', 'leaf');
      await registerPrefix(app, 'big_y', 'test', 'leaf');
      await registerPrefix(app, 'big_comp', 'test', 'composite');

      await createDraft(app, 'big_x', 'v1', 100_000_000);
      await createDraft(app, 'big_y', 'v1', 100_000_000);
      await createDraft(app, 'big_comp', 'v1', 0, [
        { prefix: 'big_x', versionId: 'v1' },
        { prefix: 'big_y', versionId: 'v1' },
      ]);

      // leaf release는 문제없음
      const leafRes = await post(app, '/prefixes/big_x/versions/v1/release');
      expect(leafRes.status).toBe(200);

      // composite release → overflow 거부
      const compRes = await post(app, '/prefixes/big_comp/versions/v1/release');
      expect(compRes.status).toBe(400);
      const body = await json(compRes);
      expect(body.error.code).toBe('OVERFLOW');
    });

    it('release-all: 정상 스키마는 성공', async () => {
      const { app } = await buildRegistryApp();

      await registerPrefix(app, 'a', 'test', 'leaf');
      await registerPrefix(app, 'b', 'test', 'leaf');
      await registerPrefix(app, 'ab', 'test', 'composite');

      await createDraft(app, 'a', 'v1', 10);
      await createDraft(app, 'b', 'v1', 5);
      await createDraft(app, 'ab', 'v1', 0, [
        { prefix: 'a', versionId: 'v1' },
        { prefix: 'b', versionId: 'v1' },
      ]);

      await post(app, '/workspace/lock-all');

      const res = await post(app, '/workspace/release-all');
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.released).toHaveLength(3);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // §3. Lock Store 동작 검증
  // ══════════════════════════════════════════════════════════════

  describe('Lock Store Behavior', () => {
    it('lock → unlocked 상태 확인 → unlock → re-lock 가능', async () => {
      const { app } = await buildRegistryApp();

      await registerPrefix(app, 'role', 'test', 'leaf');
      await createDraft(app, 'role', 'v1', 10);

      // lock
      let res = await post(app, '/prefixes/role/versions/v1/lock');
      expect(res.status).toBe(200);

      // locked 상태 확인
      res = await app.request('/prefixes/role/versions/v1');
      let body = await json(res);
      expect(body.status).toBe('locked');
      expect(body.lockedAt).toBeDefined();

      // unlock
      res = await post(app, '/prefixes/role/versions/v1/unlock');
      expect(res.status).toBe(200);

      // unlocked 상태 확인
      res = await app.request('/prefixes/role/versions/v1');
      body = await json(res);
      expect(body.status).toBe('draft');

      // re-lock 가능
      res = await post(app, '/prefixes/role/versions/v1/lock');
      expect(res.status).toBe(200);

      res = await app.request('/prefixes/role/versions/v1');
      body = await json(res);
      expect(body.status).toBe('locked');
    });

    it('lock-all → locked 상태에서 patch 거부', async () => {
      const { app } = await buildRegistryApp();

      await registerPrefix(app, 'x', 'test', 'leaf');
      await registerPrefix(app, 'y', 'test', 'leaf');
      await createDraft(app, 'x', 'v1', 10);
      await createDraft(app, 'y', 'v1', 5);

      // lock-all
      await post(app, '/workspace/lock-all');

      // patch 거부
      const res = await app.request('/prefixes/x/versions/v1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capacity: 20 }),
      });
      expect(res.status).toBe(409);
      const body = await json(res);
      expect(body.error.code).toBe('DRAFT_LOCKED');
    });

    it('release로 lock 자동 해제', async () => {
      const { app } = await buildRegistryApp();

      await registerPrefix(app, 'z', 'test', 'leaf');
      await createDraft(app, 'z', 'v1', 10);

      // lock
      await post(app, '/prefixes/z/versions/v1/lock');

      // release (locked → released, lock 자동 해제)
      const res = await post(app, '/prefixes/z/versions/v1/release');
      expect(res.status).toBe(200);

      // released 상태 확인
      const ver = await json(await app.request('/prefixes/z/versions/v1'));
      expect(ver.status).toBe('released');
    });
  });
}); // describe("Registry Hardening E2E")
