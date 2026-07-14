// scripts/sim-scale.test.ts
// Plan E Stage 12 Task 12.5 — sim-scale dry-run 단위 테스트.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildSimScale } from './sim-scale.js';

function captureStdout(fn: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  (process.stdout.write as unknown as (s: string) => boolean) = ((s: string) => {
    lines.push(s.replace(/\n$/, ''));
    return true;
  }) as never;
  return fn()
    .finally(() => {
      process.stdout.write = orig;
    })
    .then(() => lines);
}

describe('sim-scale dry-run', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('set --replicas — docker compose --scale args 출력', async () => {
    const lines = await captureStdout(() =>
      buildSimScale().parseAsync([
        'node',
        'sim-scale',
        'set',
        '--service',
        'approval-api-v2',
        '--replicas',
        '5',
        '--reason',
        'test',
        '--dry-run',
      ]),
    );
    const call = JSON.parse(lines[0]);
    expect(call.call).toBe('docker');
    expect(call.args).toEqual(expect.arrayContaining(['compose', '--scale', 'approval-api-v2=5']));
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('set --pin — POST /admin/controller/pin', async () => {
    const lines = await captureStdout(() =>
      buildSimScale().parseAsync([
        'node',
        'sim-scale',
        'set',
        '--service',
        'approval-api-v2',
        '--pin',
        '--reason',
        'test',
        '--dry-run',
      ]),
    );
    expect(JSON.parse(lines[0])).toMatchObject({
      call: 'POST /admin/controller/pin',
      body: expect.objectContaining({ service: 'approval-api-v2' }),
    });
  });

  it('set --unpin — POST /admin/controller/unpin (멱등)', async () => {
    const lines = await captureStdout(() =>
      buildSimScale().parseAsync([
        'node',
        'sim-scale',
        'set',
        '--service',
        'approval-api-v2',
        '--unpin',
        '--reason',
        'test',
        '--dry-run',
      ]),
    );
    expect(JSON.parse(lines[0]).call).toBe('POST /admin/controller/unpin');
  });

  it('set --replicas + --pin 동시 사용은 exit 2', async () => {
    const prev = process.exitCode;
    process.exitCode = 0;
    await buildSimScale().parseAsync([
      'node',
      'sim-scale',
      'set',
      '--service',
      'approval-api-v2',
      '--replicas',
      '5',
      '--pin',
      '--reason',
      'test',
      '--dry-run',
    ]);
    expect(process.exitCode).toBe(2);
    process.exitCode = prev;
  });
});
