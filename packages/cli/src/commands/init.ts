// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * qa-sdk init — 새 카탈로그 프로젝트 / 소비처 / Nest 서비스 스캐폴딩.
 *
 * Usage:
 *   qa-sdk init                      인터랙티브 프롬프트
 *   qa-sdk init --from demo          데모 카탈로그 복사 후 커스터마이징
 */

import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import {
  generateCatalogTs,
  generateDkgConfigTs,
  generateConfigTs,
  type CatalogTemplateInput,
} from '../templates/catalog-template.js';
import {
  generateViteBrowserCatalogTs,
  generateViteQaBridgeTestTs,
  generateViteQaBridgeTs,
} from '../templates/vite-sdk-template.js';
import {
  generateNestServiceAppModuleTs,
  generateNestServiceEnvTs,
  generateNestServiceExampleModuleTs,
  generateNestServiceExamplePortTs,
  generateNestServiceExampleServiceTs,
  generateNestServiceHealthControllerTs,
  generateNestServiceHealthModuleTs,
  generateNestServiceMainTs,
  generateNestServicePackageJson,
  generateNestServiceReadme,
  generateNestServiceTsconfig,
  generateNestServiceVitestConfig,
} from '../templates/nest-service-template.js';

export interface InitOptions {
  readonly from?: string;
  readonly viteConsumer?: string;
  readonly nestService?: string;
  readonly serviceName?: string;
  readonly ownerId?: string;
  readonly buildEnv?: string;
  readonly force?: boolean;
  readonly cwd?: string;
}

export async function init(options: InitOptions): Promise<void> {
  if (options.viteConsumer) {
    return initViteConsumer(options);
  }
  if (options.nestService) {
    return initNestService(options);
  }

  if (options.from === 'demo') {
    return initFromDemo();
  }

  return initInteractive();
}

type AxisTemplateInput = NonNullable<CatalogTemplateInput['axes']>[number];
type PrefixTemplateInput = NonNullable<CatalogTemplateInput['prefixes']>[number];

interface PackageJsonShape {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

// ── Vite 소비처 초기화 ───────────────────────────────

async function initViteConsumer(options: InitOptions): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const targetDir = resolve(cwd, options.viteConsumer ?? '.');
  const packageJsonPath = resolve(targetDir, 'package.json');

  if (!existsSync(targetDir)) {
    throw new Error(`Vite 소비처 경로가 없습니다: ${options.viteConsumer}`);
  }
  if (!existsSync(packageJsonPath)) {
    throw new Error(`package.json이 없습니다: ${packageJsonPath}`);
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as PackageJsonShape;
  const packageName = packageJson.name ?? basename(targetDir);
  const serviceName = options.serviceName ?? inferServiceName(packageName);
  const ownerId = options.ownerId ?? 'qa-sdk';
  const buildEnv = options.buildEnv ?? 'local';
  const serviceInCatalog = await isKnownDemoService(serviceName);

  const bridgePath = resolve(targetDir, 'src/sdk/qa-bridge.ts');
  const bridgeTestPath = resolve(targetDir, 'src/sdk/qa-bridge.test.ts');
  const browserCatalogPath = resolve(targetDir, 'src/sdk/browser-catalog.ts');

  writeScaffoldFile(
    browserCatalogPath,
    generateViteBrowserCatalogTs({ serviceName, ownerId, buildEnv }),
    options.force ?? false,
  );
  writeScaffoldFile(
    bridgePath,
    generateViteQaBridgeTs({ serviceName, ownerId, buildEnv }),
    options.force ?? false,
  );
  writeScaffoldFile(
    bridgeTestPath,
    generateViteQaBridgeTestTs({ serviceName, ownerId, buildEnv }),
    options.force ?? false,
  );

  const nextPackageJson = ensureViteConsumerPackageJson(packageJson);
  writeFileSync(packageJsonPath, `${JSON.stringify(nextPackageJson, null, 2)}\n`, 'utf-8');
  console.log(`✓ ${relativeToCwd(packageJsonPath)}`);

  printViteConsumerNextSteps({
    packageDir: options.viteConsumer ?? relativeToCwd(targetDir),
    packageName,
    serviceName,
    serviceInCatalog,
  });
}

// ── Nest 서비스 초기화 ────────────────────────────────

async function initNestService(options: InitOptions): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const targetDir = resolve(cwd, options.nestService ?? '.');
  const packageName = inferNestPackageName(options.nestService ?? basename(targetDir));
  const serviceName = options.serviceName ?? inferServiceName(packageName);
  const ownerSystem = options.ownerId ?? `${serviceName}-system`;
  const tsconfigExtendsPath = toPosixRelativePath(relative(targetDir, resolve(cwd, 'tsconfig.json')));

