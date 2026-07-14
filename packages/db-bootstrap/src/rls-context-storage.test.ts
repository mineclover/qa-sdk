import { describe, expect, it } from 'vitest';
import { withRlsContext, getCurrentRlsContext } from './rls-context-storage.js';
import { EMPTY_RLS_CONTEXT } from './rls-session.js';

describe('rls-context-storage', () => {
  it('bind 없으면 EMPTY', () => {
    expect(getCurrentRlsContext()).toBe(EMPTY_RLS_CONTEXT);
  });

  it('bind 후 조회', async () => {
    await withRlsContext(
      { userId: 'alice', tenantId: 'acme', bitmapMask: null, role: null },
      async () => {
        const ctx = getCurrentRlsContext();
        expect(ctx.userId).toBe('alice');
      },
    );
    // 외부는 다시 EMPTY
    expect(getCurrentRlsContext().userId).toBeNull();
  });

  it('동시 다중 bind 격리', async () => {
    const results: string[] = [];
    await Promise.all([
      withRlsContext(
        { userId: 'alice', tenantId: null, bitmapMask: null, role: null },
        async () => {
          await new Promise((r) => setTimeout(r, 5));
          results.push(getCurrentRlsContext().userId ?? 'null');
        },
      ),
      withRlsContext({ userId: 'bob', tenantId: null, bitmapMask: null, role: null }, async () => {
        await new Promise((r) => setTimeout(r, 1));
        results.push(getCurrentRlsContext().userId ?? 'null');
      }),
    ]);
    expect(results.toSorted()).toEqual(['alice', 'bob']);
  });
});
