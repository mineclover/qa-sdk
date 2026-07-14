// @def.boundary registry-system
// @def.doc registry-system

import { describe, it, expect, vi } from 'vitest';
import {
  runPostActivationHook,
  createPostActivationHook,
  type PostActivationHookConfig,
} from './post-activation-hook.js';

function createMockConfig(overrides?: Partial<PostActivationHookConfig>): PostActivationHookConfig {
  return {
    dkgStore: {
      saveNodes: vi.fn(),
      setMeta: vi.fn(),
    },
    ...overrides,
  };
}

describe('runPostActivationHook', () => {
  it('VersionEventNode 생성 + DKG store 저장', async () => {
    const config = createMockConfig();

    await runPostActivationHook(
      { prefix: 'cart_event', versionId: 'v2', previousVersion: 'v1' },
      config,
    );

    // saveNodes 호출 확인
    expect(config.dkgStore!.saveNodes).toHaveBeenCalledWith(
      [expect.objectContaining({ kind: 'version-event' })],
      [expect.objectContaining({ type: 'evolves', to: 'cart_event' })],
      'auto',
    );

    // meta 업데이트 확인
    expect(config.dkgStore!.setMeta).toHaveBeenCalledWith('last_activation', expect.any(String));
  });

  it("previousVersion=null → 'none' ID 생성", async () => {
    const config = createMockConfig();

    await runPostActivationHook(
      { prefix: 'auth_event', versionId: 'v1', previousVersion: null },
      config,
    );

    expect(config.dkgStore!.saveNodes).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          kind: 'version-event',
          id: 'VE-auth_event-none-v1',
          subjectId: 'auth_event',
          toVersion: 'v1',
        }),
      ],
      expect.any(Array),
      'auto',
    );
  });

  it('dkgStore 없으면 저장 건너뜀 (에러 없음)', async () => {
    const config = createMockConfig({ dkgStore: undefined });

    // 에러 없이 완료되어야 함
    await expect(
      runPostActivationHook({ prefix: 'test', versionId: 'v1', previousVersion: null }, config),
    ).resolves.toBeUndefined();
  });

  it('에러 발생 시 throw하지 않음 (에러 격리)', async () => {
    const config = createMockConfig({
      dkgStore: {
        saveNodes: vi.fn().mockImplementation(() => {
          throw new Error('boom');
        }),
        setMeta: vi.fn(),
      },
    });

    // 에러 없이 완료
    await expect(
      runPostActivationHook({ prefix: 'test', versionId: 'v1', previousVersion: null }, config),
    ).resolves.toBeUndefined();
  });

  it('evolves 엣지가 prefix 노드를 가리킴', async () => {
    const config = createMockConfig();

    await runPostActivationHook(
      { prefix: 'order_event', versionId: 'v3', previousVersion: 'v2' },
      config,
    );

    const saveNodesCall = (config.dkgStore!.saveNodes as any).mock.calls[0];
    const edges = saveNodesCall[1];

    expect(edges).toEqual([
      expect.objectContaining({ type: 'evolves', from: expect.any(String), to: 'order_event' }),
    ]);
  });
});

describe('createPostActivationHook', () => {
  it('run() 메서드를 제공하는 객체 반환', async () => {
    const config = createMockConfig();
    const hook = createPostActivationHook(config);

    expect(hook).toHaveProperty('run');
    expect(typeof hook.run).toBe('function');

    await hook.run({ prefix: 'test', versionId: 'v1', previousVersion: null });

    expect(config.dkgStore!.saveNodes).toHaveBeenCalled();
  });
});
