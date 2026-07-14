import { resolve, relative, basename, join } from 'node:path';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import chalk from 'chalk';
import { resolveEndpointsFromDir } from './oa-spec-resolver.js';
import { findImplementations, type ImplementationSite } from './endpoint-mapper.js';

async function main() {
  const isJson = process.argv.includes('--json');
  const root = resolve(process.cwd());
  const specDirs = [
    '/Users/junwoobang/workflow/oa-sdk/packages/schemas/src/domains',
    join(root, 'simulations/enterprise-pm/contracts/openapi/src/domains'),
  ];

  if (!isJson) console.log(chalk.bold(`\n🚀 API Impact Analysis Initializing...`));

  // 1. Resolve Endpoints
  const allEndpoints: any[] = [];
  for (const dir of specDirs) {
    if (!isJson) console.log(`[1] Resolving endpoints from spec directory: ${chalk.dim(dir)}`);
    const endpoints = resolveEndpointsFromDir(dir);
    if (!isJson) console.log(`    Found ${endpoints.length} endpoints in ${basename(dir)}.`);
    allEndpoints.push(...endpoints);
  }
  if (!isJson) console.log(`    Total authoritative endpoints: ${allEndpoints.length}`);

  // 2. Map implementations
  if (!isJson) console.log(`[2] Mapping endpoints to implementation sites in qa-sdk...`);
  const implementationMap = findImplementations(root, allEndpoints);
  if (!isJson)
    console.log(`    Mapped ${implementationMap.size} implementations found in services.`);

  // 3. Get changed files from Git
  if (!isJson) console.log(`[3] Identifying modified files via Git...`);
  let changedFiles: string[] = [];
  try {
    const output = execSync('git diff --name-only HEAD', { encoding: 'utf-8' });
    changedFiles = output.split('\n').filter((f) => f.trim().length > 0);
  } catch (err) {
    if (!isJson) console.warn('⚠️ Git diff failed.');
  }

  if (changedFiles.length === 0) {
    if (isJson) {
      process.stdout.write(JSON.stringify({ affectedApis: [] }));
    } else {
      console.log(chalk.green('✅ No files changed in git. Analysis skipped.'));
    }
    return;
  }

  if (!isJson) console.log(`    Analyzing impact for ${changedFiles.length} files.`);

  // 4. Correlate impact
  if (!isJson) console.log(`[4] Analyzing Impact Radius...\n`);

  const impactReport: any[] = [];

  for (const file of changedFiles) {
    const absPath = resolve(root, file);
    const fileName = basename(file);

    for (const [api, site] of implementationMap.entries()) {
      // A. Direct Controller Change
      if (site.filePath === absPath) {
        impactReport.push({
          file,
          api,
          reason: 'Direct implementation change (Controller)',
          site,
          consumers: getConsumers(api, root),
        });
      }

      // B. Indirect Service/Repo Change
      if (
        file.endsWith('.service.ts') ||
        file.endsWith('.repository.ts') ||
        file.endsWith('.entity.ts')
      ) {
        const className = fileName
          .replace('.ts', '')
          .split('.')
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join('');
        const simplifiedClassName = className.replace(/Service$/, '').replace(/Repository$/, '');

        try {
          const controllerContent = readFileSync(site.filePath, 'utf-8');
          if (controllerContent.includes(simplifiedClassName)) {
            impactReport.push({
              file,
              api,
              reason: `Indirect impact via dependency: ${simplifiedClassName}`,
              site,
              consumers: getConsumers(api, root),
            });
          }
        } catch {
          /* ignore */
        }
      }
    }
  }

  if (isJson) {
    process.stdout.write(JSON.stringify({ affectedApis: impactReport }, null, 2));
    return;
  }

  if (impactReport.length === 0) {
    console.log(chalk.green('✅ No API impact detected from changes.'));
  } else {
    const uniqueReportMap = new Map<string, any>();
    impactReport.forEach((r) => uniqueReportMap.set(`${r.file}->${r.api}`, r));

    console.log(chalk.red(`⚠️ Found ${uniqueReportMap.size} potentially affected API paths:\n`));

    for (const report of uniqueReportMap.values()) {
      console.log(`${chalk.bold('API:')} ${chalk.red(report.api)}`);
      console.log(`├── ${chalk.bold('Reason:')} ${report.reason}`);
      console.log(
        `├── ${chalk.bold('Entry Point:')} ${report.site.className}.${report.site.methodName} (${relative(root, report.site.filePath)}:${report.site.lineNumber})`,
      );
      console.log(`└── ${chalk.bold('Root Cause File:')} ${chalk.yellow(report.file)}`);

      console.log(`    ${chalk.bold('Downstream Consumers (Scenarios/Tests):')}`);
      if (report.consumers.length > 0) {
        report.consumers.forEach((cFile: string) => {
          console.log(`    ➡️  ${chalk.cyan(cFile)}`);
        });
      } else {
        console.log(chalk.dim('    (No direct scenario consumers found)'));
      }
      console.log('');
    }
  }
}

function getConsumers(api: string, root: string): string[] {
  const apiPath = api.split(' ')[1];
  try {
    const grepOutput = execSync(
      `grep -r "${apiPath}" simulations/enterprise-pm/scenarios/src --exclude-dir=node_modules || true`,
      { encoding: 'utf-8' },
    );
    const consumers = grepOutput.split('\n').filter((l) => l.trim().length > 0);
    const uniqueConsumerFiles = new Set<string>();
    consumers.forEach((c) => uniqueConsumerFiles.add(relative(root, c.split(':')[0])));
    return Array.from(uniqueConsumerFiles);
  } catch {
    return [];
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
