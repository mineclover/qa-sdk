// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MOTION_COMPOSITION_SCHEMA_V1,
  createPromoGridComposition,
  serializeMotionComposition,
} from 'motion-content';
import {
  createMotionWorkspaceSnapshot,
  MOTION_WORKSPACE_SCHEMA_V1,
  MOTION_WORKSPACE_SCHEMA_V2,
  serializeMotionWorkspaceSnapshot,
} from 'motion-workspace';
import { USAGE, resolveSubcommand } from '../index.js';
import {
  MOTION_INSPECT_USAGE,
  MOTION_VALIDATE_USAGE,
  motionInspect,
  motionValidate,
} from './motion.js';

describe('motion CLI', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'qa-motion-cli-'));
    process.exitCode = undefined;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
    await rm(tempDir, { recursive: true, force: true });
  });

  it('validates a composition document file', async () => {
    const composition = createPromoGridComposition('crossfade');
    const filePath = join(tempDir, 'composition.json');
    await writeFile(filePath, serializeMotionComposition(composition));

    const output = await captureConsole(() => motionValidate([filePath]));

    expect(output.stdout).toContain('유효한 motion composition document');
    expect(output.stdout).toContain(filePath);
    expect(process.exitCode).toBeUndefined();
  });

  it('validates a workspace snapshot file', async () => {
    const snapshot = createMotionWorkspaceSnapshot({
      composition: createPromoGridComposition('lift'),
      savedAt: '2026-03-27T00:00:00.000Z',
      source: { presetId: 'promo-grid' },
    });
    const filePath = join(tempDir, 'workspace.json');
    await writeFile(filePath, serializeMotionWorkspaceSnapshot(snapshot));

    const output = await captureConsole(() => motionValidate([filePath]));

    expect(output.stdout).toContain('유효한 motion workspace snapshot');
    expect(output.stdout).toContain(filePath);
    expect(process.exitCode).toBeUndefined();
  });

  it('reports concrete validation issues for invalid motion documents', async () => {
    const filePath = join(tempDir, 'broken-workspace.json');
    await writeFile(
      filePath,
      JSON.stringify({
        schemaVersion: MOTION_WORKSPACE_SCHEMA_V1,
        document: {
          schemaVersion: MOTION_COMPOSITION_SCHEMA_V1,
        },
        editor: {
          values: {},
          selection: null,
          viewport: {
            zoom: 1,
            scrollLeftMs: 0,
          },
          loop: false,
        },
        revision: 0,
      }),
    );

    const output = await captureConsole(() => motionValidate([filePath]));

    expect(output.stdout).toContain('유효하지 않은 motion workspace snapshot');
    expect(output.stdout).toContain('$.document.composition: 필수 object 필드가 없습니다.');
    expect(output.stdout).toContain(
      '$.editor.viewport.visibleDurationMs: 필수 number 필드가 없습니다.',
    );
    expect(output.stdout).toContain('$.savedAt: 필수 string 필드가 없습니다.');
    expect(process.exitCode).toBe(1);
  });

  it('inspects a workspace snapshot and prints composition/editor summary', async () => {
    const composition = createPromoGridComposition('crossfade');
    const snapshot = createMotionWorkspaceSnapshot({
      composition,
      savedAt: '2026-03-27T00:00:00.000Z',
      source: {
        presetId: 'promo-grid',
        storageKey: 'workspace:demo',
      },
    });
    const filePath = join(tempDir, 'inspect-workspace.json');
    await writeFile(filePath, serializeMotionWorkspaceSnapshot(snapshot));

    const output = await captureConsole(() => motionInspect([filePath]));

    expect(output.stdout).toContain('Motion Workspace Snapshot');
    expect(output.stdout).toContain(`schemaVersion: ${MOTION_WORKSPACE_SCHEMA_V2}`);
    expect(output.stdout).toContain('source: presetId=promo-grid, storageKey=workspace:demo');
    expect(output.stdout).toContain(`composition.id: ${composition.id}`);
    expect(output.stdout).toContain(`composition.layers: ${composition.layers.length}`);
    expect(output.stdout).toContain('editor.selection: (none)');
  });

  it('inspects a composition document and prints content summary', async () => {
    const composition = createPromoGridComposition('lift');
    const filePath = join(tempDir, 'inspect-composition.json');
    await writeFile(filePath, serializeMotionComposition(composition));

    const output = await captureConsole(() => motionInspect([filePath]));

    expect(output.stdout).toContain('Motion Composition Document');
    expect(output.stdout).toContain(`schemaVersion: ${MOTION_COMPOSITION_SCHEMA_V1}`);
    expect(output.stdout).toContain(`id: ${composition.id}`);
    expect(output.stdout).toContain(`title: ${composition.title}`);
    expect(output.stdout).toContain(`layers: ${composition.layers.length}`);
    expect(output.stdout).toContain(`transitions: ${composition.transitions.length}`);
  });

  it('exposes motion commands in CLI usage and subcommand parsing', () => {
    expect(USAGE).toContain('qa-sdk motion validate <file>');
    expect(USAGE).toContain('qa-sdk motion inspect <file>');
    expect(resolveSubcommand(['motion', 'validate', 'demo.json'])).toEqual({
      name: 'motion validate',
      rest: ['demo.json'],
    });
    expect(resolveSubcommand(['motion', 'inspect', 'demo.json'])).toEqual({
      name: 'motion inspect',
      rest: ['demo.json'],
    });
  });

  it('prints command usage when file is missing', async () => {
    const validateOutput = await captureConsole(() => motionValidate([]));
    const inspectOutput = await captureConsole(() => motionInspect([]));

    expect(validateOutput.stderr).toContain(MOTION_VALIDATE_USAGE);
    expect(inspectOutput.stderr).toContain(MOTION_INSPECT_USAGE);
  });
});

async function captureConsole(run: () => Promise<void> | void) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    stdout.push(args.join(' '));
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    stderr.push(args.join(' '));
  });

  try {
    await run();
  } finally {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  }

  return {
    stdout: stdout.join('\n'),
    stderr: stderr.join('\n'),
  };
}
