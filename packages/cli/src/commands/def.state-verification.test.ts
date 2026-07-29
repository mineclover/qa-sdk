// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { useDefCliHarness } from './def-test-helpers.js';

describe('def state and verification commands', () => {
  const { getOutput, getTempRoot, runDef } = useDefCliHarness();

describe('state', () => {
    it('전체 머신 상태 분포 출력', async () => {
      await runDef(['state']);
      const output = getOutput();
      expect(output.length).toBeGreaterThan(0);
    });

    it('verification artifact를 문서 상태 JSON read model에 조합한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();

      const artifactPath = join(getTempRoot(), 'verification-artifact.json');
      await writeFile(
        artifactPath,
        JSON.stringify({
          schemaVersion: 1,
          runStartedAt: '2026-01-01T00:00:00.000Z',
          runCompletedAt: '2026-01-01T00:01:00.000Z',
          reports: [],
        }),
      );

      await runDef([
        'state',
        'definition-management',
        '--verification-artifact',
        artifactPath,
        '--json',
      ]);

      const parsed = JSON.parse(getOutput()) as {
        verification?: { reportStatus?: string; convention?: string };
      };
      expect(parsed.verification?.reportStatus).toBe('no-report');
      expect(parsed.verification?.convention).toBe('unverified');
    });
  });

  describe('verification-artifact', () => {
    it('scan datasource도 bodyHash binding을 생성한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();

      const bindingsPath = join(getTempRoot(), 'scan-verification-bindings.json');
      await runDef([
        'verification-bindings',
        '--scan',
        '--spec-ids=definition-management',
        '--out',
        bindingsPath,
        '--captured-at=2026-01-01T00:00:00.000Z',
        '--json',
      ]);

      const output = JSON.parse(getOutput()) as {
        bindings: Array<{ bodyHash?: string }>;
      };
      expect(output.bindings[0]?.bodyHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('producer 입력 오류는 실패 exit code를 설정한다', async () => {
      const previousExitCode = process.exitCode;
      process.exitCode = undefined;
      try {
        await runDef(['verification-artifact']);
        expect(process.exitCode).toBe(1);
      } finally {
        process.exitCode = previousExitCode;
      }
    });

    it('run-start binding 캡처부터 artifact consumer까지 연결한다', async () => {
      await runDef(['sync']);
      vi.mocked(console.log).mockClear();

      const bindingsPath = join(getTempRoot(), 'verification-bindings.json');
      const summaryPath = join(getTempRoot(), 'verification-summary.json');
      const artifactPath = join(getTempRoot(), 'verification-artifact.json');
      await runDef([
        'verification-bindings',
        '--spec-ids=definition-management',
        '--out',
        bindingsPath,
        '--captured-at=2026-01-01T00:00:00.000Z',
        '--json',
      ]);
      const bindingOutput = JSON.parse(getOutput()) as {
        bindings: Array<{
          specId: string;
          definitionAddress: string;
          revision: number;
          bodyHash: string;
        }>;
      };
      expect(bindingOutput.bindings[0]?.specId).toBe('definition-management');
      expect(bindingOutput.bindings[0]?.definitionAddress).toMatch(/^def_document:/);

      await writeFile(
        summaryPath,
        JSON.stringify({
          reports: [
            {
              specId: 'definition-management',
              evidences: 1,
              passed: 1,
              failed: 0,
              skipped: 0,
              markers: {},
              coverage: 1,
              lastVerified: '2026-01-01T00:01:00.000Z',
            },
          ],
          totalSpecs: 1,
          verifiedSpecs: 1,
          fullyPassed: 1,
          generatedAt: '2026-01-01T00:01:00.000Z',
        }),
      );
      vi.mocked(console.log).mockClear();
      await runDef([
        'verification-artifact',
        '--summary',
        summaryPath,
        '--bindings',
        bindingsPath,
        '--out',
        artifactPath,
        '--run-started-at=2026-01-01T00:00:00.000Z',
        '--run-completed-at=2026-01-01T00:02:00.000Z',
        '--json',
      ]);
      expect(JSON.parse(getOutput()).artifact.reports[0].binding.specId).toBe(
        'definition-management',
      );

      vi.mocked(console.log).mockClear();
      await runDef([
        'state',
        'definition-management',
        '--verification-artifact',
        artifactPath,
        '--verification-drift',
        '--json',
      ]);
      const state = JSON.parse(getOutput()) as {
        verification?: {
          bindingStatus?: string;
          convention?: string;
          driftReport?: { specId?: string };
        };
      };
      expect(state.verification).toEqual(
        expect.objectContaining({
          bindingStatus: 'ambiguous-address',
          convention: 'unverified',
        }),
      );
      expect(state.verification?.driftReport?.specId).toBe('definition-management');
    });

    it('summary와 run-start binding을 검증 아티팩트 파일로 생성한다', async () => {
      await runDef(['help']);
      vi.mocked(console.log).mockClear();

      const summaryPath = join(getTempRoot(), 'verification-summary.json');
      const bindingsPath = join(getTempRoot(), 'verification-bindings.json');
      const artifactPath = join(getTempRoot(), 'verification-artifact.json');
      await writeFile(
        summaryPath,
        JSON.stringify({
          reports: [
            {
              specId: 'spec-a',
              evidences: 1,
              passed: 1,
              failed: 0,
              skipped: 0,
              markers: {},
              coverage: 1,
              lastVerified: '2026-01-01T00:01:00.000Z',
            },
          ],
          totalSpecs: 1,
          verifiedSpecs: 1,
          fullyPassed: 1,
          generatedAt: '2026-01-01T00:01:00.000Z',
        }),
      );
      await writeFile(
        bindingsPath,
        JSON.stringify([
          {
            specId: 'spec-a',
            definitionAddress: 'def_document:v2:123',
            docIdAtRun: 'spec-a',
            docVersion: 'v1',
            revision: 3,
            bodyHash: 'sha256:abc',
            capturedAt: '2026-01-01T00:00:00.000Z',
          },
        ]),
      );

      await runDef([
        'verification-artifact',
        '--summary',
        summaryPath,
        '--bindings',
        bindingsPath,
        '--out',
        artifactPath,
        '--run-started-at=2026-01-01T00:00:00.000Z',
        '--run-completed-at=2026-01-01T00:02:00.000Z',
        '--json',
      ]);

      const output = JSON.parse(getOutput()) as {
        out: string;
        artifact: { schemaVersion: number; reports: Array<{ binding?: { specId: string } }> };
      };
      expect(output.out).toBe(artifactPath);
      expect(output.artifact.schemaVersion).toBe(1);
      expect(output.artifact.reports[0]?.binding?.specId).toBe('spec-a');
      const persisted = JSON.parse(await readFile(artifactPath, 'utf8')) as typeof output.artifact;
      expect(persisted).toEqual(output.artifact);
    });
  });
});
