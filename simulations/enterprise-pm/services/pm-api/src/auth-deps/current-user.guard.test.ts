import { describe, expect, it } from 'vitest';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { CurrentUserGuard } from './current-user.guard.js';

function ctxWith(headers: Record<string, string>): {
  ctx: ExecutionContext;
  req: { headers: Record<string, string>; currentUser?: unknown };
} {
  const req: { headers: Record<string, string>; currentUser?: unknown } = { headers };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { ctx, req };
}

describe('CurrentUserGuard', () => {
  const guard = new CurrentUserGuard();
  const validMask = Buffer.from([0xff, 0x00, 0xff]).toString('base64');

  it('모든 헤더 존재 → true + currentUser 주입', () => {
    const { ctx, req } = ctxWith({
      'x-auth-user-id': 'alice',
      'x-auth-bitmap-mask': validMask,
      'x-auth-bitmap-v': 'uv1',
    });
    expect(guard.canActivate(ctx)).toBe(true);
    expect(req.currentUser).toMatchObject({ userId: 'alice', bitmapVersion: 'uv1' });
    expect((req.currentUser as { bitmapMask: Uint8Array }).bitmapMask.byteLength).toBe(3);
  });

  it('user-id 누락 → 401', () => {
    const { ctx } = ctxWith({ 'x-auth-bitmap-mask': validMask, 'x-auth-bitmap-v': 'uv1' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('mask 누락 → 401', () => {
    const { ctx } = ctxWith({ 'x-auth-user-id': 'alice', 'x-auth-bitmap-v': 'uv1' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('mask empty (빈 base64) → 401', () => {
    const { ctx } = ctxWith({
      'x-auth-user-id': 'alice',
      'x-auth-bitmap-mask': '',
      'x-auth-bitmap-v': 'uv1',
    });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