  const files = [
    { path: resolve(targetDir, 'package.json'), content: generateNestServicePackageJson({ packageName, serviceName, ownerSystem, port: 4400 }) },
    { path: resolve(targetDir, 'tsconfig.json'), content: generateNestServiceTsconfig(tsconfigExtendsPath) },
    { path: resolve(targetDir, 'vitest.config.ts'), content: generateNestServiceVitestConfig() },
    { path: resolve(targetDir, 'README.md'), content: generateNestServiceReadme({ packageName, serviceName, ownerSystem, port: 4400 }) },
    { path: resolve(targetDir, 'src/config/env.ts'), content: generateNestServiceEnvTs({ packageName, serviceName, ownerSystem, port: 4400 }) },
    { path: resolve(targetDir, 'src/app.module.ts'), content: generateNestServiceAppModuleTs({ packageName, serviceName, ownerSystem, port: 4400 }) },
    { path: resolve(targetDir, 'src/main.ts'), content: generateNestServiceMainTs({ packageName, serviceName, ownerSystem, port: 4400 }) },
    { path: resolve(targetDir, 'src/health/health.controller.ts'), content: generateNestServiceHealthControllerTs({ packageName, serviceName, ownerSystem, port: 4400 }) },
    { path: resolve(targetDir, 'src/health/health.module.ts'), content: generateNestServiceHealthModuleTs() },
    { path: resolve(targetDir, 'src/domains/example/api/project-query.port.ts'), content: generateNestServiceExamplePortTs() },
    { path: resolve(targetDir, 'src/domains/example/application/assign-manager.service.ts'), content: generateNestServiceExampleServiceTs({ packageName, serviceName, ownerSystem, port: 4400 }) },
    { path: resolve(targetDir, 'src/domains/example/infrastructure/example.module.ts'), content: generateNestServiceExampleModuleTs() },
  ];

  for (const file of files) {
    writeScaffoldFile(file.path, file.content, options.force ?? false);
  }

  printNestServiceNextSteps({
    packageDir: options.nestService ?? relativeToCwd(targetDir),
    packageName,
    serviceName,
    ownerSystem,
  });
}

// ── 데모 기반 초기화 ─────────────────────────────────

async function initFromDemo(): Promise<void> {
  const cwd = process.cwd();

  let catalogJson: string;
  try {
    const { DEMO_CATALOG } = await import('demo-snapshot');
    catalogJson = JSON.stringify(DEMO_CATALOG, null, 2);
  } catch {
    console.error(
      'demo-snapshot 패키지를 로드할 수 없습니다. pnpm add demo-snapshot 을 실행하세요.',
    );
    process.exit(1);
  }

  // JSON 카탈로그 (jiti/tsx 불필요) + TS 래퍼 (타입 안전)
  const files = [
    { path: 'my-project.catalog.json', content: catalogJson },
    {
      path: 'my-project.catalog.ts',
      content: `/**
 * 데모 카탈로그 TS 래퍼.
 * JSON을 수정하거나, 이 파일에서 프로그래밍 방식으로 확장하세요.
 * codegen은 JSON을 직접 사용: qa-sdk codegen --catalog my-project.catalog.json
 */
import catalog from "./my-project.catalog.json" with { type: "json" };
export default catalog;
`,
    },
    { path: 'qa-sdk.config.ts', content: generateConfigTs('my-project.catalog.json') },
  ];

  for (const file of files) {
    const fullPath = resolve(cwd, file.path);
    if (existsSync(fullPath)) {
      console.log(`⏭ ${file.path} — 이미 존재합니다`);
      continue;
    }
    writeFileSync(fullPath, file.content, 'utf-8');
    console.log(`✓ ${file.path}`);
  }

  printNextSteps('my-project.catalog.json');
}

// ── 인터랙티브 초기화 ────────────────────────────────

