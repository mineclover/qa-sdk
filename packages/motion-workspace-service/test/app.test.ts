import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createPromoGridComposition,
  migrateCompositionV1toV2,
  type MotionCompositionDefV2,
  type MotionSceneDef,
} from 'motion-content';
import {
  MotionWorkspaceClient,
  MotionWorkspaceClientError,
  isMotionWorkspaceConflictError,
} from 'motion-workspace-client';
import {
  createMotionWorkspaceSnapshot,
  createMotionWorkspaceSnapshotV1,
  type MotionWorkspaceSnapshotV2,
} from 'motion-workspace';
import { createApp, type MotionWorkspaceAppDeps } from '../src/app.js';
import { createWorkspaceWsEvents } from '../src/routes/workspaces.js';
import { createMotionWorkspaceRepository } from '../src/sqlite-repository.js';
import { createWorkspaceWsHub } from '../src/ws-hub.js';

function createWorkspaceSnapshot(
  overrides: Partial<MotionWorkspaceSnapshotV2> = {},
): MotionWorkspaceSnapshotV2 {
  const base = createMotionWorkspaceSnapshot({
    composition: migrateCompositionV1toV2(createPromoGridComposition('flash')),
    values: {
      headline: 'Remote headline',
    },
    source: {
      storageKey: 'workspace:remote',
    },
    savedAt: '2026-03-27T00:00:00.000Z',
  });

  return {
    ...base,
    ...overrides,
    document: overrides.document ?? base.document,
    editor: overrides.editor ?? base.editor,
    sceneRevisions: overrides.sceneRevisions ?? base.sceneRevisions,
    source: overrides.source ?? base.source,
  };
}

function createSceneComposition(): MotionCompositionDefV2 {
  return {
    id: 'scene-http-demo',
    title: 'Scene HTTP Demo',
    description: 'Scene route integration fixture',
    durationMs: 4000,
    parameters: [
      {
        id: 'headline',
        label: 'Headline',
        type: 'text',
        defaultValue: 'Scene headline',
      },
    ],
    cuePresets: [
      {
        id: 'fade-in',
        label: 'Fade In',
        kind: 'fade',
        durationMs: 240,
      },
    ],
    assets: [],
    targets: [
      {
        id: 'hero-target',
        target: { kind: 'stage-node', nodeId: 'hero' },
        content: { type: 'dom' },
      },
      {
        id: 'cta-target',
        target: { kind: 'stage-node', nodeId: 'cta' },
        content: { type: 'dom' },
      },
      {
        id: 'badge-target',
        target: { kind: 'stage-node', nodeId: 'badge' },
        content: { type: 'dom' },
      },
    ],
    scenes: [
      {
        id: 'scene-a',
        title: 'Scene A',
        startMs: 0,
        durationMs: 1800,
        layers: [
          {
            targetId: 'hero-target',
            startMs: 0,
            durationMs: 1800,
            enter: { preset: 'fade-in' },
          },
        ],
        sequences: [],
        captions: [],
      },
      {
        id: 'scene-b',
        title: 'Scene B',
        startMs: 1800,
        durationMs: 2200,
        layers: [
          {
            targetId: 'cta-target',
            startMs: 0,
            durationMs: 2200,
            enter: { preset: 'fade-in' },
          },
        ],
        sequences: [],
        captions: [],
      },
    ],
  };
}

function createSceneWorkspaceSnapshot(
  overrides: Partial<MotionWorkspaceSnapshotV2> = {},
): MotionWorkspaceSnapshotV2 {
  const base = createMotionWorkspaceSnapshot({
    composition: createSceneComposition(),
    values: {
      headline: 'Scene route headline',
    },
    source: {
      storageKey: 'workspace:scene-routes',
    },
    savedAt: '2026-03-27T00:00:00.000Z',
  });

  return {
    ...base,
    ...overrides,
    document: overrides.document ?? base.document,
    editor: overrides.editor ?? base.editor,
    sceneRevisions: overrides.sceneRevisions ?? base.sceneRevisions,
    source: overrides.source ?? base.source,
  };
}

