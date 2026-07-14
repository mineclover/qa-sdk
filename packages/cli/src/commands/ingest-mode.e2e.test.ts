// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * service mode CLI E2E 테스트.
 *
 * CLI 엔트리포인트를 직접 호출하여 프로필 전환을 검증한다.
 * (기존 ingest mode → service mode로 통합됨)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { main } from '../index.js';

describe('service mode CLI E2E', () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = join(tmpdir(), `qa-sdk-mode-test-${Date.now()}`);
    mkdirSync(tempHome, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {
      /* 무시 */
    }
  });

  async function run(
    args: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number | undefined }> {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const previousHome = process.env.HOME;
    const previousExitCode = process.exitCode;

    process.env.HOME = tempHome;
    process.exitCode = undefined;
    console.log = (...items: unknown[]) => {
      stdout.push(items.join(' '));
    };
    console.error = (...items: unknown[]) => {
      stderr.push(items.join(' '));
    };
    console.warn = (...items: unknown[]) => {
      stderr.push(items.join(' '));
    };

    try {
      await main(args.split(' '));
      return {
        stdout: stdout.join('\n'),
        stderr: stderr.join('\n'),
        exitCode: process.exitCode,
      };
    } finally {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      process.exitCode = previousExitCode;
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
    }
  }

  function readProfile(): Record<string, unknown> | null {
    const path = join(tempHome, '.qa-sdk', 'service-profile.json');
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8'));
  }

  it('인수 없이 호출 → 기본 local 프로필 표시', async () => {
    const output = await run('service mode');
    expect(output.stdout).toContain('Service Profile');
    expect(output.stdout).toContain('local');
  });

  it('local 모드 전환 → 프로필 파일 생성', async () => {
    await run('service mode local');
    const profile = readProfile();
    expect(profile).toBeTruthy();
    expect(profile!.mode).toBe('local');
    expect(profile!.insightsDriver).toBe('local');
    expect((profile!.services as Record<string, string>)['ingest-server']).toBe(
      'http://localhost:3200',
    );
  });

  it('prod 모드 전환 → insightsDriver=app-hub + prod URL', async () => {
    await run('service mode prod');
    const profile = readProfile();
    expect(profile!.mode).toBe('prod');
    expect(profile!.insightsDriver).toBe('app-hub');
    expect((profile!.services as Record<string, string>)['ingest-server']).toContain('qa-sdk.io');
  });

  it('staging 모드 → insightsDriver=local 유지', async () => {
    await run('service mode staging');
    const profile = readProfile();
    expect(profile!.mode).toBe('staging');
    expect(profile!.insightsDriver).toBe('local');
    expect((profile!.services as Record<string, string>)['registry-service']).toContain('staging');
  });

  it('--set으로 개별 서비스 URL 수정', async () => {
    await run('service mode prod');
    await run('service mode --set ingest-server=https://custom.ingest.io');
    const profile = readProfile();
    expect((profile!.services as Record<string, string>)['ingest-server']).toBe(
      'https://custom.ingest.io',
    );
    // 나머지는 prod 유지
    expect((profile!.services as Record<string, string>)['registry-service']).toContain(
      'qa-sdk.io',
    );
  });

  it('local ↔ prod 전환 시 appHub 설정 보존', async () => {
    await run('service mode prod --set appHub.projectId=my-project');
    await run('service mode local');
    const profile = readProfile();
    expect(profile!.mode).toBe('local');
    expect(profile!.insightsDriver).toBe('local');
    const appHub = profile!.appHub as Record<string, string>;
    expect(appHub.projectId).toBe('my-project');
  });

  it('알 수 없는 모드 → 에러', async () => {
    const output = await run('service mode unknown-mode');
    expect(output.stdout + output.stderr).toContain('알 수 없는 모드');
    expect(output.exitCode).toBe(1);
  });

  it('ingest mode → service mode 동일 동작', async () => {
    // ingest mode는 service mode의 re-export이므로 동일하게 동작
    await run('ingest mode local');
    const profile = readProfile();
    expect(profile!.mode).toBe('local');
  });

  it('prod → credential 마스킹 + 보존', async () => {
    await run('service mode prod --set appHub.credential=/path/to/key.json');
    const output = await run('service mode');
    expect(output.stdout).toContain('***'); // 마스킹
    const profile = readProfile();
    const appHub = profile!.appHub as Record<string, string>;
    expect(appHub.credential).toBe('/path/to/key.json');
  });
});