async function initInteractive(): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question: string): Promise<string> =>
    new Promise((res) => rl.question(question, res));

  try {
    console.log('qa-sdk init — 새 카탈로그 프로젝트\n');

    // 카탈로그 이름
    const name = (await ask('카탈로그 이름 (예: logistics): ')).trim() || 'my-project';
    const id = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

    // 첫 번째 축
    const axisInput = (
      await ask('첫 번째 축 (이름:항목1,항목2,... 예: warehouse:tokyo,osaka,nagoya): ')
    ).trim();
    const axes: AxisTemplateInput[] = [];
    if (axisInput) {
      const [axisName, entriesStr] = axisInput.split(':');
      const entries =
        entriesStr
          ?.split(',')
          .map((e) => e.trim())
          .filter(Boolean) ?? [];
      if (axisName && entries.length > 0) {
        axes.push({ id: axisName.trim(), name: axisName.trim(), entries });
      }
    }

    // 추가 축
    let addMore = true;
    while (addMore) {
      const more = (await ask('축 추가? (이름:항목1,항목2,... 또는 Enter로 완료): ')).trim();
      if (!more) {
        addMore = false;
      } else {
        const [axisName, entriesStr] = more.split(':');
        const entries =
          entriesStr
            ?.split(',')
            .map((e) => e.trim())
            .filter(Boolean) ?? [];
        if (axisName && entries.length > 0) {
          axes.push({ id: axisName.trim(), name: axisName.trim(), entries });
        }
      }
    }

    // 첫 번째 prefix
    const prefixInput = (
      await ask(
        `첫 번째 prefix (이름:축1,축2,... 예: shipment:${axes.map((a) => a.id).join(',')}): `,
      )
    ).trim();
    const prefixes: PrefixTemplateInput[] = [];
    if (prefixInput) {
      const [prefixName, dimsStr] = prefixInput.split(':');
      const dims =
        dimsStr
          ?.split(',')
          .map((d) => d.trim())
          .filter(Boolean) ?? [];
      if (prefixName && dims.length > 0) {
        prefixes.push({ id: prefixName.trim(), name: prefixName.trim(), dims });
      }
    }

    rl.close();

    // 파일 생성
    const cwd = process.cwd();
    const catalogFileName = `${id}.catalog.ts`;
    const dkgConfigFileName = `${id}.dkg-config.ts`;

    const input: CatalogTemplateInput = { id, name, axes, prefixes };

    const files = [
      { path: catalogFileName, content: generateCatalogTs(input) },
      { path: dkgConfigFileName, content: generateDkgConfigTs(input) },
      { path: 'qa-sdk.config.ts', content: generateConfigTs(catalogFileName) },
    ];

    console.log('\n생성할 파일:');
    for (const file of files) {
      const fullPath = resolve(cwd, file.path);
      if (existsSync(fullPath)) {
        console.log(`⏭ ${file.path} — 이미 존재합니다`);
        continue;
      }
      writeFileSync(fullPath, file.content, 'utf-8');
      console.log(`✓ ${file.path}`);
    }

    printNextSteps(catalogFileName);
  } catch (err) {
    rl.close();
    throw err;
  }
}

// ── 다음 단계 안내 ──────────────────────────────────────

function printNextSteps(catalogFile: string) {
  console.log(`
✅ 프로젝트 초기화 완료

═══ 다음 단계 ═══

  1. 타입 생성 (codegen)
     $ qa-sdk codegen --output ./generated

  2. SDK 사용 (Node.js)
     import { sdk, GENERATION } from "./generated";
     const addr = sdk.encode("permission", { role: "admin" });
     const dims = sdk.decode("permission", addr);

  3. 브라우저 SDK (qa-browser-sdk.js)
     import { createQaMonitor } from './qa-browser-sdk.js';
     const monitor = createQaMonitor({
       ingestUrl: "http://localhost:3200",
       serviceConfig: { namespace: "shop", name: "my-web", env: "dev", region: "asia" },
     });
     monitor.emitWithCoords('page.home', {
       page_view: { page: 'home', locale: 'ko', userType: 'member' },
     });

  4. 레지스트리 연동 (선택)
     import { createRegistryConfigClient } from "@qa-sdk/registry-client";
     const registry = createRegistryConfigClient({
       registryUrl: "http://localhost:3300",
       env: "dev",
     });
     const urls = await registry.fetchServiceUrls();

  5. DKG 탐색
     $ qa-sdk dkg report
     $ qa-sdk dkg axes
     $ qa-sdk dkg prefixes

═══════════════════

  카탈로그: ${catalogFile}
  설정:     qa-sdk.config.ts
  문서:     https://github.com/anthropics/qa-sdk
`);
}

function inferServiceName(packageName: string): string {
  if (packageName.startsWith('@')) {
    const [, scopedName] = packageName.split('/');
    return scopedName || packageName;
  }
  return packageName;
}

function inferNestPackageName(target: string): string {
  const normalized = target.replace(/\/+$/, '');
  const base = inferServiceName(basename(normalized));
  return base.startsWith('@') ? base : `@qa-sdk/${base}`;
}

function toPosixRelativePath(value: string): string {
  return value.split('\\').join('/');
}

function writeScaffoldFile(path: string, content: string, force: boolean): void {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path) && !force) {
    console.log(`⏭ ${relativeToCwd(path)} — 이미 존재합니다 (--force로 덮어쓰기)`);
    return;
  }
  writeFileSync(path, content, 'utf-8');
  console.log(`✓ ${relativeToCwd(path)}`);
}

