import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createPromoGridComposition } from "motion-content";
import {
  MotionWorkspaceClient,
  MotionWorkspaceClientError,
  isMotionWorkspaceConflictError,
} from "motion-workspace-client";
import {
  createMotionWorkspaceSnapshot,
  type MotionWorkspaceSnapshotV1,
} from "motion-workspace";
import { createApp, type MotionWorkspaceAppDeps } from "../src/app.js";
import { createMotionWorkspaceRepository } from "../src/sqlite-repository.js";

function createWorkspaceSnapshot(
  overrides: Partial<MotionWorkspaceSnapshotV1> = {},
): MotionWorkspaceSnapshotV1 {
  const base = createMotionWorkspaceSnapshot({
    composition: createPromoGridComposition("flash"),
    values: {
      headline: "Remote headline",
    },
    source: {
      storageKey: "workspace:remote",
    },
    savedAt: "2026-03-27T00:00:00.000Z",
  });

  return {
    ...base,
    ...overrides,
    document: overrides.document ?? base.document,
    editor: overrides.editor ?? base.editor,
    source: overrides.source ?? base.source,
  };
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

function createTestApp(
  options: Omit<MotionWorkspaceAppDeps, "repository"> = {},
) {
  const tempDir = mkdtempSync(join(tmpdir(), "motion-workspace-service-"));
  tempDirs.push(tempDir);

  const repository = createMotionWorkspaceRepository({
    path: join(tempDir, "workspace.sqlite"),
  });
  const app = createApp({
    repository,
    version: "test-build",
    getUptimeSeconds: () => 12,
    ...options,
  });

  return { app, repository };
}

describe("motion workspace service health and CRUD routes", () => {
  it("reports health and repository readiness", async () => {
    const { app, repository } = createTestApp();

    const response = await app.request("/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      service: "motion-workspace-service",
      default_persistence: "sqlite",
      uptime_seconds: 12,
      version: "test-build",
    });

    repository.close();
  });

  it("creates, lists, reads, updates, and deletes workspaces over HTTP", async () => {
    const { app, repository } = createTestApp();
    const workspaceId = "demo/workspace-1";
    const workspacePath = `/workspaces/${encodeURIComponent(workspaceId)}`;
    const initial = createWorkspaceSnapshot();

    const createResponse = await app.request(workspacePath, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace: initial }),
    });
    expect(createResponse.status).toBe(200);
    expect(await createResponse.json()).toEqual({ workspace: initial });

    const listResponse = await app.request("/workspaces");
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual({
      workspaces: [
        {
          id: workspaceId,
          title: initial.document.composition.title,
          revision: initial.revision,
          savedAt: initial.savedAt,
        },
      ],
    });

    const getResponse = await app.request(workspacePath);
    expect(getResponse.status).toBe(200);
    expect(await getResponse.json()).toEqual({ workspace: initial });

    const updated = createWorkspaceSnapshot({
      revision: 1,
      savedAt: "2026-03-27T01:00:00.000Z",
      editor: {
        ...initial.editor,
        values: {
          ...initial.editor.values,
          headline: "Remote headline v2",
        },
      },
    });

    const updateResponse = await app.request(workspacePath, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace: updated }),
    });
    expect(updateResponse.status).toBe(200);
    expect(await updateResponse.json()).toEqual({ workspace: updated });

    const deleteResponse = await app.request(workspacePath, {
      method: "DELETE",
    });
    expect(deleteResponse.status).toBe(204);

    const missingResponse = await app.request(workspacePath);
    expect(missingResponse.status).toBe(404);
    expect(await missingResponse.json()).toEqual({
      code: "workspace_not_found",
      message: `workspace를 찾을 수 없습니다: ${workspaceId}.`,
      id: workspaceId,
    });

    repository.close();
  });

  it("applies workspace commands over HTTP through the shared controller flow", async () => {
    const { app, repository } = createTestApp({
      getNow: () => "2026-03-27T02:30:00.000Z",
    });
    const workspaceId = "demo/workspace-apply";
    const workspacePath = `/workspaces/${encodeURIComponent(workspaceId)}`;
    const initial = createWorkspaceSnapshot();

    const createResponse = await app.request(workspacePath, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace: initial }),
    });
    expect(createResponse.status).toBe(200);

    const applyResponse = await app.request(`${workspacePath}/apply-command`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        revision: initial.revision,
        command: {
          type: "set-parameter",
          parameterId: "headline",
          value: "Applied headline",
        },
      }),
    });
    expect(applyResponse.status).toBe(200);
    expect(await applyResponse.json()).toEqual({
      workspace: {
        ...initial,
        revision: 1,
        savedAt: "2026-03-27T02:30:00.000Z",
        editor: {
          ...initial.editor,
          values: {
            ...initial.editor.values,
            headline: "Applied headline",
          },
        },
      },
    });

    const getResponse = await app.request(workspacePath);
    expect(await getResponse.json()).toEqual({
      workspace: {
        ...initial,
        revision: 1,
        savedAt: "2026-03-27T02:30:00.000Z",
        editor: {
          ...initial.editor,
          values: {
            ...initial.editor.values,
            headline: "Applied headline",
          },
        },
      },
    });

    repository.close();
  });
});

