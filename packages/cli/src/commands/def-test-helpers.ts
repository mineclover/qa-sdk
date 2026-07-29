import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, vi } from 'vitest';
import { cliDef } from './def.js';

export function useDefCliHarness() {
  let tempRoot = '';
  let dbPath = '';
  const originalQaSdkHome = process.env.QA_SDK_HOME;

  beforeEach(() => {
    tempRoot = '';
    dbPath = '';
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (originalQaSdkHome === undefined) {
      delete process.env.QA_SDK_HOME;
    } else {
      process.env.QA_SDK_HOME = originalQaSdkHome;
    }
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  function getOutput(): string {
    const spy = console.log as unknown as { mock: { calls: unknown[][] } };
    return spy.mock.calls.map((call) => String(call[0])).join('\n');
  }

  function getTempRoot(): string {
    if (!tempRoot) throw new Error('def test temp root has not been initialized');
    return tempRoot;
  }

  async function runDef(args: string[]): Promise<void> {
    if (args.length === 0) {
      await cliDef(args);
      return;
    }

    if (!dbPath) {
      tempRoot = await mkdtemp(join(tmpdir(), 'qa-sdk-def-cli-'));
      dbPath = join(tempRoot, 'definition-service.sqlite');
      process.env.QA_SDK_HOME = tempRoot;
    }

    await cliDef([...args, '--db', dbPath]);
  }

  return { getOutput, getTempRoot, runDef };
}