function ensureViteConsumerPackageJson(pkg: PackageJsonShape): PackageJsonShape {
  return {
    ...pkg,
    scripts: {
      ...pkg.scripts,
      ...(pkg.scripts?.test ? {} : { test: 'vitest run' }),
    },
    dependencies: {
      ...pkg.dependencies,
      '@qa-sdk/browser-codec': pkg.dependencies?.['@qa-sdk/browser-codec'] ?? 'workspace:*',
      '@qa-sdk/sdk': pkg.dependencies?.['@qa-sdk/sdk'] ?? 'workspace:*',
      '@qa-sdk/event-catalog': pkg.dependencies?.['@qa-sdk/event-catalog'] ?? 'workspace:*',
    },
    devDependencies: {
      ...pkg.devDependencies,
      vitest: pkg.devDependencies?.vitest ?? '^1.6.1',
    },
  };
}

function relativeToCwd(path: string): string {
  return path.startsWith(`${process.cwd()}/`) ? path.slice(process.cwd().length + 1) : path;
}

function printViteConsumerNextSteps(input: {
  readonly packageDir: string;
  readonly packageName: string;
  readonly serviceName: string;
  readonly serviceInCatalog: boolean;
}): void {
  const catalogAdvice = input.serviceInCatalog
    ? `  4. catalog 등록 확인
     - ✓ 현재 demo catalog의 svc_name axis에 ${input.serviceName} 이(가) 이미 있습니다.
     - serviceConfig를 넣으면 infra_context.service decode 검증까지 바로 수행할 수 있습니다.`
    : `  4. catalog 등록 확인
     - 로컬 browser overlay로는 ${input.serviceName} 을 service prefix로 바로 증명할 수 있습니다.
     - 다만 shared catalog/registry에서도 같은 서비스명을 canonical하게 decode해야 한다면
       qa-sdk dkg add-entry svc_name ${input.serviceName} --apply
     - 현재 demo 카탈로그 TS 자동 갱신은 지원하지 않으므로 별도 카탈로그/쓰기 경로 전략을 함께 검토`;

  console.log(`
✅ Vite 소비처 템플릿 적용 완료

═══ 다음 단계 ═══

  1. 앱 코드에서 bridge 연결
     import { createQaBridge } from "./src/sdk/qa-bridge";
     const bridge = createQaBridge({ ingestUrl: "http://localhost:3200" });

  2. smoke 검증
     - NoopTransport로 startSession → emitEvent → shutdown 연결
     - getDebugEnvelopes()로 event/session 생성 확인
     - src/sdk/browser-catalog.ts + serviceConfig로 infra_context.service를 decode

  3. 기본 검증
     $ pnpm --filter ${input.packageName} test
     $ pnpm --filter ${input.packageName} build

${catalogAdvice}

  5. 관련 문서
     - docs/guides/sdk-usage-guide.md
     - docs/guides/sdk-vite-onboarding-guide.md
     - docs/specs/platform-chain/platform-sdk-user-scenarios.spec.md

═══════════════════

  소비처 경로: ${input.packageDir}
  패키지명:   ${input.packageName}
  서비스명:   ${input.serviceName}
`);
}

function printNestServiceNextSteps(input: {
  readonly packageDir: string;
  readonly packageName: string;
  readonly serviceName: string;
  readonly ownerSystem: string;
}): void {
  console.log(`
✅ Nest 서비스 템플릿 적용 완료

═══ 다음 단계 ═══

  1. service system 문서 생성
     - ${input.ownerSystem}.spec.md
     - ${input.ownerSystem}.cases.md
     - ${input.ownerSystem}.test.md
     - ${input.ownerSystem}.rule.md

  2. 기본 검증
     $ pnpm --filter ${input.packageName} typecheck
     $ pnpm --filter ${input.packageName} test

  3. 실제 도메인 wiring
     - src/domains/example 를 실제 bounded context 이름으로 교체
     - ProjectQueryPort, EventPublisherPort 구현체를 실제 adapter로 교체
     - NoopEventPublisher를 Outbox/Kafka adapter로 교체

  4. 문서 연결
     - qa-sdk def find-by-file ${input.packageDir}/src/main.ts
     - qa-sdk docs closure ${input.ownerSystem}

═══════════════════

  경로:         ${input.packageDir}
  패키지명:     ${input.packageName}
  서비스명:     ${input.serviceName}
  owner_system: ${input.ownerSystem}
`);
}

async function isKnownDemoService(serviceName: string): Promise<boolean> {
  try {
    const { DEMO_SVCS } = await import('demo-snapshot');
    return Array.isArray(DEMO_SVCS) && DEMO_SVCS.includes(serviceName);
  } catch {
    return false;
  }
}