function getScene(workspace: MotionWorkspaceSnapshotV2, sceneId: string): MotionSceneDef {
  if (workspace.document.schemaVersion !== 'qa-sdk.motion-composition/v2') {
    throw new Error(`scene document가 아닙니다: ${workspace.document.schemaVersion}`);
  }

  const scene = workspace.document.composition.scenes.find((entry) => entry.id === sceneId);
  if (!scene) {
    throw new Error(`scene를 찾을 수 없습니다: ${sceneId}`);
  }

  return scene;
}

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const path = tempDirs.pop();
    if (path) {
      rmSync(path, { recursive: true, force: true });
    }
  }
});

function createTestApp(options: Omit<MotionWorkspaceAppDeps, 'repository'> = {}) {
  const tempDir = mkdtempSync(join(tmpdir(), 'motion-workspace-service-'));
  tempDirs.push(tempDir);

  const repository = createMotionWorkspaceRepository({
    path: join(tempDir, 'workspace.sqlite'),
  });
  const app = createApp({
    repository,
    version: 'test-build',
    getUptimeSeconds: () => 12,
    ...options,
  });

  return { app, repository };
}

class FakeWsContext {
  readonly messages: string[] = [];

  send(message: string): void {
    this.messages.push(message);
  }
}

function createWsContext(workspaceId: string, userId: string) {
  return {
    req: {
      param(name: string) {
        return name === 'id' ? workspaceId : undefined;
      },
      query(name: string) {
        return name === 'userId' ? userId : undefined;
      },
    },
  } as Parameters<typeof createWorkspaceWsEvents>[0];
}

