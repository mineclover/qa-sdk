// @def.boundary docs-control-plane
// @def.doc docs-control-plane

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

describe('init --nest-service', () => {
  it('nest 서비스 템플릿과 공용 패키지 의존성을 생성한다', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'qa-sdk-init-nest-'));
    createdDirs.push(cwd);

    await init({
      cwd,
      nestService: 'packages/sample-service',
      serviceName: 'sample-service',
      ownerId: 'sample-service-system',
    });

    const pkgDir = join(cwd, 'packages', 'sample-service');
    const packageJson = JSON.parse(await readFile(join(pkgDir, 'package.json'), 'utf-8')) as {
      name: string;
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    const main = await readFile(join(pkgDir, 'src/main.ts'), 'utf-8');
    const appModule = await readFile(join(pkgDir, 'src/app.module.ts'), 'utf-8');
    const env = await readFile(join(pkgDir, 'src/config/env.ts'), 'utf-8');
    const port = await readFile(
      join(pkgDir, 'src/domains/example/api/project-query.port.ts'),
      'utf-8',
    );
    const service = await readFile(
      join(pkgDir, 'src/domains/example/application/assign-manager.service.ts'),
      'utf-8',
    );
    const moduleFile = await readFile(
      join(pkgDir, 'src/domains/example/infrastructure/example.module.ts'),
      'utf-8',
    );

    expect(packageJson.name).toBe('@qa-sdk/sample-service');
    expect(packageJson.dependencies?.['@qa-sdk/nest-service-kit']).toBe('workspace:*');
    expect(packageJson.dependencies?.['@qa-sdk/otel']).toBe('workspace:*');
    expect(packageJson.dependencies?.['db-bootstrap']).toBe('workspace:*');
    expect(packageJson.scripts?.build).toBe('tsc');
    expect(main).toContain('bootstrapNestService');
    expect(main).toContain('telemetryEnv: env');
    expect(main).toContain('serviceName: "sample-service"');
    expect(appModule).toContain('ExampleModule');
    expect(env).toContain('dbEnvSchema');
    expect(env).toContain('otelEnvSchema');
    expect(port).toContain('abstract class ProjectQueryPort');
    expect(service).toContain('EventPublisherPort');
    expect(service).toContain('createEventEnvelope');
    expect(moduleFile).toContain('NoopEventPublisher');
  });

  it('중첩 경로에도 workspace root 기준 tsconfig 경로를 생성한다', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'qa-sdk-init-nest-'));
    createdDirs.push(cwd);

    await init({
      cwd,
      nestService: 'services/backend/sample-service',
    });

    const tsconfig = await readFile(
      join(cwd, 'services/backend/sample-service/tsconfig.json'),
      'utf-8',
    );
    const packageJson = JSON.parse(
      await readFile(join(cwd, 'services/backend/sample-service/package.json'), 'utf-8'),
    ) as { name: string };

    expect(tsconfig).toContain('"extends": "../../../tsconfig.json"');
    expect(packageJson.name).toBe('@qa-sdk/sample-service');
  });
});
