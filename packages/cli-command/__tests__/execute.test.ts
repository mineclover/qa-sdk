import { describe, it, expect, vi } from 'vitest';
import { executeCommand } from '../src/execute.js';
import type { CliCommandNode } from '../src/types.js';

describe('executeCommand', () => {
  it('handler 직접 실행', async () => {
    const fn = vi.fn(async () => {});
    const tree: CliCommandNode[] = [{ segment: 'status', handler: fn, args: [{ name: 'env' }] }];

    const ok = await executeCommand(['status', 'dev'], tree);
    expect(ok).toBe(true);
    expect(fn).toHaveBeenCalledOnce();
    expect(fn.mock.calls[0][0].args.env).toBe('dev');
  });

  it('handlerKey + handlers 매핑', async () => {
    const fn = vi.fn(async () => {});
    const tree: CliCommandNode[] = [{ segment: 'deploy', handlerKey: 'do.deploy' }];

    const ok = await executeCommand(['deploy', 'svc'], tree, {
      handlers: { 'do.deploy': fn },
    });
    expect(ok).toBe(true);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('미매칭 → false', async () => {
    const ok = await executeCommand(['unknown'], []);
    expect(ok).toBe(false);
  });

  it('--help가 전달되면 onHelp를 호출한다', async () => {
    const onHelp = vi.fn();
    const tree: CliCommandNode[] = [
      { segment: 'deploy', handler: vi.fn(async () => {}), description: '배포' },
    ];

    const ok = await executeCommand(['deploy', '--help'], tree, { onHelp });
    expect(ok).toBe(true);
    expect(onHelp).toHaveBeenCalledOnce();
    expect(onHelp.mock.calls[0][0]?.segment).toBe('deploy');
  });

  it('매칭되지 않는 명령에 onNotFound가 호출된다', async () => {
    const onNotFound = vi.fn(async () => {});
    const tree: CliCommandNode[] = [{ segment: 'deploy', handler: vi.fn(async () => {}) }];

    const ok = await executeCommand(['unknown-cmd'], tree, { onNotFound });
    expect(ok).toBe(true);
    expect(onNotFound).toHaveBeenCalledWith(['unknown-cmd']);
  });

  it('옵션 파싱', async () => {
    const fn = vi.fn(async () => {});
    const tree: CliCommandNode[] = [
      {
        segment: 'deploy',
        handler: fn,
        args: [{ name: 'service' }],
        options: [
          { flag: '--dry-run', type: 'boolean' },
          { flag: '--provider', type: 'string' },
        ],
      },
    ];

    await executeCommand(['deploy', 'nginx', '--dry-run', '--provider', 'cloudflare'], tree);
    const ctx = fn.mock.calls[0][0];
    expect(ctx.args.service).toBe('nginx');
    expect(ctx.options.dryRun).toBe(true);
    expect(ctx.options.provider).toBe('cloudflare');
  });

  it('필수 인자가 빠지면 reject된다', async () => {
    const tree: CliCommandNode[] = [
      {
        segment: 'deploy',
        handler: vi.fn(async () => {}),
        args: [{ name: 'service', required: true }],
      },
    ];

    await expect(executeCommand(['deploy'], tree)).rejects.toThrow(
      /required argument missing: service/,
    );
  });
});