describe("motion workspace service error responses", () => {
  it("returns flat JSON errors for malformed JSON, invalid bodies, and duplicate creates", async () => {
    const { app, repository } = createTestApp();
    const workspaceId = "demo/workspace-2";
    const workspacePath = `/workspaces/${encodeURIComponent(workspaceId)}`;
    const workspace = createWorkspaceSnapshot();

    const malformedJson = await app.request(workspacePath, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    expect(malformedJson.status).toBe(400);
    expect(await malformedJson.json()).toMatchObject({
      code: "invalid_json",
    });

    const invalidBody = await app.request(workspacePath, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(invalidBody.status).toBe(400);
    expect(await invalidBody.json()).toEqual({
      code: "invalid_request",
      message: "workspace 필드가 필요합니다.",
    });

    const firstCreate = await app.request(workspacePath, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace }),
    });
    expect(firstCreate.status).toBe(200);

    const duplicateCreate = await app.request(workspacePath, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace }),
    });
    expect(duplicateCreate.status).toBe(409);
    expect(await duplicateCreate.json()).toEqual({
      code: "workspace_exists",
      message: `workspace가 이미 존재합니다: ${workspaceId}.`,
      id: workspaceId,
    });

    repository.close();
  });

  it("returns revision_conflict for stale apply-command revisions", async () => {
    const { app, repository } = createTestApp({
      getNow: () => "2026-03-27T03:00:00.000Z",
    });
    const workspaceId = "demo/workspace-apply-conflict";
    const workspacePath = `/workspaces/${encodeURIComponent(workspaceId)}`;
    const workspace = createWorkspaceSnapshot();

    const createResponse = await app.request(workspacePath, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace }),
    });
    expect(createResponse.status).toBe(200);

    const applyResponse = await app.request(`${workspacePath}/apply-command`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        revision: workspace.revision,
        command: {
          type: "set-parameter",
          parameterId: "headline",
          value: "Conflict baseline",
        },
      }),
    });
    expect(applyResponse.status).toBe(200);

    const staleApplyResponse = await app.request(`${workspacePath}/apply-command`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        revision: workspace.revision,
        command: {
          type: "set-parameter",
          parameterId: "headline",
          value: "Conflict retry",
        },
      }),
    });
    expect(staleApplyResponse.status).toBe(409);
    expect(await staleApplyResponse.json()).toEqual({
      code: "revision_conflict",
      message: "workspace revision이 충돌했습니다. expectedRevision=0, actualRevision=1.",
      expectedRevision: 0,
      actualRevision: 1,
    });

    repository.close();
  });
});

describe("motion workspace client roundtrip against real endpoints", () => {
  it("roundtrips typed CRUD calls through the service app", async () => {
    const { app, repository } = createTestApp();
    const client = new MotionWorkspaceClient({
      baseUrl: "https://workspace.qa",
      fetch: (input, init) => {
        const url = new URL(input);
        return app.request(url.pathname, init);
      },
    });
    const workspaceId = "demo/workspace 3";
    const initial = createWorkspaceSnapshot();

    expect(await client.list()).toEqual({ workspaces: [] });

    expect(await client.create(workspaceId, initial)).toEqual({
      workspace: initial,
    });
    expect(await client.get(workspaceId)).toEqual({
      workspace: initial,
    });

    const updated = createWorkspaceSnapshot({
      revision: 1,
      savedAt: "2026-03-27T02:00:00.000Z",
      editor: {
        ...initial.editor,
        values: {
          ...initial.editor.values,
          headline: "Client headline v2",
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
          revision: updated.revision,
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
        code: "workspace_not_found",
        id: workspaceId,
      },
    });

    repository.close();
  });

  it("roundtrips typed apply-command calls through the service app", async () => {
    const { app, repository } = createTestApp({
      getNow: () => "2026-03-27T04:00:00.000Z",
    });
    const client = new MotionWorkspaceClient({
      baseUrl: "https://workspace.qa",
      fetch: (input, init) => {
        const url = new URL(input);
        return app.request(url.pathname, init);
      },
    });
    const workspaceId = "demo/workspace apply";
    const initial = createWorkspaceSnapshot();

    await client.create(workspaceId, initial);

    const applied = await client.applyCommand(workspaceId, {
      type: "set-parameter",
      parameterId: "headline",
      value: "Client applied headline",
    }, initial.revision);

    expect(applied).toEqual({
      workspace: {
        ...initial,
        revision: 1,
        savedAt: "2026-03-27T04:00:00.000Z",
        editor: {
          ...initial.editor,
          values: {
            ...initial.editor.values,
            headline: "Client applied headline",
          },
        },
      },
    });
    expect(await client.get(workspaceId)).toEqual(applied);

    let caught: unknown;
    try {
      await client.applyCommand(workspaceId, {
        type: "set-parameter",
        parameterId: "headline",
        value: "Stale client headline",
      }, initial.revision);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(MotionWorkspaceClientError);
    expect(isMotionWorkspaceConflictError(caught)).toBe(true);
    expect(caught).toMatchObject({
      status: 409,
      payload: {
        code: "revision_conflict",
        expectedRevision: 0,
        actualRevision: 1,
      },
    });

    repository.close();
  });
});
