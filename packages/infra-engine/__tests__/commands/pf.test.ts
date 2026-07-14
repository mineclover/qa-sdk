import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const originalHome = process.env.HOME;
const tempHomes: string[] = [];

describe('pf commands', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    await Promise.all(tempHomes.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('pf register/list/remove로 ad-hoc dev server를 추적한다', async () => {
    const home = await mkdtemp(join(tmpdir(), 'qa-infra-pf-'));
    tempHomes.push(home);
    process.env.HOME = home;
    vi.resetModules();

    const { pfRegisterHandler, pfListHandler, pfRemoveHandler } =
      await import('../../src/cli/cmd-pf.js');

    await pfRegisterHandler({
      args: {},
      options: {},
      rest: [],
      rawArgs: ['viz-web', '5201', '--service', 'viz-web', '--kind', 'dev-server'],
    });

    const pfPath = join(home, '.qa-sdk', 'infra-pf.json');
    const stored = JSON.parse(await readFile(pfPath, 'utf-8'));
    expect(stored['viz-web']).toEqual(
      expect.objectContaining({
        localPort: 5201,
        service: 'viz-web',
        kind: 'dev-server',
        endpoint: 'http://127.0.0.1:5201',
      }),
    );

    vi.mocked(console.log).mockClear();
    await pfListHandler({ args: {}, options: {}, rest: [], rawArgs: [] });
    const logSpy = console.log as unknown as { mock: { calls: unknown[][] } };
    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).toContain('viz-web');
    expect(output).toContain('5201');
    expect(output).toContain('http://127.0.0.1:5201');

    vi.mocked(console.log).mockClear();
    await pfRemoveHandler({ args: {}, options: {}, rest: [], rawArgs: ['viz-web'] });
    const after = JSON.parse(await readFile(pfPath, 'utf-8'));
    expect(after['viz-web']).toBeUndefined();
  });
});
