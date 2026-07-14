// @def.doc ralph-tui-integration-test

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createRalphSessionAdapter } from './ralph-session.js';

describe('ralph-tui-integration — createRalphSessionAdapter', () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'ralph-session-test-'));
    await mkdir(join(rootDir, '.ralph-tui'), { recursive: true });
    await mkdir(join(rootDir, 'tasks'), { recursive: true });
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  it('returns no envelopes when the session file is missing', async () => {
    const adapter = createRalphSessionAdapter({ rootDir });
    const envelopes = await adapter.listDocuments();
    expect(envelopes).toEqual([]);
  });

  it('stamps the session envelope with transient metadata', async () => {
    await writeSessionMeta({
      id: 'session-123',
      status: 'running',
      totalTasks: 2,
      tasksCompleted: 0,
    });
    const adapter = createRalphSessionAdapter({ rootDir });
    const [envelope] = await adapter.listDocuments();
    expect(envelope).toBeDefined();
    expect(envelope!.kind).toBe('ralph-session');
    expect(envelope!.stableId).toBe('ralph-session:session-123');
    expect(envelope!.metadata.transient).toBe(true);
    expect(envelope!.metadata.sourcePath).toBe('.ralph-tui/session-meta.json');
  });

  it('emits a parse-error diagnostic on malformed JSON', async () => {
    await writeFile(join(rootDir, '.ralph-tui', 'session-meta.json'), 'not json', 'utf8');
    const adapter = createRalphSessionAdapter({ rootDir });
    const [envelope] = await adapter.listDocuments();
    expect(envelope).toBeDefined();
    expect(envelope!.diagnostics.map((d) => d.code)).toContain('ralph-session-parse-error');
  });

  it('emits a root-not-object diagnostic when the root is a JSON array', async () => {
    await writeFile(join(rootDir, '.ralph-tui', 'session-meta.json'), '[]', 'utf8');
    const adapter = createRalphSessionAdapter({ rootDir });
    const [envelope] = await adapter.listDocuments();
    expect(envelope).toBeDefined();
    expect(envelope!.diagnostics.map((d) => d.code)).toContain('ralph-session-root-not-object');
  });

  it('flags drift when PRD JSON has all stories passing but the session is still running', async () => {
    await writeSessionMeta({
      id: 'session-1',
      status: 'running',
      prdPath: 'tasks/sample-prd.json',
      totalTasks: 1,
      tasksCompleted: 1,
    });
    await writePrdJson('tasks/sample-prd.json', {
      name: 'Sample',
      branchName: 'feature/sample',
      description: 'Sample PRD',
      userStories: [{ id: 'US-001', title: 'Ship', dependsOn: [], passes: true }],
    });

    const adapter = createRalphSessionAdapter({ rootDir });
    const [envelope] = await adapter.listDocuments();
    expect(envelope!.diagnostics.map((d) => d.code)).toContain(
      'ralph-session-prd-complete-session-running',
    );
    expect(envelope!.metadata.prdAllStoriesPassing).toBe(true);
    expect(envelope!.metadata.prdStoryCount).toBe(1);
    expect(envelope!.metadata.prdPassedStoryCount).toBe(1);
  });

  it('flags totalTasks drift vs PRD JSON userStories count', async () => {
    await writeSessionMeta({
      id: 'session-2',
      status: 'running',
      prdPath: 'tasks/sample-prd.json',
      totalTasks: 5,
      tasksCompleted: 0,
    });
    await writePrdJson('tasks/sample-prd.json', {
      name: 'Sample',
      branchName: 'feature/sample',
      description: 'Sample PRD',
      userStories: [
        { id: 'US-001', title: 'A', dependsOn: [] },
        { id: 'US-002', title: 'B', dependsOn: [] },
      ],
    });

    const adapter = createRalphSessionAdapter({ rootDir });
    const [envelope] = await adapter.listDocuments();
    expect(envelope!.diagnostics.map((d) => d.code)).toContain('ralph-session-total-tasks-drift');
  });

  it('flags tasksCompleted drift vs PRD JSON passing story count', async () => {
    await writeSessionMeta({
      id: 'session-3',
      status: 'running',
      prdPath: 'tasks/sample-prd.json',
      totalTasks: 2,
      tasksCompleted: 2,
    });
    await writePrdJson('tasks/sample-prd.json', {
      name: 'Sample',
      branchName: 'feature/sample',
      description: 'Sample PRD',
      userStories: [
        { id: 'US-001', title: 'A', dependsOn: [], passes: true },
        { id: 'US-002', title: 'B', dependsOn: [], passes: false },
      ],
    });

    const adapter = createRalphSessionAdapter({ rootDir });
    const [envelope] = await adapter.listDocuments();
    expect(envelope!.diagnostics.map((d) => d.code)).toContain(
      'ralph-session-completed-tasks-drift',
    );
  });

  it('returns the envelope via getDocument by stableId or session id', async () => {
    await writeSessionMeta({ id: 'abc', status: 'running' });
    const adapter = createRalphSessionAdapter({ rootDir });
    const byStableId = await adapter.getDocument('ralph-session:abc');
    const byMetadataId = await adapter.getDocument('abc');
    const miss = await adapter.getDocument('nonexistent');
    expect(byStableId?.stableId).toBe('ralph-session:abc');
    expect(byMetadataId?.stableId).toBe('ralph-session:abc');
    expect(miss).toBeNull();
  });

  async function writeSessionMeta(value: unknown): Promise<void> {
    await writeFile(
      join(rootDir, '.ralph-tui', 'session-meta.json'),
      JSON.stringify(value),
      'utf8',
    );
  }

  async function writePrdJson(path: string, value: unknown): Promise<void> {
    await writeFile(join(rootDir, path), JSON.stringify(value), 'utf8');
  }
});
