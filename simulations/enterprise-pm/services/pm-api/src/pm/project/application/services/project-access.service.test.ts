import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import type { AccessChecker, AccessResult, AccessContext, ApiCall } from 'permission-engine';
import { ProjectAccessService } from './project-access.service.js';
import { PROJECT_ACCESS_CHECKER } from '../../../../auth-deps/access-checker.module.js';

function fakeChecker(result: AccessResult, capture?: (ctx: AccessContext, call: ApiCall) => void) {
  return {
    check: async (ctx: AccessContext, call: ApiCall) => {
      capture?.(ctx, call);
      return result;
    },
  } as unknown as AccessChecker;
}

describe('ProjectAccessService', () => {
  const user = {
    userId: 'alice',
    bitmapMask: new Uint8Array([0xff, 0xff]),
    bitmapVersion: 'uv1',
  };

  async function withChecker(
    result: AccessResult,
    capture?: (ctx: AccessContext, call: ApiCall) => void,
  ) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectAccessService,
        { provide: PROJECT_ACCESS_CHECKER, useValue: fakeChecker(result, capture) },
      ],
    }).compile();
    return moduleRef.get(ProjectAccessService);
  }

  it('allow → rootSpanId 반환', async () => {
    const svc = await withChecker({ allowed: true, executionSpanId: 'root-1' });
    const res = await svc.check({
      apiId: 'project.read',
      user,
      targetId: 'p-1',
      resourceOwnerId: 'alice',
      departmentId: 'dept-eng',
    });
    expect(res.allow).toBe(true);
    expect(res.rootSpanId).toBe('root-1');
  });

  it('deny + denyReason 포함', async () => {
    const svc = await withChecker({
      allowed: false,
      denyReason: 'not_in_scope',
      executionSpanId: 'root-2',
    });
    const res = await svc.check({
      apiId: 'project.read',
      user,
      targetId: 'p-1',
      resourceOwnerId: 'bob',
      departmentId: 'dept-mkt',
    });
    expect(res.allow).toBe(false);
    expect(res.denyReason).toBe('not_in_scope');
    expect(res.rootSpanId).toBe('root-2');
  });

  it('targetId=null + resourceOwnerId=null → transaction kind 로 호출', async () => {
    let capturedCall: ApiCall | undefined;
    const svc = await withChecker({ allowed: true, executionSpanId: 'root-3' }, (_ctx, call) => {
      capturedCall = call;
    });
    await svc.check({
      apiId: 'project.create',
      user,
      targetId: null,
      departmentId: 'dept-eng',
    });
    expect(capturedCall?.kind).toBe('transaction');
  });
});
