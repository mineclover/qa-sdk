// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import { DEF_COMMAND_DESCRIPTORS } from '../command-groups/def.commands.js';
import { cliDef, createPlatformQueryInvocation, createPlatformVerifyInvocation } from './def.js';
import { hasExternalPlatform, isPlatformExecutableAvailable } from './def/platform.js';
import { useDefCliHarness } from './def-test-helpers.js';

describe('def lifecycle and routing commands', () => {
  const { getOutput, runDef } = useDefCliHarness();

  describe('help', () => {
    it('서브커맨드 없으면 help 출력', async () => {
      await runDef([]);
      expect(getOutput()).toContain('qa-sdk def');
    });

    it('help 서브커맨드 명시', async () => {
      await runDef(['help']);
      expect(getOutput()).toContain('qa-sdk def');
    });
  });

  describe('command registry', () => {
    it('verification producer commands are reachable from the top-level command tree', () => {
      expect(DEF_COMMAND_DESCRIPTORS.map((descriptor) => descriptor.id)).toEqual(
        expect.arrayContaining([
          'def.platform-verify',
          'def.verification-bindings',
          'def.verification-artifact',
        ]),
      );
    });
  });

  describe('platform-verify', () => {
    it('runs the external QA profile through a JavaScript entrypoint in local development', () => {
      expect(
        createPlatformVerifyInvocation('/repo', {
          'platform-bin': '/tools/qa-spec-platform.js',
          store: '.evidence',
          'include-tests': 'true',
          json: 'true',
        }),
      ).toEqual({
        command: process.execPath,
        args: [
          '/tools/qa-spec-platform.js',
          'verify',
          '/repo',
          '--store',
          '.evidence',
          '--include-tests',
          '--json',
        ],
      });
    });

    it('[contract:definition-code-link-coverage.platform.auto.installed.v1] selects an installed adapter in auto mode', async () => {
      const directory = await mkdtemp(join(tmpdir(), 'qa-sdk-platform-'));
      const executable = join(directory, 'qa-spec-platform');
      vi.stubEnv('QA_SPEC_PLATFORM_BIN', '');
      try {
        await writeFile(executable, '#!/usr/bin/env node\n');
        await chmod(executable, 0o755);

        expect(isPlatformExecutableAvailable('qa-spec-platform', directory)).toBe(true);
        expect(hasExternalPlatform({ platform: 'auto' }, directory)).toBe(true);
      } finally {
        vi.unstubAllEnvs();
        await rm(directory, { recursive: true, force: true });
      }
    });

    it('[contract:definition-code-link-coverage.platform.auto.fallback.v1] preserves legacy routing when adapter is unavailable', () => {
      expect(isPlatformExecutableAvailable('qa-spec-platform', '/tmp/qa-spec-platform-bin')).toBe(
        false,
      );
      expect(hasExternalPlatform({ platform: 'auto' }, '/tmp/qa-spec-platform-bin')).toBe(false);
    });

    it('forwards legacy query options to the external profile command', () => {
      expect(
        createPlatformQueryInvocation('code-link-gaps', '/repo', {
          'platform-bin': '/tools/qa-spec-platform.js',
          scope: 'packages/cli/src',
          'include-tests': 'true',
          limit: '3',
          strict: 'true',
          json: 'true',
        }),
      ).toEqual({
        command: process.execPath,
        args: [
          '/tools/qa-spec-platform.js',
          'code-link-gaps',
          '/repo',
          '--scope',
          'packages/cli/src',
          '--limit',
          '3',
          '--include-tests',
          '--strict',
          '--json',
        ],
      });
    });

    it('fails clearly when the external adapter executable is missing', async () => {
      const previousExitCode = process.exitCode;
      process.exitCode = undefined;
      try {
        await cliDef([
          'platform-verify',
          '--platform-bin',
          '/tmp/qa-sdk-platform-command-that-does-not-exist',
        ]);
        expect(process.exitCode).toBe(1);
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('spec-management platform 실행 실패'),
        );
      } finally {
        process.exitCode = previousExitCode;
      }
    });
  });

  describe('link-rules', () => {
    it('LinkType 규칙 출력', async () => {
      await runDef(['link-rules']);
      const output = getOutput();
      expect(output).toContain('contains');
      expect(output).toContain('depends_on');
    });
  });

  describe('sync', () => {
    it('docs → local DB 동기화', async () => {
      await runDef(['sync']);
      const output = getOutput();
      expect(output).toContain('동기화 완료');
      expect(output).toContain('DB:');
    });
  });

  describe('scan (= sync alias)', () => {
    it('scan은 sync와 동일하게 동작', async () => {
      await runDef(['scan']);
      const output = getOutput();
      expect(output).toContain('동기화 완료');
    });
  });

  it('알 수 없는 서브커맨드면 help 출력', async () => {
    await runDef(['nonexistent-command']);
    const output = getOutput();
    expect(output).toContain('qa-sdk def');
  });
});
