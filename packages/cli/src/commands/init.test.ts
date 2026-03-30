import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { init } from './init.js';

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('init --vite-consumer', () => {
  it('vite 소비처에 qa-bridge 템플릿과 의존성을 추가한다', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'qa-sdk-init-vite-'));
    createdDirs.push(cwd);

    const pkgDir = join(cwd, 'packages', 'sample-web');
    await mkdir(join(pkgDir, 'src'), { recursive: true });
    await writeFile(
      join(pkgDir, 'package.json'),
      JSON.stringify(
        {
          name: '@qa-sdk/sample-web',
          private: true,
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'vite build',
          },
          devDependencies: {
            vite: '^6.3.5',
          },
        },
        null,
        2,
      ),
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await init({
      cwd,
      viteConsumer: 'packages/sample-web',
      serviceName: 'sample-web',
      ownerId: 'frontend-team',
      buildEnv: 'local',
    });
    const output = logSpy.mock.calls.flat().join('\n');
    logSpy.mockRestore();

    const browserCatalog = await readFile(join(pkgDir, 'src/sdk/browser-catalog.ts'), 'utf-8');
    const bridge = await readFile(join(pkgDir, 'src/sdk/qa-bridge.ts'), 'utf-8');
    const bridgeTest = await readFile(join(pkgDir, 'src/sdk/qa-bridge.test.ts'), 'utf-8');
    const pkgJson = JSON.parse(await readFile(join(pkgDir, 'package.json'), 'utf-8')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(browserCatalog).toContain('LOCAL_BROWSER_CATALOG');
    expect(browserCatalog).toContain('svc_name: "sample-web"');
    expect(bridge).toContain('service_name: "sample-web"');
    expect(bridge).toContain('owner_id: "frontend-team"');
    expect(bridgeTest).toContain('bridge.emitEvent("sdk_smoke_loaded"');
    expect(bridgeTest).toContain('infra_context.service');
    expect(pkgJson.dependencies?.['@qa-sdk/browser-codec']).toBe('workspace:*');
    expect(pkgJson.dependencies?.['@qa-sdk/sdk']).toBe('workspace:*');
    expect(pkgJson.dependencies?.['@qa-sdk/event-catalog']).toBe('workspace:*');
    expect(pkgJson.devDependencies?.vitest).toBe('^1.6.1');
    expect(pkgJson.scripts?.test).toBe('vitest run');
    expect(output).toContain(
      '로컬 browser overlay로는 sample-web 을 service prefix로 바로 증명할 수 있습니다.',
    );
    expect(output).toContain('qa-sdk dkg add-entry svc_name sample-web --apply');
  });

  it('기존 bridge 파일은 force 없이 덮어쓰지 않는다', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'qa-sdk-init-vite-'));
    createdDirs.push(cwd);

    const pkgDir = join(cwd, 'packages', 'existing-web');
    await mkdir(join(pkgDir, 'src/sdk'), { recursive: true });
    await writeFile(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: '@qa-sdk/existing-web', private: true }, null, 2),
    );
    await writeFile(join(pkgDir, 'src/sdk/qa-bridge.ts'), '// keep me\n');

    await init({
      cwd,
      viteConsumer: 'packages/existing-web',
    });

    const bridge = await readFile(join(pkgDir, 'src/sdk/qa-bridge.ts'), 'utf-8');
    expect(bridge).toBe('// keep me\n');
  });

  it('catalog에 있는 서비스는 prefix 증명 가능 메시지를 출력한다', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'qa-sdk-init-vite-'));
    createdDirs.push(cwd);

    const pkgDir = join(cwd, 'packages', 'platform-demo-web');
    await mkdir(join(pkgDir, 'src'), { recursive: true });
    await writeFile(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: '@qa-sdk/platform-demo-web', private: true }, null, 2),
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await init({
      cwd,
      viteConsumer: 'packages/platform-demo-web',
      serviceName: 'platform-demo',
    });
    const output = logSpy.mock.calls.flat().join('\n');
    logSpy.mockRestore();

    expect(output).toContain(
      '현재 demo catalog의 svc_name axis에 platform-demo 이(가) 이미 있습니다.',
    );
  });
});