describe('motion workspace service health and CRUD routes', () => {
  it('reports health and repository readiness', async () => {
    const { app, repository } = createTestApp();

    const response = await app.request('/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      service: 'motion-workspace-service',
      default_persistence: 'sqlite',
      uptime_seconds: 12,
      version: 'test-build',
    });

    repository.close();
  });

  it('creates, lists, reads, updates, and deletes workspaces over HTTP', async () => {
    const { app, repository } = createTestApp();
    const workspaceId = 'demo/workspace-1';
    const workspacePath = `/workspaces/${encodeURIComponent(workspaceId)}`;
    const initial = createWorkspaceSnapshot();

    const createResponse = await app.request(workspacePath, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace: initial }),
    });
    expect(createResponse.status).toBe(200);
    expect(await createResponse.json()).toEqual({ workspace: initial });

    const listResponse = await app.request('/workspaces');
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual({
      workspaces: [
        {
          id: workspaceId,
          title: initial.document.composition.title,
          revision: initial.globalRevision,
          savedAt: initial.savedAt,
        },
      ],
    });

    const getResponse = await app.request(workspacePath);
    expect(getResponse.status).toBe(200);
    expect(await getResponse.json()).toEqual({ workspace: initial });

    const updated = createWorkspaceSnapshot({
      globalRevision: 1,
      savedAt: '2026-03-27T01:00:00.000Z',
      editor: {
        ...initial.editor,
        values: {
          ...initial.editor.values,
          headline: 'Remote headline v2',
        },
      },
    });

    const updateResponse = await app.request(workspacePath, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace: updated }),
    });
    expect(updateResponse.status).toBe(200);
    expect(await updateResponse.json()).toEqual({ workspace: updated });

    const deleteResponse = await app.request(workspacePath, {
      method: 'DELETE',
    });
    expect(deleteResponse.status).toBe(204);

    const missingResponse = await app.request(workspacePath);
    expect(missingResponse.status).toBe(404);
    expect(await missingResponse.json()).toEqual({
      code: 'workspace_not_found',
      message: `workspace를 찾을 수 없습니다: ${workspaceId}.`,
      id: workspaceId,
    });

    repository.close();
  });

  it('upgrades legacy workspace payloads to scene-based v2 snapshots on create/load', async () => {
    const { app, repository } = createTestApp();
    const workspaceId = 'demo/workspace-legacy';
    const workspacePath = `/workspaces/${encodeURIComponent(workspaceId)}`;
    const legacyComposition = createPromoGridComposition('lift');
    const legacyWorkspaceBase = createMotionWorkspaceSnapshotV1({
      composition: legacyComposition,
      values: {
        headline: 'Legacy headline',
      },
      source: {
        storageKey: 'workspace:legacy-http',
      },
      savedAt: '2026-03-27T00:00:00.000Z',
    });
    const legacyWorkspace = {
      ...legacyWorkspaceBase,
      revision: 2,
      editor: {
        ...legacyWorkspaceBase.editor,
        selection: {
          kind: 'layer',
          id: 'headline',
        } as const,
      },
    };

    const createResponse = await app.request(workspacePath, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace: legacyWorkspace }),
    });

    expect(createResponse.status).toBe(200);
    expect(await createResponse.json()).toMatchObject({
      workspace: {
        schemaVersion: 'qa-sdk.motion-workspace/v2',
        globalRevision: 2,
        sceneRevisions: {
          main: 2,
        },
        document: {
          schemaVersion: 'qa-sdk.motion-composition/v2',
          composition: {
            scenes: [
              {
                id: 'main',
                title: 'Main',
              },
            ],
          },
        },
        editor: {
          values: {
            headline: 'Legacy headline',
          },
          selection: {
            kind: 'scene-layer',
            sceneId: 'main',
            targetId: 'headline',
          },
        },
        source: {
          storageKey: 'workspace:legacy-http',
        },
      },
    });

    const getResponse = await app.request(workspacePath);
    expect(getResponse.status).toBe(200);
    expect(await getResponse.json()).toMatchObject({
      workspace: {
        schemaVersion: 'qa-sdk.motion-workspace/v2',
        globalRevision: 2,
        sceneRevisions: {
          main: 2,
        },
        document: {
          schemaVersion: 'qa-sdk.motion-composition/v2',
        },
      },
    });

    repository.close();
  });

  it('applies workspace commands over HTTP through the shared controller flow', async () => {
    const { app, repository } = createTestApp({
      getNow: () => '2026-03-27T02:30:00.000Z',
    });
    const workspaceId = 'demo/workspace-apply';
    const workspacePath = `/workspaces/${encodeURIComponent(workspaceId)}`;
    const initial = createWorkspaceSnapshot();

    const createResponse = await app.request(workspacePath, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace: initial }),
    });
    expect(createResponse.status).toBe(200);

    const applyResponse = await app.request(`${workspacePath}/apply-command`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        revision: initial.globalRevision,
        command: {
          type: 'set-parameter',
          parameterId: 'headline',
          value: 'Applied headline',
        },
      }),
    });
    expect(applyResponse.status).toBe(200);
    expect(await applyResponse.json()).toEqual({
      workspace: {
        ...initial,
        globalRevision: 0,
        savedAt: '2026-03-27T02:30:00.000Z',
        editor: {
          ...initial.editor,
          values: {
            ...initial.editor.values,
            headline: 'Applied headline',
          },
        },
      },
    });

    const getResponse = await app.request(workspacePath);
    expect(await getResponse.json()).toEqual({
      workspace: {
        ...initial,
        globalRevision: 0,
        savedAt: '2026-03-27T02:30:00.000Z',
        editor: {
          ...initial.editor,
          values: {
            ...initial.editor.values,
            headline: 'Applied headline',
          },
        },
      },
    });

    repository.close();
  });
});

