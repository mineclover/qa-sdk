// @def.boundary docs-control-plane
// @def.doc spec-definition-merge-validation

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { generateReport, SpecCollector } from '../packages/spec-tracker/src/index.js';
import type { VerificationSummary } from '../packages/spec-tracker/src/types.js';

export interface VerificationSuite {
  readonly specId: string;
  readonly cwd: string;
  readonly command: readonly string[];
}

export interface VerificationRunnerOptions {
  readonly rootDir: string;
  readonly summaryPath: string;
  readonly specIds?: readonly string[];
  readonly runSuite?: (suite: VerificationSuite, rootDir: string) => VerificationSuiteResult;
}

export interface VerificationSuiteResult {
  readonly status: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly error?: Error;
}

export interface VerificationRunnerResult {
  readonly summary: VerificationSummary;
  readonly failed: boolean;
}

/** CI에서 artifact로 고정할 최소 문서별 검증 lane. 각 lane은 독립적으로 실행된다. */
export const DEFAULT_VERIFICATION_SUITES: readonly VerificationSuite[] = [
  {
    specId: 'spec-definition-merge-validation',
    cwd: 'packages/cli',
    command: [
      'pnpm',
      'exec',
      'vitest',
      'run',
      'src/commands/def.test.ts',
      'src/lib/spec-definition-verification.test.ts',
    ],
  },
  {
    specId: 'spec-definition-separation',
    cwd: 'packages/definition-data-source',
    command: ['pnpm', 'exec', 'vitest', 'run', 'src/factory.test.ts', 'src/sync-local-db.test.ts'],
  },
  {
    specId: 'spec-tracker-system',
    cwd: 'packages/spec-tracker',
    command: ['pnpm', 'test'],
  },
];

function executeSuite(suite: VerificationSuite, rootDir: string): VerificationSuiteResult {
  return spawnSync('corepack', suite.command, {
    cwd: resolve(rootDir, suite.cwd),
    stdio: 'inherit',
  });
}

function selectSuites(specIds?: readonly string[]): readonly VerificationSuite[] {
  if (!specIds || specIds.length === 0) return DEFAULT_VERIFICATION_SUITES;
  const requested = new Set(specIds.map((specId) => specId.trim()).filter(Boolean));
  const selected = DEFAULT_VERIFICATION_SUITES.filter((suite) => requested.has(suite.specId));
  const unknown = [...requested].filter(
    (specId) => !DEFAULT_VERIFICATION_SUITES.some((suite) => suite.specId === specId),
  );
  if (unknown.length > 0) {
    throw new Error(`unknown verification specId: ${unknown.join(', ')}`);
  }
  if (selected.length === 0) throw new Error('at least one verification suite is required');
  return selected;
}

function resultStatus(result: VerificationSuiteResult): 'pass' | 'fail' {
  return result.status === 0 && result.error === undefined ? 'pass' : 'fail';
}

function resultError(result: VerificationSuiteResult): string | undefined {
  if (result.error) return result.error.message;
  if (result.signal) return `suite terminated by signal ${result.signal}`;
  if (result.status !== 0) return `suite exited with code ${result.status ?? 'unknown'}`;
  return undefined;
}

export function runVerificationSuites(
  options: VerificationRunnerOptions,
): VerificationRunnerResult {
  const suites = selectSuites(options.specIds);
  const collector = new SpecCollector();
  const runSuite = options.runSuite ?? executeSuite;
  let failed = false;

  for (const suite of suites) {
    const result = runSuite(suite, options.rootDir);
    const status = resultStatus(result);
    failed ||= status === 'fail';
    collector.record({
      specId: suite.specId,
      status,
      source: 'test',
      testName: suite.command.join(' '),
      testFile: suite.cwd,
      ...(resultError(result) ? { error: resultError(result) } : {}),
    });
  }

  // A suite command proves lane health, not every contract declared by the
  // document. Keep the evidence shape visible while preventing it from being
  // interpreted as contract coverage by the upper adapter.
  const generated = generateReport(
    collector,
    suites.map((suite) => suite.specId),
  );
  const summary = {
    ...generated,
    reports: generated.reports.map((report) => ({ ...report, coverageBasis: 'suite' as const })),
  };
  const summaryPath = isAbsolute(options.summaryPath)
    ? options.summaryPath
    : resolve(options.rootDir, options.summaryPath);
  mkdirSync(dirname(summaryPath), { recursive: true });
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  return { summary, failed };
}

function flagValue(args: readonly string[], name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  return /(?:^|\/)spec-verification-runner\.(?:ts|js)$/.test(entry ?? '');
}

if (isMainModule()) {
  const args = process.argv.slice(2);
  const summaryPath = flagValue(args, '--summary');
  if (!summaryPath) {
    console.error(
      'Usage: tsx scripts/spec-verification-runner.ts --summary=<path> [--spec-ids=<csv>]',
    );
    process.exitCode = 2;
  } else {
    try {
      const result = runVerificationSuites({
        rootDir: process.cwd(),
        summaryPath,
        specIds: flagValue(args, '--spec-ids')?.split(','),
      });
      console.log(`verification summary: ${resolve(process.cwd(), summaryPath)}`);
      console.log(
        `suites: ${result.summary.reports.length} | failed: ${result.failed ? 'yes' : 'no'}`,
      );
      process.exitCode = result.failed ? 1 : 0;
    } catch (error) {
      console.error(`[verification-runner] ${(error as Error).message}`);
      process.exitCode = 1;
    }
  }
}
