// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement
// 시나리오 4 회귀 — Plan 13b 의 cross-department deny 가 DB RLS 레벨에서도 차단되는지 확인.
// 본 저장소에는 budget_request 테이블이 없으므로 auth.resource_policies 의 cross-actor deny 로 대리.

import postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { withRlsContext } from 'db-bootstrap';
import { RP_READ_BIT, RP_WRITE_BIT } from './rls-bits.js';
import { RlsAwarePgResourcePolicyRegistry } from './rls-aware-adapter.js';

const PG_AVAILABLE = process.env.QA_TEST_PG === '1';
const FORCE_APPLIED = process.env.QA_TEST_PG_FORCE === '1';

function setBitBytes(pos: number): Uint8Array {
  const byteIdx = Math.floor(pos / 8);
  const bitIdx = pos % 8;
  const out = new Uint8Array(byteIdx + 1);
  out[byteIdx] = 1 << bitIdx;
  return out;
}

/**
 * 본 테스트는 **실제 FORCE 가 적용된 qa-sdk-db 인스턴스** 에서만 의미 있음.
 * env gate: QA_TEST_PG=1 + QA_TEST_PG_FORCE=1.
 *
 * 본 fixture 는 테스트 전용 테이블에 ALTER TABLE ... FORCE ROW LEVEL SECURITY 를
 * 수동 적용 — global enforce 는 운영 스크립트(apply-rls-enforce.sh) 책임.
 */
const RESET_TABLE_DDL = `
DROP TABLE IF EXISTS auth.resource_policies CASCADE;

CREATE TABLE auth.resource_policies (
  resource_id       TEXT PRIMARY KEY,
  resource_type     TEXT NOT NULL,
  state             VARCHAR(16) NOT NULL CHECK (state IN ('UNREGISTERED','REGISTERED','DELEGATED')),
  owner_id          TEXT NOT NULL,
  cerbos_policy_ref TEXT,
  graph_root_id     TEXT,
  registered_at     TEXT,
  delegated_at      TEXT,
  updated_at        TEXT NOT NULL
);

ALTER TABLE auth.resource_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.resource_policies FORCE ROW LEVEL SECURITY;

CREATE POLICY rp_admin_bypass ON auth.resource_policies
  FOR ALL
  USING (auth.current_role_tag() = 'admin')
  WITH CHECK (auth.current_role_tag() = 'admin');

CREATE POLICY rp_select_policy ON auth.resource_policies
  FOR SELECT
  USING (
    auth.has_bit(10)
    AND state = 'UNREGISTERED'
    AND owner_id = auth.current_user_id()
  );

CREATE POLICY rp_insert_policy ON auth.resource_policies
  FOR INSERT
  WITH CHECK (
    auth.has_bit(11)
    AND owner_id = auth.current_user_id()
  );

CREATE POLICY rp_update_policy ON auth.resource_policies
  FOR UPDATE
  USING (
    auth.has_bit(11)
    AND state = 'UNREGISTERED'
    AND owner_id = auth.current_user_id()
  )
  WITH CHECK (
    owner_id = auth.current_user_id()
  );

CREATE POLICY rp_delete_policy ON auth.resource_policies
  FOR DELETE
  USING (
    auth.has_bit(12)
    AND state = 'UNREGISTERED'
    AND owner_id = auth.current_user_id()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON auth.resource_policies TO auth_app;
`;

