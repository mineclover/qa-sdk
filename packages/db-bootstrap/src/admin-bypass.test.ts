import { describe, expect, it } from 'vitest';
import { createAdminBypassConnection } from './admin-bypass.js';

const PG_AVAILABLE = process.env.QA_TEST_PG === '1';
const BYPASS_AVAILABLE = !!process.env.QA_TEST_PG_ADMIN_BYPASS_PASSWORD;

describe.skipIf(!(PG_AVAILABLE && BYPASS_AVAILABLE))('createAdminBypassConnection', () => {
  const cfg = {
    host: process.env.QA_TEST_PG_HOST ?? 'localhost',
    port: Number(process.env.QA_TEST_PG_PORT ?? '5434'),
    database: process.env.QA_TEST_PG_DATABASE ?? 'qa_sdk_test',
    password: process.env.QA_TEST_PG_ADMIN_BYPASS_PASSWORD ?? '',
  };

  it('BYPASSRLS role 로그인 성공', async () => {
    const conn = await createAdminBypassConnection(cfg);
    try {
      const rows = await conn.sql<{ rolname: string; rolbypassrls: boolean }[]>`
        SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = current_user
      `;
      expect(rows[0].rolbypassrls).toBe(true);
      expect(rows[0].rolname).toBe('qa_admin_bypass');
    } finally {
      await conn.close();
    }
  });

  it('잘못된 비밀번호 → reject', async () => {
    await expect(
      createAdminBypassConnection({ ...cfg, password: 'wrong-password' }),
    ).rejects.toThrow();
  });
});