describe('motion workspace service error responses', () => {
  it('returns flat JSON errors for malformed JSON, invalid bodies, and duplicate creates', async () => {
    const { app, repository } = createTestApp();
    const workspaceId = 'demo/workspace-2';
    const workspacePath = `/workspaces/${encodeURIComponent(workspaceId)}`;
    const workspace = createWorkspaceSnapshot();

    const malformedJson = await app.request(workspacePath, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    expect(malformedJson.status).toBe(400);
    expect(await malformedJson.json()).toMatchObject({
      code: 'invalid_json',
    });

    const invalidBody = await app.request(workspacePath, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(invalidBody.status).toBe(400);
    expect(await invalidBody.json()).toEqual({
      code: 'invalid_request',
      message: 'workspace 필드가 필요합니다.',
    });

    const firstCreate = await app.request(workspacePath, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace }),
    });
    expect(firstCreate.status).toBe(200);

    const duplicateCreate = await app.request(workspacePath, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace }),
    });
    expect(duplicateCreate.status).toBe(409);
    expect(await duplicateCreate.json()).toEqual({
      code: 'workspace_exists',
      message: `workspace가 이미 존재합니다: ${workspaceId}.`,
      id: workspaceId,
    });

    repository.close();
  });

  it('returns revision_conflict for stale apply-command revisions', async () => {
    const { app, repository } = createTestApp({
      getNow: () => '2026-03-27T03:00:00.000Z',
    });
    const workspaceId = 'demo/workspace-apply-conflict';
    const workspacePath = `/workspaces/${encodeURIComponent(workspaceId)}`;
    const workspace = createWorkspaceSnapshot();

    const createResponse = await app.request(workspacePath, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace }),
    });
    expect(createResponse.status).toBe(200);

    const applyResponse = await app.request(`${workspacePath}/apply-command`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        revision: workspace.globalRevision,
        command: {
          type: 'set-composition',
          composition: {
            ...createPromoGridComposition('lift'),
            id: 'promo-grid-conflict',
            title: 'Promo Grid Conflict',
          },
        },
      }),
    });
    expect(applyResponse.status).toBe(200);

    const staleApplyResponse = await app.request(`${workspacePath}/apply-command`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        revision: workspace.globalRevision,
        command: {
          type: 'set-composition',
          composition: {
            ...createPromoGridComposition('flash'),
            id: 'promo-grid-conflict-retry',
            title: 'Promo Grid Conflict Retry',
          },
        },
      }),
    });
    expect(staleApplyResponse.status).toBe(409);
    expect(await staleApplyResponse.json()).toEqual({
      code: 'revision_conflict',
      message: 'workspace revision이 충돌했습니다. expectedRevision=0, actualRevision=1.',
      expectedRevision: 0,
      actualRevision: 1,
    });

    repository.close();
  });
});

