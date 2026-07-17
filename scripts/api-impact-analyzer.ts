import { resolve, relative, basename } from 'node:path';
import { existsSync } from 'node:fs';
import chalk from 'chalk';
import { resolveEndpointsFromDir, type Endpoint } from './oa-spec-resolver.js';
import {
  findImplementationFiles,
  findImplementations,
  type ImplementationSite,
} from './endpoint-mapper.js';
import { resolveSourceProfiles, type ApiImpactSourceProfile } from './api-impact-sources.js';
import { collectImpactFindings } from './api-impact-collector.js';
import { buildDependencyGraph, type AstFileCache } from './api-impact-ast.js';
import { collectChangedFiles, collectChangedSymbols } from './api-impact-diff.js';
import { findConsumerMatches, type ConsumerMatch } from './api-impact-consumers.js';
import {
  evaluateImpactPolicy,
  readBaselineKeys,
  type ImpactPolicyOptions,
  type ImpactPolicyResult,
} from './api-impact-policy.js';

async function main(): Promise<number> {
  const options = parseImpactCliOptions(process.argv.slice(2));
  const isJson = options.format === 'json';
  const root = resolve(process.cwd());
  const profiles = resolveSourceProfiles(root);

  if (!isJson) console.log(chalk.bold(`\n🚀 API Impact Analysis Initializing...`));

  // 1. Get changed files from Git
  if (!isJson) console.log(`[1] Identifying modified source files via Git...`);
  const changedFiles = collectChangedFiles(root);

  if (changedFiles.length === 0) {
    if (isJson) {
      process.stdout.write(
        JSON.stringify({
          affectedApis: [],
          summary: {
            total: 0,
            visible: 0,
            confidenceExcluded: 0,
            baselineExcluded: 0,
            advisory: 0,
            reviewRequired: 0,
            gateBlocking: 0,
          },
          policy: {
            format: options.format,
            minimumConfidence: options.minimumConfidence ?? null,
            strict: options.strict,
            baseline: options.baselinePath ?? null,
          },
        }),
      );
    } else {
      console.log(chalk.green('✅ No files changed in git. Analysis skipped.'));
    }
    return 0;
  }

  if (!isJson) console.log(`    Analyzing API-relevant changes for ${changedFiles.length} files.`);

  if (!isJson) console.log(`[2] Resolving endpoint profiles and implementation sites...`);

  let baselineKeys: ReadonlySet<string> | undefined;
  if (options.baselinePath) baselineKeys = readBaselineKeys(resolve(root, options.baselinePath));
  const policy = analyzeApiImpact(root, profiles, changedFiles, {
    minimumConfidence: options.minimumConfidence,
    strict: options.strict,
    baselineKeys,
    onProgress: isJson
      ? undefined
      : (event) => {
          if (event.stage === 'profile') console.log(`    ${event.message}`);
          if (event.stage === 'graph') console.log(`[3] ${event.message}`);
          if (event.stage === 'symbols') console.log(`    ${event.message}`);
          if (event.stage === 'impact') console.log(`[4] ${event.message}\n`);
        },
  });

  if (isJson) {
    process.stdout.write(
      JSON.stringify(
        {
          affectedApis: policy.findings,
          summary: policy.summary,
          policy: {
            format: options.format,
            minimumConfidence: options.minimumConfidence ?? null,
            strict: options.strict,
            baseline: options.baselinePath ?? null,
          },
        },
        null,
        2,
      ),
    );
    return policy.summary.gateBlocking > 0 ? 1 : 0;
  }

  if (policy.findings.length === 0) {
    console.log(chalk.green('✅ No API impact detected from changes.'));
  } else {
    const uniqueReportMap = new Map<string, (typeof policy.findings)[number]>();
    policy.findings.forEach((r) =>
      uniqueReportMap.set(`${r.serviceId}:${r.changedFile}->${r.api}`, r),
    );

    console.log(chalk.red(`⚠️ Found ${uniqueReportMap.size} potentially affected API paths:\n`));

    for (const report of uniqueReportMap.values()) {
      console.log(`${chalk.bold('API:')} ${chalk.red(`${report.serviceId} ${report.api}`)}`);
      console.log(`├── ${chalk.bold('Confidence:')} ${report.confidence} (${report.status})`);
      console.log(`├── ${chalk.bold('Reason:')} ${report.reason}`);
      console.log(
        `├── ${chalk.bold('Entry Point:')} ${report.entryPoint.className}.${report.entryPoint.methodName} (${relative(root, report.entryPoint.filePath)}:${report.entryPoint.lineNumber})`,
      );
      console.log(`├── ${chalk.bold('Root Cause File:')} ${chalk.yellow(report.changedFile)}`);
      console.log(`└── ${chalk.bold('Evidence:')}`);
      report.evidence.forEach((evidence) => {
        const location = evidence.lineNumber ? `:${evidence.lineNumber}` : '';
        console.log(`    • ${evidence.kind} ${evidence.filePath}${location} — ${evidence.detail}`);
      });

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
  console.log(
    chalk.dim(
      `Policy: ${policy.summary.reviewRequired} review-required, ${policy.summary.advisory} advisory, ${policy.summary.baselineExcluded} baseline-excluded.`,
    ),
  );
  return policy.summary.gateBlocking > 0 ? 1 : 0;
}

interface ImpactCliOptions extends ImpactPolicyOptions {
  format: 'text' | 'json';
  baselinePath?: string;
}

export interface ApiImpactProgress {
  stage: 'profile' | 'graph' | 'symbols' | 'impact';
  message: string;
}

export interface ApiImpactAnalysisOptions extends ImpactPolicyOptions {
  onProgress?: (event: ApiImpactProgress) => void;
}

function parseImpactCliOptions(argv: readonly string[]): ImpactCliOptions {
  let format: ImpactCliOptions['format'] = 'text';
  let minimumConfidence: ImpactCliOptions['minimumConfidence'];
  let baselinePath: string | undefined;
  let strict = false;

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--') continue;
    if (argument === '--json') {
      format = 'json';
      continue;
    }
    if (argument === '--strict') {
      strict = true;
      continue;
    }
    if (argument === '--format' || argument === '--confidence' || argument === '--baseline') {
      const value = argv[++index];
      if (!value) throw new Error(`${argument} requires a value`);
      if (argument === '--format') format = parseFormat(value);
      if (argument === '--confidence') minimumConfidence = parseConfidence(value);
      if (argument === '--baseline') baselinePath = value;
      continue;
    }
    if (argument.startsWith('--format=')) {
      format = parseFormat(argument.slice('--format='.length));
      continue;
    }
    if (argument.startsWith('--confidence=')) {
      minimumConfidence = parseConfidence(argument.slice('--confidence='.length));
      continue;
    }
    if (argument.startsWith('--baseline=')) {
      baselinePath = argument.slice('--baseline='.length);
      continue;
    }
    throw new Error(`Unknown API impact option: ${argument}`);
  }

  return { format, minimumConfidence, strict, baselinePath };
}

function parseFormat(value: string): ImpactCliOptions['format'] {
  if (value === 'text' || value === 'json') return value;
  throw new Error(`Unsupported API impact format: ${value}`);
}

function parseConfidence(value: string): ImpactCliOptions['minimumConfidence'] {
  if (value === 'direct' || value === 'di' || value === 'transitive' || value === 'heuristic') {
    return value;
  }
  throw new Error(`Unsupported API impact confidence: ${value}`);
}

export { main, parseImpactCliOptions };

export function analyzeApiImpact(
  root: string,
  profiles: readonly ApiImpactSourceProfile[],
  changedFiles: readonly string[],
  options: ApiImpactAnalysisOptions = {},
): ImpactPolicyResult {
  const { onProgress, ...policyOptions } = options;
  const implementationRoots = new Set<string>();
  const astCache: AstFileCache = new Map();
  const implementationMap = new Map<string, ImplementationSite>();

  for (const profile of profiles) {
    implementationRoots.add(profile.implementationRoot);
    const endpoints = existsSync(profile.endpointRoot)
      ? resolveEndpointsFromDir(profile.endpointRoot, profile.id)
      : [];
    const profileMap = findImplementations(root, endpoints, [profile.implementationRoot], astCache);
    for (const [key, site] of profileMap) {
      implementationMap.set(key, site);
    }
    onProgress?.({
      stage: 'profile',
      message: existsSync(profile.endpointRoot)
        ? `${profile.id}: endpoints=${endpoints.length}, implementations=${profileMap.size}`
        : `${profile.id}: endpoint source missing, skipped`,
    });
  }

  const implementationFiles = findImplementationFiles([...implementationRoots]);
  const changedTypeScriptFiles = changedFiles
    .filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'))
    .map((file) => resolve(root, file));
  onProgress?.({
    stage: 'graph',
    message: `Building AST dependency graph (${implementationFiles.length + changedTypeScriptFiles.length} TypeScript files)...`,
  });
  const dependencyGraph = buildDependencyGraph(
    [...implementationFiles, ...changedTypeScriptFiles],
    astCache,
    (processed, total) =>
      onProgress?.({
        stage: 'graph',
        message: `AST dependency graph progress: ${processed}/${total} files`,
      }),
  );
  onProgress?.({
    stage: 'symbols',
    message: `Extracting changed symbols (${changedFiles.length} files)...`,
  });
  const changedSymbols = collectChangedSymbols(root, changedFiles);
  const consumerCache = new Map<string, ConsumerMatch[]>();
  onProgress?.({ stage: 'impact', message: 'Analyzing impact radius and downstream consumers...' });
  const impactReport = collectImpactFindings(changedFiles, implementationMap, root, {
    resolveConsumers: (site, analysisRoot) => {
      const cacheKey = `${site.serviceId ?? 'unknown'}:${site.api}`;
      const cached = consumerCache.get(cacheKey);
      if (cached) return cached;
      const consumers = findConsumerMatches(
        site,
        resolveConsumerRootsForSite(site, profiles),
        analysisRoot,
      );
      consumerCache.set(cacheKey, consumers);
      return consumers;
    },
    dependencyGraph,
    changedSymbols,
  });

  return evaluateImpactPolicy(impactReport, policyOptions);
}

export function resolveConsumerRootsForSite(
  site: Pick<ImplementationSite, 'serviceId'>,
  profiles: readonly ApiImpactSourceProfile[],
): readonly string[] {
  if (!site.serviceId) return [];
  const profile = profiles.find((item) => item.id === site.serviceId);
  return profile ? [profile.consumerRoot] : [];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}
