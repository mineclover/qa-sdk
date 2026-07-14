// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import { beforeEach, describe, expect, it } from 'vitest';
import { QualityLedger } from './ledger.js';
import { SqliteQualityStore } from './store.js';

describe('QualityLedger', () => {
  let store: SqliteQualityStore;
  let ledger: QualityLedger;

  beforeEach(() => {
    store = new SqliteQualityStore(':memory:');
    ledger = new QualityLedger(store);
  });

  it('최신 성공 실행이 같은 버전이면 verified', () => {
    ledger.recordRun({
      gateDocId: 'gate-a',
      docVersion: 3,
      command: 'pnpm test',
      outcome: 'pass',
    });

    expect(
      ledger.statusForGate({
        gateDocId: 'gate-a',
        docVersion: 3,
      }).status,
    ).toBe('verified');
  });

  it('버전이 달라지면 stale', () => {
    ledger.recordRun({
      gateDocId: 'gate-a',
      docVersion: 2,
      command: 'pnpm test',
      outcome: 'pass',
    });

    expect(
      ledger.statusForGate({
        gateDocId: 'gate-a',
        docVersion: 3,
      }).status,
    ).toBe('stale');
  });

  it('성공한 gate들만 있으면 bundle verified', () => {
    ledger.recordRun({
      gateDocId: 'gate-a',
      docVersion: 1,
      bundleId: 'bundle-a',
      command: 'pnpm typecheck',
      outcome: 'pass',
    });
    ledger.recordRun({
      gateDocId: 'gate-b',
      docVersion: 1,
      bundleId: 'bundle-a',
      command: 'pnpm build',
      outcome: 'pass',
    });

    expect(
      ledger.isBundleVerified([
        { gateDocId: 'gate-a', docVersion: 1, bundleId: 'bundle-a' },
        { gateDocId: 'gate-b', docVersion: 1, bundleId: 'bundle-a' },
      ]),
    ).toBe(true);
  });

  it('bundle verification은 blocking gate들을 함께 요약한다', () => {
    ledger.recordRun({
      gateDocId: 'gate-a',
      docVersion: 1,
      bundleId: 'bundle-a',
      command: 'pnpm typecheck',
      outcome: 'pass',
    });
    ledger.recordRun({
      gateDocId: 'gate-b',
      docVersion: 1,
      bundleId: 'bundle-a',
      command: 'pnpm test',
      outcome: 'fail',
      exitCode: 1,
    });

    const verification = ledger.resolveBundleVerification([
      { gateDocId: 'gate-a', docVersion: 1, bundleId: 'bundle-a' },
      { gateDocId: 'gate-b', docVersion: 1, bundleId: 'bundle-a' },
      { gateDocId: 'gate-c', docVersion: 1, bundleId: 'bundle-a' },
    ]);

    expect(verification.bundleId).toBe('bundle-a');
    expect(verification.totalGates).toBe(3);
    expect(verification.verifiedGates).toBe(1);
    expect(verification.verified).toBe(false);
    expect(
      verification.blockingGateStatuses.map((status) => `${status.gateDocId}:${status.status}`),
    ).toEqual(['gate-b:failed', 'gate-c:unverified']);
  });

  it('run context와 RCA 필드를 그대로 보존한다', () => {
    ledger.recordRun({
      gateDocId: 'gate-a',
      docVersion: 1,
      bundleId: 'bundle-a',
      command: 'pnpm test',
      outcome: 'fail',
      exitCode: 1,
      notes: 'command exited with code 1',
      repoRoot: '/repo',
      gitBranch: 'feature/rca',
      gitSha: 'abc123',
      runDurationMs: 456,
      successPattern: 'stdout contains "done"',
      successPatternMatched: false,
      failureClass: 'build-failure',
    });

    const entry = ledger.history('gate-a', 1)[0];

    expect(entry).toMatchObject({
      repoRoot: '/repo',
      gitBranch: 'feature/rca',
      gitSha: 'abc123',
      runDurationMs: 456,
      successPattern: 'stdout contains "done"',
      successPatternMatched: false,
      failureClass: 'build-failure',
    });
  });
});
