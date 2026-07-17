// @def.boundary docs-control-plane
// @def.doc spec-definition-merge-validation

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_VERIFICATION_SUITES,
  runVerificationSuites,
  type VerificationSuite,
} from './spec-verification-runner.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('spec-verification-runner', () => {
  it('각 suite 결과를 VerificationSummary 파일로 저장한다', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'qa-sdk-verification-runner-'));
    tempDirs.push(rootDir);
    const summaryPath = join(rootDir, 'artifacts', 'summary.json');

    const result = runVerificationSuites({
      rootDir,
      summaryPath,
      runSuite: (suite: VerificationSuite) => ({
        status: suite.specId === 'spec-tracker-system' ? 1 : 0,
        signal: null,
      }),
    });

    expect(result.failed).toBe(true);
    expect(result.summary.reports).toHaveLength(DEFAULT_VERIFICATION_SUITES.length);
    expect(result.summary.reports.find((report) => report.specId === 'spec-tracker-system')).toMatchObject({
      failed: 1,
      coverage: 0,
    });
    expect(JSON.parse(readFileSync(summaryPath, 'utf8'))).toEqual(result.summary);
  });

  it('알 수 없는 specId를 조기에 거부한다', () => {
    expect(() =>
      runVerificationSuites({
        rootDir: process.cwd(),
        summaryPath: join(process.cwd(), 'tmp-summary.json'),
        specIds: ['unknown-spec'],
        runSuite: () => ({
          status: 0,
          signal: null,
        }),
      }),
    ).toThrow('unknown verification specId: unknown-spec');
  });
});
