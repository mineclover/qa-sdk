// @def.boundary sim-scenarios

import { describe, expect, it } from 'vitest';
import { createComposeHandle, type ExecLike, type FetchLike } from './compose-handle.js';

describe('compose-handle', () => {
  it('controllerUrl 있으면 HTTP로 v1/v2 replica 조회', async () => {
    const fetchImpl: FetchLike = async (url) => {
      expect(url).toContain('/admin/compose/replicas');
      return {
        ok: true,
        status: 200,
        async text() {
          return '';
        },
        async json() {
          return { v1: 2, v2: 1 };
        },
      };
    };
    const h = createComposeHandle({
      controllerUrl: 'http://ctrl',
      fetchImpl,
    });
    const r = await h.getReplicas();
    expect(r).toEqual({ v1: 2, v2: 1 });
  });

  it('controllerUrl 없으면 CLI fallback — docker compose ps json line 파싱', async () => {
    const execImpl: ExecLike = async (cmd, args) => {
      expect(cmd).toBe('docker');
      expect(args.slice(0, 2)).toEqual(['compose', 'ps']);
      return {
        stdout: [
          JSON.stringify({ Service: 'approval-api-v1', State: 'running' }),
          JSON.stringify({ Service: 'approval-api-v1', State: 'running' }),
          JSON.stringify({ Service: 'approval-api-v2', State: 'running' }),
          JSON.stringify({ Service: 'approval-api-v2', State: 'exited' }),
        ].join('\n'),
        stderr: '',
        exitCode: 0,
      };
    };
    const h = createComposeHandle({ execImpl });
    const r = await h.getReplicas();
    expect(r).toEqual({ v1: 2, v2: 1 });
  });

  it('CLI JSON array 출력도 파싱', async () => {
    const execImpl: ExecLike = async () => ({
      stdout: JSON.stringify([
        { Service: 'approval-api-v1', State: 'running' },
        { Service: 'approval-api-v2', State: 'running' },
        { Service: 'approval-api-v2', State: 'running' },
      ]),
      stderr: '',
      exitCode: 0,
    });
    const h = createComposeHandle({ execImpl });
    const r = await h.getReplicas();
    expect(r).toEqual({ v1: 1, v2: 2 });
  });

  it('controllerUrl + execImpl 둘 다 없으면 throw on call', async () => {
    const h = createComposeHandle({});
    await expect(h.getReplicas()).rejects.toThrow(/execImpl required/);
  });

  it('CLI exitCode != 0이면 throw', async () => {
    const execImpl: ExecLike = async () => ({
      stdout: '',
      stderr: 'no daemon',
      exitCode: 1,
    });
    const h = createComposeHandle({ execImpl });
    await expect(h.getReplicas()).rejects.toThrow(/docker ps failed/);
  });

  it('HTTP non-2xx에 throw', async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: false,
      status: 502,
      async text() {
        return 'boom';
      },
      async json() {
        return {};
      },
    });
    const h = createComposeHandle({
      controllerUrl: 'http://x',
      fetchImpl,
    });
    await expect(h.getReplicas()).rejects.toThrow(/status=502/);
  });
});