describe('motion workspace service scene routes', () => {
  it('lists, reads, updates, creates, and deletes scenes over HTTP', async () => {
    const { app, repository } = createTestApp({
      getNow: () => '2026-03-27T05:00:00.000Z',
    });
    const workspaceId = 'demo/workspace-scenes-http';
    const workspacePath = `/workspaces/${encodeURIComponent(workspaceId)}`;
    const initial = createSceneWorkspaceSnapshot();

    const createResponse = await app.request(workspacePath, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace: initial }),
    });
    expect(createResponse.status).toBe(200);

    const listResponse = await app.request(`${workspacePath}/scenes`);
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual({
      scenes: [
        {
          scene: getScene(initial, 'scene-a'),
          revision: 0,
        },
        {
          scene: getScene(initial, 'scene-b'),
          revision: 0,
        },
      ],
      globalRevision: 0,
    });

    const getResponse = await app.request(`${workspacePath}/scenes/scene-a`);
    expect(getResponse.status).toBe(200);
    expect(await getResponse.json()).toEqual({
      scene: getScene(initial, 'scene-a'),
      revision: 0,
      globalRevision: 0,
    });

    const updatedSceneA: MotionSceneDef = {
      ...getScene(initial, 'scene-a'),
      title: 'Scene A updated',
      durationMs: 2000,
    };
    const updateResponse = await app.request(`${workspacePath}/scenes/scene-a`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        revision: 0,
        scene: updatedSceneA,
      }),
    });
    expect(updateResponse.status).toBe(200);
    expect(await updateResponse.json()).toEqual({
      scene: updatedSceneA,
      revision: 1,
      globalRevision: 0,
    });

    const createdScene: MotionSceneDef = {
      id: 'scene-c',
      title: 'Scene C',
      startMs: 3200,
      durationMs: 800,
      layers: [
        {
          targetId: 'badge-target',
          startMs: 0,
          durationMs: 800,
          enter: { preset: 'fade-in' },
        },
      ],
      sequences: [],
      captions: [],
    };
    const createSceneResponse = await app.request(`${workspacePath}/scenes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        revision: 0,
        scene: createdScene,
      }),
    });
    expect(createSceneResponse.status).toBe(200);
    expect(await createSceneResponse.json()).toEqual({
      scene: createdScene,
      revision: 0,
      globalRevision: 1,
    });

    const listAfterCreate = await app.request(`${workspacePath}/scenes`);
    expect(listAfterCreate.status).toBe(200);
    expect(await listAfterCreate.json()).toEqual({
      scenes: [
        {
          scene: updatedSceneA,
          revision: 1,
        },
        {
          scene: getScene(initial, 'scene-b'),
          revision: 0,
        },
        {
          scene: createdScene,
          revision: 0,
        },
      ],
      globalRevision: 1,
    });

    const deleteSceneResponse = await app.request(`${workspacePath}/scenes/scene-b`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ revision: 1 }),
    });
    expect(deleteSceneResponse.status).toBe(200);
    expect(await deleteSceneResponse.json()).toEqual({
      deletedSceneId: 'scene-b',
      globalRevision: 2,
    });

    const deletedGetResponse = await app.request(`${workspacePath}/scenes/scene-b`);
    expect(deletedGetResponse.status).toBe(404);
    expect(await deletedGetResponse.json()).toEqual({
      code: 'scene_not_found',
      message: `scene를 찾을 수 없습니다: ${workspaceId}/scene-b.`,
      id: workspaceId,
      sceneId: 'scene-b',
    });

    repository.close();
  });

  it('returns a 409 scene revision_conflict for stale scene saves', async () => {
    const { app, repository } = createTestApp();
    const workspaceId = 'demo/workspace-scenes-conflict';
    const workspacePath = `/workspaces/${encodeURIComponent(workspaceId)}`;
    const initial = createSceneWorkspaceSnapshot();

    const createResponse = await app.request(workspacePath, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace: initial }),
    });
    expect(createResponse.status).toBe(200);

    const baselineScene: MotionSceneDef = {
      ...getScene(initial, 'scene-a'),
      title: 'Scene A baseline',
    };
    const firstSave = await app.request(`${workspacePath}/scenes/scene-a`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        revision: 0,
        scene: baselineScene,
      }),
    });
    expect(firstSave.status).toBe(200);

    const staleSave = await app.request(`${workspacePath}/scenes/scene-a`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        revision: 0,
        scene: {
          ...getScene(initial, 'scene-a'),
          title: 'Scene A stale retry',
        },
      }),
    });
    expect(staleSave.status).toBe(409);
    expect(await staleSave.json()).toEqual({
      code: 'revision_conflict',
      message:
        'scene revision이 충돌했습니다. sceneId=scene-a, expectedRevision=0, actualRevision=1.',
      sceneId: 'scene-a',
      expectedRevision: 0,
      actualRevision: 1,
    });

    repository.close();
  });
});

describe('motion workspace client roundtrip against real endpoints', () => {
  it('roundtrips typed CRUD calls through the service app', async () => {
    const { app, repository } = createTestApp();
    const client = new MotionWorkspaceClient({
      baseUrl: 'https://workspace.qa',
      fetch: (input, init) => {
        const url = new URL(input);
        return app.request(url.pathname, init);
      },
    });
    const workspaceId = 'demo/workspace 3';
    const initial = createWorkspaceSnapshot();

    expect(await client.list()).toEqual({ workspaces: [] });

    expect(await client.create(workspaceId, initial)).toEqual({
      workspace: initial,
    });
    expect(await client.get(workspaceId)).toEqual({
      workspace: initial,
    });

    const updated = createWorkspaceSnapshot({
      globalRevision: 1,
      savedAt: '2026-03-27T02:00:00.000Z',
      editor: {
        ...initial.editor,
        values: {
          ...initial.editor.values,
          headline: 'Client headline v2',
        },
      },
    });

    expect(await client.update(workspaceId, updated)).toEqual({
      workspace: updated,
    });
    expect(await client.list()).toEqual({
      workspaces: [
        {
          id: workspaceId,
          title: updated.document.composition.title,
          revision: updated.globalRevision,
          savedAt: updated.savedAt,
        },
      ],
    });

    await expect(client.delete(workspaceId)).resolves.toBeUndefined();

    let caught: unknown;
    try {
      await client.get(workspaceId);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(MotionWorkspaceClientError);
    expect(caught).toMatchObject({
      status: 404,
      payload: {
        code: 'workspace_not_found',
        id: workspaceId,
      },
    });

    repository.close();
  });

  it('roundtrips typed apply-command calls through the service app', async () => {
    const { app, repository } = createTestApp({
      getNow: () => '2026-03-27T04:00:00.000Z',
    });
    const client = new MotionWorkspaceClient({
      baseUrl: 'https://workspace.qa',
      fetch: (input, init) => {
        const url = new URL(input);
        return app.request(url.pathname, init);
      },
    });
    const workspaceId = 'demo/workspace apply';
    const initial = createWorkspaceSnapshot();

    await client.create(workspaceId, initial);

    const applied = await client.applyCommand(
      workspaceId,
      {
        type: 'set-composition',
        composition: {
          ...createPromoGridComposition('lift'),
          id: 'promo-grid-client',
          title: 'Promo Grid Client',
        },
      },
      initial.globalRevision,
    );

    expect(applied).toMatchObject({
      workspace: {
        schemaVersion: 'qa-sdk.motion-workspace/v2',
        globalRevision: 1,
        sceneRevisions: {
          main: 1,
        },
        savedAt: '2026-03-27T04:00:00.000Z',
        document: {
          schemaVersion: 'qa-sdk.motion-composition/v2',
          composition: {
            id: 'promo-grid-client',
            title: 'Promo Grid Client',
            scenes: [
              {
                id: 'main',
                title: 'Main',
              },
            ],
          },
        },
      },
    });
    expect(await client.get(workspaceId)).toEqual(applied);

    let caught: unknown;
    try {
      await client.applyCommand(
        workspaceId,
        {
          type: 'set-composition',
          composition: {
            ...createPromoGridComposition('flash'),
            id: 'promo-grid-client-stale',
            title: 'Promo Grid Client Stale',
          },
        },
        initial.globalRevision,
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(MotionWorkspaceClientError);
    expect(isMotionWorkspaceConflictError(caught)).toBe(true);
    expect(caught).toMatchObject({
      status: 409,
      payload: {
        code: 'revision_conflict',
        expectedRevision: 0,
        actualRevision: 1,
      },
    });

    repository.close();
  });
});

describe('motion workspace service websocket routes', () => {
  it('registers GET /workspaces/:id/ws on the app', () => {
    const { app, repository } = createTestApp();
    expect(app.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'GET',
          path: '/workspaces/:id/ws',
        }),
      ]),
    );
    repository.close();
  });

  it('broadcasts scene/resource notifications and clients can pull the latest data over HTTP', async () => {
    const { app, repository } = createTestApp({
      getNow: () => '2026-03-27T06:00:00.000Z',
    });
    const client = new MotionWorkspaceClient({
      baseUrl: 'https://workspace.qa',
      fetch: (input, init) => {
        const url = new URL(input);
        return app.request(url.pathname, init);
      },
    });
    const workspaceId = 'demo/workspace-notify';
    const workspacePath = `/workspaces/${encodeURIComponent(workspaceId)}`;
    const initial = createSceneWorkspaceSnapshot();
    const wsSocket = new FakeWsContext();
    const wsEvents = createWorkspaceWsEvents(createWsContext(workspaceId, 'alice'), app.wsHub);

    await client.create(workspaceId, initial);
    wsEvents.onOpen?.(new Event('open'), wsSocket as never);

    const updatedSceneA: MotionSceneDef = {
      ...getScene(initial, 'scene-a'),
      title: 'Scene A remote updated',
      durationMs: 2100,
    };
    const sceneSaveResponse = await app.request(`${workspacePath}/scenes/scene-a`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        revision: 0,
        scene: updatedSceneA,
      }),
    });
    expect(sceneSaveResponse.status).toBe(200);
    expect(JSON.parse(wsSocket.messages[1]!)).toEqual({
      type: 'scene:updated',
      workspaceId,
      sceneId: 'scene-a',
      revision: 1,
    });
    expect(await client.getScene(workspaceId, 'scene-a')).toEqual({
      scene: updatedSceneA,
      revision: 1,
      globalRevision: 0,
    });

    const createdScene: MotionSceneDef = {
      id: 'scene-c',
      title: 'Scene C',
      startMs: 3200,
      durationMs: 800,
      layers: [
        {
          targetId: 'badge-target',
          startMs: 0,
          durationMs: 800,
          enter: { preset: 'fade-in' },
        },
      ],
      sequences: [],
      captions: [],
    };
    const createSceneResponse = await app.request(`${workspacePath}/scenes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        revision: 0,
        scene: createdScene,
      }),
    });
    expect(createSceneResponse.status).toBe(200);
    expect(JSON.parse(wsSocket.messages[2]!)).toEqual({
      type: 'resource:updated',
      workspaceId,
      revision: 1,
    });

    const workspaceAfterCreate = (await client.get(workspaceId)).workspace;
    if (workspaceAfterCreate.document.schemaVersion !== 'qa-sdk.motion-composition/v2') {
      throw new Error(`scene document가 아닙니다: ${workspaceAfterCreate.document.schemaVersion}`);
    }

    const resourceUpdatedWorkspace: MotionWorkspaceSnapshotV2 = {
      ...workspaceAfterCreate,
      globalRevision: workspaceAfterCreate.globalRevision + 1,
      document: {
        ...workspaceAfterCreate.document,
        composition: {
          ...workspaceAfterCreate.document.composition,
          parameters: workspaceAfterCreate.document.composition.parameters.map((parameter) =>
            parameter.id === 'headline'
              ? Object.assign({}, parameter, { label: 'Headline v2' })
              : parameter,
          ),
        },
      },
    };
    const resourceUpdateResponse = await app.request(workspacePath, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace: resourceUpdatedWorkspace }),
    });
    expect(resourceUpdateResponse.status).toBe(200);
    expect(JSON.parse(wsSocket.messages[3]!)).toEqual({
      type: 'resource:updated',
      workspaceId,
      revision: 2,
    });

    const pulledWorkspace = await client.get(workspaceId);
    if (pulledWorkspace.workspace.document.schemaVersion !== 'qa-sdk.motion-composition/v2') {
      throw new Error(
        `scene document가 아닙니다: ${pulledWorkspace.workspace.document.schemaVersion}`,
      );
    }
    expect(pulledWorkspace.workspace.document.composition.parameters[0]).toMatchObject({
      id: 'headline',
      label: 'Headline v2',
    });

    repository.close();
  });

  it('broadcasts messages and cleans up connections through workspace ws events', () => {
    const workspaceId = 'demo/workspace-live-ws';
    const otherWorkspaceId = 'demo/workspace-live-ws-other';
    const hub = createWorkspaceWsHub();
    const aliceSocket = new FakeWsContext();
    const bobSocket = new FakeWsContext();
    const carolSocket = new FakeWsContext();

    const aliceEvents = createWorkspaceWsEvents(createWsContext(workspaceId, 'alice'), hub);
    const bobEvents = createWorkspaceWsEvents(createWsContext(workspaceId, 'bob'), hub);
    const carolEvents = createWorkspaceWsEvents(createWsContext(otherWorkspaceId, 'carol'), hub);

    aliceEvents.onOpen?.(new Event('open'), aliceSocket as never);
    expect(JSON.parse(aliceSocket.messages[0]!)).toEqual({
      type: 'connected',
      workspaceId,
      userId: 'alice',
      sceneLocks: [],
      presences: [],
    });

    aliceEvents.onMessage?.(
      {
        data: JSON.stringify({
          type: 'scene:lock',
          sceneId: 'scene-a',
          userId: 'alice',
        }),
      } as MessageEvent,
      aliceSocket as never,
    );

    expect(JSON.parse(aliceSocket.messages[1]!)).toEqual({
      type: 'scene:lock',
      workspaceId,
      sceneId: 'scene-a',
      userId: 'alice',
      holders: ['alice'],
      warning: false,
    });

    aliceEvents.onMessage?.(
      {
        data: JSON.stringify({
          type: 'presence',
          userId: 'alice',
          activeSceneId: 'scene-a',
          cursor: { x: 120, y: 44 },
        }),
      } as MessageEvent,
      aliceSocket as never,
    );

    expect(JSON.parse(aliceSocket.messages[2]!)).toEqual({
      type: 'presence',
      workspaceId,
      userId: 'alice',
      activeSceneId: 'scene-a',
      cursor: { x: 120, y: 44 },
    });

    bobEvents.onOpen?.(new Event('open'), bobSocket as never);
    carolEvents.onOpen?.(new Event('open'), carolSocket as never);

    expect(JSON.parse(bobSocket.messages[0]!)).toEqual({
      type: 'connected',
      workspaceId,
      userId: 'bob',
      sceneLocks: [
        {
          sceneId: 'scene-a',
          userId: 'alice',
        },
      ],
      presences: [
        {
          userId: 'alice',
          activeSceneId: 'scene-a',
          cursor: { x: 120, y: 44 },
        },
      ],
    });
    expect(JSON.parse(carolSocket.messages[0]!)).toEqual({
      type: 'connected',
      workspaceId: otherWorkspaceId,
      userId: 'carol',
      sceneLocks: [],
      presences: [],
    });
    expect(hub.getWorkspaceConnectionCount(workspaceId)).toBe(2);
    expect(hub.getWorkspaceConnectionCount(otherWorkspaceId)).toBe(1);

    bobEvents.onMessage?.(
      {
        data: JSON.stringify({
          type: 'scene:lock',
          sceneId: 'scene-a',
          userId: 'bob',
        }),
      } as MessageEvent,
      bobSocket as never,
    );

    expect(JSON.parse(aliceSocket.messages[3]!)).toEqual({
      type: 'scene:lock',
      workspaceId,
      sceneId: 'scene-a',
      userId: 'bob',
      holders: ['alice', 'bob'],
      warning: true,
    });
    expect(JSON.parse(bobSocket.messages[1]!)).toEqual({
      type: 'scene:lock',
      workspaceId,
      sceneId: 'scene-a',
      userId: 'bob',
      holders: ['alice', 'bob'],
      warning: true,
    });

    aliceEvents.onMessage?.(
      {
        data: JSON.stringify({
          type: 'cursor-update',
          x: 120,
          y: 44,
        }),
      } as MessageEvent,
      aliceSocket as never,
    );

    expect(JSON.parse(aliceSocket.messages[4]!)).toEqual({
      type: 'workspace-message',
      workspaceId,
      userId: 'alice',
      payload: {
        type: 'cursor-update',
        x: 120,
        y: 44,
      },
    });
    expect(JSON.parse(bobSocket.messages[2]!)).toEqual({
      type: 'workspace-message',
      workspaceId,
      userId: 'alice',
      payload: {
        type: 'cursor-update',
        x: 120,
        y: 44,
      },
    });
    expect(carolSocket.messages).toHaveLength(1);

    aliceEvents.onClose?.(new Event('close'), aliceSocket as never);
    expect(hub.getWorkspaceConnectionCount(workspaceId)).toBe(1);
    expect(JSON.parse(bobSocket.messages[3]!)).toEqual({
      type: 'presence',
      workspaceId,
      userId: 'alice',
    });
    expect(JSON.parse(bobSocket.messages[4]!)).toEqual({
      type: 'scene:unlock',
      workspaceId,
      sceneId: 'scene-a',
      userId: 'alice',
      holders: ['bob'],
      reason: 'disconnect',
    });

    carolEvents.onError?.(new Event('error'), carolSocket as never);
    expect(hub.getWorkspaceConnectionCount(otherWorkspaceId)).toBe(0);

    bobEvents.onClose?.(new Event('close'), bobSocket as never);
    expect(hub.getWorkspaceConnectionCount(workspaceId)).toBe(0);
  });
});
