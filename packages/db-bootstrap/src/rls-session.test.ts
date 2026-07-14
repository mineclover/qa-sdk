import { describe, expect, it } from 'vitest';
import postgres from 'postgres';
import {
  encodeBitmapHex,
  BitmapTooLargeError,
  createRlsTxRunner,
  MAX_BITMAP_BYTES,
} from './rls-session.js';

describe('encodeBitmapHex — pure', () => {
  it('빈 배열 → 빈 문자열', () => {
    expect(encodeBitmapHex(new Uint8Array())).toBe('');
  });
  it("단일 byte 0x01 → '01'", () => {
    expect(encodeBitmapHex(new Uint8Array([0x01]))).toBe('01');
  });
  it('멀티 byte — big endian lowercase', () => {
    expect(encodeBitmapHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe('deadbeef');
  });
  it('upper limit 준수 → 예외', () => {
    const huge = new Uint8Array(MAX_BITMAP_BYTES + 1);
    expect(() => encodeBitmapHex(huge)).toThrow(BitmapTooLargeError);
  });
});

const PG_AVAILABLE = process.env.QA_TEST_PG === '1';

describe.skipIf(!PG_AVAILABLE)('createRlsTxRunner — PG 통합', () => {
  const sql = postgres({
    host: process.env.QA_TEST_PG_HOST ?? 'localhost',
    port: Number(process.env.QA_TEST_PG_PORT ?? '5434'),
    database: process.env.QA_TEST_PG_DATABASE ?? 'qa_sdk_test',
    user: process.env.QA_TEST_PG_USER ?? 'qa_admin',
    password: process.env.QA_TEST_PG_PASSWORD ?? '',
    max: 3,
    onnotice: () => {},
  });
  const run = createRlsTxRunner(sql);

  it('SET LOCAL 이 fn 내부에서 읽힘', async () => {
    const result = await run(
      { userId: 'alice', tenantId: 'acme', bitmapMask: new Uint8Array([0x01]), role: null },
      async (tx) => {
        const [row] = await tx<{ user_id: string; tenant: string; mask: string }[]>`
          SELECT current_setting('app.user_id', true) AS user_id,
                 current_setting('app.tenant_id', true) AS tenant,
                 current_setting('app.bitmap_mask', true) AS mask`;
        return row;
      },
    );
    expect(result.user_id).toBe('alice');
    expect(result.tenant).toBe('acme');
    expect(result.mask).toBe('01');
  });

  it('트랜잭션 종료 후 GUC 소거 — 다음 트랜잭션은 null', async () => {
    await run(
      { userId: 'bob', tenantId: null, bitmapMask: null, role: null },
      async (tx) => tx`SELECT 1`,
    );
    // 같은 pool connection 재사용 가능성 — 다른 트랜잭션에서 조회
    const [row] = await sql<
      { user_id: string | null }[]
    >`SELECT current_setting('app.user_id', true) AS user_id`;
    expect(row.user_id === null || row.user_id === '').toBe(true);
  });

  it('null 필드는 SET skip — 이전 세션 값 누수 없음', async () => {
    // 첫 트랜잭션: userId='alice'
    await run(
      { userId: 'alice', tenantId: null, bitmapMask: null, role: null },
      async (tx) => tx`SELECT 1`,
    );
    // 두번째 트랜잭션: userId null — SET skip 되지만 이전 트랜잭션 종료 시 자동 clear 로 여전히 null 이어야
    const result = await run(
      { userId: null, tenantId: null, bitmapMask: null, role: null },
      async (tx) => {
        const [row] = await tx<
          { user_id: string | null }[]
        >`SELECT current_setting('app.user_id', true) AS user_id`;
        return row.user_id;
      },
    );
    expect(result === null || result === '').toBe(true);
  });

  it('admin role 주입', async () => {
    const role = await run(
      { userId: null, tenantId: null, bitmapMask: null, role: 'admin' },
      async (tx) => {
        const [row] = await tx<
          { role: string }[]
        >`SELECT current_setting('app.role', true) AS role`;
        return row.role;
      },
    );
    expect(role).toBe('admin');
  });
});