describe.skipIf(!(PG_AVAILABLE && FORCE_APPLIED))(
  'RLS enforce 회귀 — 시나리오 4 대리 (resource_policies)',
  () => {
    const cfg = {
      host: process.env.QA_TEST_PG_HOST ?? 'localhost',
      port: Number(process.env.QA_TEST_PG_PORT ?? '5434'),
      database: process.env.QA_TEST_PG_DATABASE ?? 'qa_sdk_test',
    };
    let adminSql: ReturnType<typeof postgres>;
    let appSql: ReturnType<typeof postgres>;
    let registry: RlsAwarePgResourcePolicyRegistry;

    beforeEach(async () => {
      adminSql = postgres({
        ...cfg,
        user: 'qa_admin',
        password: process.env.QA_TEST_PG_PASSWORD ?? '',
        max: 3,
        onnotice: () => {},
      });
      await adminSql.unsafe(RESET_TABLE_DDL);
      appSql = postgres({
        ...cfg,
        user: 'auth_app',
        password: process.env.QA_TEST_PG_AUTH_APP_PASSWORD ?? '',
        max: 3,
        onnotice: () => {},
      });
      registry = new RlsAwarePgResourcePolicyRegistry(appSql);
    });

    afterEach(async () => {
      try {
        await adminSql.unsafe(`DROP TABLE IF EXISTS auth.resource_policies CASCADE`);
      } finally {
        await adminSql.end();
        await appSql.end();
      }
    });

    it('alice 가 소유한 UNREGISTERED 리소스를 bob 이 cross-actor 로 조회 시 0 row', async () => {
      // alice 가 자기 리소스를 create
      await withRlsContext(
        { userId: 'alice', tenantId: null, bitmapMask: setBitBytes(RP_WRITE_BIT), role: null },
        () => registry.create({ resourceId: 'r-alice', resourceType: 'doc', ownerId: 'alice' }),
      );
      // bob 이 alice 의 리소스 listByOwner 호출 — RLS 로 0 row (cross-actor deny)
      const rows = await withRlsContext(
        { userId: 'bob', tenantId: null, bitmapMask: setBitBytes(RP_READ_BIT), role: null },
        () => registry.listByOwner('alice'),
      );
      expect(rows.length).toBe(0);
    });

    it('bob 이 직접 resolve(r-alice) 호출 → null (RLS 로 invisible)', async () => {
      await withRlsContext(
        { userId: 'alice', tenantId: null, bitmapMask: setBitBytes(RP_WRITE_BIT), role: null },
        () => registry.create({ resourceId: 'r-alice', resourceType: 'doc', ownerId: 'alice' }),
      );
      const policy = await withRlsContext(
        { userId: 'bob', tenantId: null, bitmapMask: setBitBytes(RP_READ_BIT), role: null },
        () => registry.resolve('r-alice'),
      );
      expect(policy).toBeNull();
    });

    it("bob 이 대리 create(r-alice, ownerId='alice') 시도 → WITH CHECK 위반 throw", async () => {
      await expect(
        withRlsContext(
          { userId: 'bob', tenantId: null, bitmapMask: setBitBytes(RP_WRITE_BIT), role: null },
          () => registry.create({ resourceId: 'r-forged', resourceType: 'doc', ownerId: 'alice' }),
        ),
      ).rejects.toThrow(/row-level security|row violates/i);
    });

    it('admin bypass (app.role=admin) → alice 리소스 가시', async () => {
      await withRlsContext(
        { userId: 'alice', tenantId: null, bitmapMask: setBitBytes(RP_WRITE_BIT), role: null },
        () => registry.create({ resourceId: 'r-alice', resourceType: 'doc', ownerId: 'alice' }),
      );
      const policy = await withRlsContext(
        { userId: null, tenantId: null, bitmapMask: null, role: 'admin' },
        () => registry.resolve('r-alice'),
      );
      expect(policy?.ownerId).toBe('alice');
    });

    it('FORCE 상태에서 table owner(qa_admin) 도 일반 정책 대상 (BYPASSRLS 없음)', async () => {
      // adminSql (qa_admin) 은 FORCE 에 의해 RLS 적용된다 — INSERT/SELECT 모두 block.
      // 먼저 admin context (app.role='admin') 로 seed → INSERT 통과.
      await adminSql.begin(async (tx) => {
        await tx`SELECT set_config('app.role', 'admin', true)`;
        await tx`INSERT INTO auth.resource_policies (resource_id, resource_type, state, owner_id, updated_at) VALUES ('r-admin', 'doc', 'UNREGISTERED', 'alice', '2026-04-22')`;
      });
      // 이제 admin context 없이 SELECT — qa_admin 은 BYPASSRLS 없으므로 0 row.
      const rows = await adminSql.unsafe(`SELECT * FROM auth.resource_policies`);
      expect(rows.length).toBe(0);
    });
  },
);
