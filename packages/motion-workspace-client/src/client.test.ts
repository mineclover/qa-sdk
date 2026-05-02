import { afterEach, describe, expect, it } from "vitest";
import {
  createPromoGridComposition,
  type MotionCompositionDefV2,
  type MotionSceneDef,
} from "motion-content";
import {
  createMotionWorkspaceSnapshot,
  type MotionWorkspaceSnapshotV2,
} from "motion-workspace";
import {
  MotionWorkspaceClient,
  MotionWorkspaceClientError,
  isMotionWorkspaceConflictError,
  isMotionWorkspaceConflictErrorShape,
  isMotionWorkspaceSceneConflictError,
  isMotionWorkspaceSceneConflictErrorShape,
} from "./client.js";
import type {
  MotionWorkspaceClientFetch,
  MotionWorkspaceClientRequestInit,
  MotionWorkspaceClientResponse,
  MotionWorkspaceConflictErrorShape,
  MotionWorkspaceSceneConflictErrorShape,
} from "./types.js";

interface RecordedRequest {
  readonly input: string;
  readonly init?: MotionWorkspaceClientRequestInit;
}

const originalFetch = globalThis.fetch;

function createMockResponse(status: number, payload?: unknown): MotionWorkspaceClientResponse {
  const body = payload === undefined
    ? ""
    : typeof payload === "string"
      ? payload
      : JSON.stringify(payload);

  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload ?? null;
    },
    async text() {
      return body;
    },
  };
}

function createFetchHarness(responses: readonly MotionWorkspaceClientResponse[]) {
  const queue = [...responses];
  const requests: RecordedRequest[] = [];

  const fetch: MotionWorkspaceClientFetch = async (input, init) => {
    requests.push({ input, init });
    const response = queue.shift();
    if (!response) {
      throw new Error(`Mock fetch response가 부족합니다: ${input}`);
    }
    return response;
  };

  return { fetch, requests };
}

function createWorkspaceSnapshot(): MotionWorkspaceSnapshotV2 {
  return createMotionWorkspaceSnapshot({
    composition: createPromoGridComposition("flash"),
    values: {
      headline: "Remote headline",
    },
    source: {
      storageKey: "workspace:remote",
    },
    savedAt: "2026-03-27T00:00:00.000Z",
  });
}

function createSceneComposition(): MotionCompositionDefV2 {
  return {
    id: "scene-client-demo",
    title: "Scene Client Demo",
    description: "Scene client fixture",
    durationMs: 4000,
    parameters: [
      {
        id: "headline",
        label: "Headline",
        type: "text",
        defaultValue: "Scene headline",
      },
    ],
    cuePresets: [
      {
        id: "fade-in",
        label: "Fade In",
        kind: "fade",
        durationMs: 240,
      },
    ],
    assets: [],
    targets: [
      {
        id: "hero-target",
        target: { kind: "stage-node", nodeId: "hero" },
        content: { type: "dom" },
      },
      {
        id: "cta-target",
        target: { kind: "stage-node", nodeId: "cta" },
        content: { type: "dom" },
      },
      {
        id: "badge-target",
        target: { kind: "stage-node", nodeId: "badge" },
        content: { type: "dom" },
      },
    ],
    scenes: [
      {
        id: "scene-a",
        title: "Scene A",
        startMs: 0,
        durationMs: 1800,
        layers: [
          {
            targetId: "hero-target",
            startMs: 0,
            durationMs: 1800,
            enter: { preset: "fade-in" },
          },
        ],
        sequences: [],
        captions: [],
      },
      {
        id: "scene-b",
        title: "Scene B",
        startMs: 1800,
        durationMs: 2200,
        layers: [
          {
            targetId: "cta-target",
            startMs: 0,
            durationMs: 2200,
            enter: { preset: "fade-in" },
          },
        ],
        sequences: [],
        captions: [],
      },
    ],
  };
}

function createSceneWorkspaceSnapshot(): MotionWorkspaceSnapshotV2 {
  return createMotionWorkspaceSnapshot({
    composition: createSceneComposition(),
    values: {
      headline: "Scene route headline",
    },
    source: {
      storageKey: "workspace:scene-client",
    },
    savedAt: "2026-03-27T00:00:00.000Z",
  });
}

function getScene(
  workspace: MotionWorkspaceSnapshotV2,
  sceneId: string,
): MotionSceneDef {
  if (workspace.document.schemaVersion !== "qa-sdk.motion-composition/v2") {
    throw new Error(`scene document가 아닙니다: ${workspace.document.schemaVersion}`);
  }

  const scene = workspace.document.composition.scenes.find((entry) => entry.id === sceneId);
  if (!scene) {
    throw new Error(`scene를 찾을 수 없습니다: ${sceneId}`);
  }

  return scene;
}

afterEach(() => {
  Object.defineProperty(globalThis, "fetch", {
    value: originalFetch,
    configurable: true,
    writable: true,
  });
});

describe("motion workspace client CRUD", () => {
  it("sends typed list/get/create/update/delete requests through an injected fetch implementation", async () => {
    const workspace = createWorkspaceSnapshot();
    const { fetch, requests } = createFetchHarness([
      createMockResponse(200, {
        workspaces: [
          {
            id: "demo/workspace 1",
            title: workspace.document.composition.title,
            revision: workspace.globalRevision,
            savedAt: workspace.savedAt,
          },
        ],
      }),
      createMockResponse(200, { workspace }),
      createMockResponse(200, { workspace }),
      createMockResponse(200, { workspace }),
      createMockResponse(204),
    ]);
    const client = new MotionWorkspaceClient({
      baseUrl: "https://workspace.qa/api/",
      fetch,
    });

    const listed = await client.list();
    const loaded = await client.get("demo/workspace 1");
    const created = await client.create("demo/workspace 1", workspace);
    const updated = await client.update("demo/workspace 1", workspace);
    const deleted = await client.delete("demo/workspace 1");

    expect(listed).toEqual({
      workspaces: [
        {
          id: "demo/workspace 1",
          title: workspace.document.composition.title,
          revision: workspace.globalRevision,
          savedAt: workspace.savedAt,
        },
      ],
    });
    expect(loaded).toEqual({ workspace });
    expect(created).toEqual({ workspace });
    expect(updated).toEqual({ workspace });
    expect(deleted).toBeUndefined();

    expect(requests).toEqual([
      {
        input: "https://workspace.qa/api/workspaces",
        init: {
          method: "GET",
          headers: {},
          body: undefined,
        },
      },
      {
        input: "https://workspace.qa/api/workspaces/demo%2Fworkspace%201",
        init: {
          method: "GET",
          headers: {},
          body: undefined,
        },
      },
      {
        input: "https://workspace.qa/api/workspaces/demo%2Fworkspace%201",
        init: {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ workspace }),
        },
      },
      {
        input: "https://workspace.qa/api/workspaces/demo%2Fworkspace%201",
        init: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ workspace }),
        },
      },
      {
        input: "https://workspace.qa/api/workspaces/demo%2Fworkspace%201",
        init: {
          method: "DELETE",
          headers: {},
          body: undefined,
        },
      },
    ]);
  });

  it("falls back to global fetch so browser and modern Node runtimes can share the same client surface", async () => {
    const workspace = createWorkspaceSnapshot();
    const { fetch, requests } = createFetchHarness([
      createMockResponse(200, { workspace }),
    ]);
    Object.defineProperty(globalThis, "fetch", {
      value: fetch as typeof globalThis.fetch,
      configurable: true,
      writable: true,
    });

    const client = new MotionWorkspaceClient({
      baseUrl: "https://workspace.qa/api",
    });

    const loaded = await client.get("browser-runtime");

    expect(loaded).toEqual({ workspace });
    expect(requests).toEqual([
      {
        input: "https://workspace.qa/api/workspaces/browser-runtime",
        init: {
          method: "GET",
          headers: {},
          body: undefined,
        },
      },
    ]);
  });

  it("throws a concrete request error when no fetch implementation is available", async () => {
    Object.defineProperty(globalThis, "fetch", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const client = new MotionWorkspaceClient({
      baseUrl: "https://workspace.qa/api",
    });

    await expect(client.get("missing-fetch")).rejects.toThrowError(
      "global fetch가 없어 MotionWorkspaceClient를 초기화할 수 없습니다.",
    );
  });
});

describe("motion workspace client apply-command and conflict handling", () => {
  it("posts apply-command requests with revision and editor command payload", async () => {
    const workspace = createWorkspaceSnapshot();
    const nextWorkspace = {
      ...workspace,
      globalRevision: workspace.globalRevision + 1,
    };
    const { fetch, requests } = createFetchHarness([
      createMockResponse(200, { workspace: nextWorkspace }),
    ]);
    const client = new MotionWorkspaceClient({
      baseUrl: "https://workspace.qa/api/",
      fetch,
    });

    const command = {
      type: "set-parameter",
      parameterId: "headline",
      value: "Remote headline v2",
    } as const;

    const applied = await client.applyCommand("demo/workspace 1", command, workspace.globalRevision);

    expect(applied).toEqual({ workspace: nextWorkspace });
    expect(requests).toEqual([
      {
        input: "https://workspace.qa/api/workspaces/demo%2Fworkspace%201/apply-command",
        init: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            revision: workspace.globalRevision,
            command,
          }),
        },
      },
    ]);
  });

  it("exposes a serializable revision conflict shape for optimistic concurrency callers", async () => {
    const workspace = createWorkspaceSnapshot();
    const conflict: MotionWorkspaceConflictErrorShape = {
      code: "revision_conflict",
      message: "workspace revision이 충돌했습니다. expectedRevision=1, actualRevision=2.",
      expectedRevision: 1,
      actualRevision: 2,
    };
    const { fetch } = createFetchHarness([
      createMockResponse(409, conflict),
    ]);
    const client = new MotionWorkspaceClient({
      baseUrl: "https://workspace.qa/api",
      fetch,
    });

    let caught: unknown;
    try {
      await client.applyCommand("demo/workspace 1", {
        type: "set-parameter",
        parameterId: "headline",
        value: "Conflict headline",
      }, workspace.globalRevision);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(MotionWorkspaceClientError);
    expect(isMotionWorkspaceConflictError(caught)).toBe(true);
    expect(isMotionWorkspaceConflictErrorShape(conflict)).toBe(true);

    const error = caught as MotionWorkspaceClientError;
    expect(error.status).toBe(409);
    expect(error.message).toBe(conflict.message);
    expect(error.payload).toEqual(conflict);
    expect(error.toJSON()).toEqual({
      name: "MotionWorkspaceClientError",
      message: conflict.message,
      status: 409,
      payload: conflict,
    });
  });
});

describe("motion workspace client scene CRUD", () => {
  it("sends typed scene list/get/update/create/delete requests through an injected fetch implementation", async () => {
    const workspace = createSceneWorkspaceSnapshot();
    const updatedScene: MotionSceneDef = {
      ...getScene(workspace, "scene-a"),
      title: "Scene A updated",
      durationMs: 2000,
    };
    const createdScene: MotionSceneDef = {
      id: "scene-c",
      title: "Scene C",
      startMs: 3200,
      durationMs: 800,
      layers: [
        {
          targetId: "badge-target",
          startMs: 0,
          durationMs: 800,
          enter: { preset: "fade-in" },
        },
      ],
      sequences: [],
      captions: [],
    };
    const { fetch, requests } = createFetchHarness([
      createMockResponse(200, {
        scenes: [
          {
            scene: getScene(workspace, "scene-a"),
            revision: 0,
          },
          {
            scene: getScene(workspace, "scene-b"),
            revision: 0,
          },
        ],
        globalRevision: 0,
      }),
      createMockResponse(200, {
        scene: getScene(workspace, "scene-a"),
        revision: 0,
        globalRevision: 0,
      }),
      createMockResponse(200, {
        scene: updatedScene,
        revision: 1,
        globalRevision: 0,
      }),
      createMockResponse(200, {
        scene: createdScene,
        revision: 0,
        globalRevision: 1,
      }),
      createMockResponse(200, {
        deletedSceneId: "scene-b",
        globalRevision: 2,
      }),
    ]);
    const client = new MotionWorkspaceClient({
      baseUrl: "https://workspace.qa/api/",
      fetch,
    });

    const listed = await client.listScenes("demo/workspace 1");
    const loaded = await client.getScene("demo/workspace 1", "scene-a");
    const updated = await client.updateScene("demo/workspace 1", "scene-a", updatedScene, 0);
    const created = await client.createScene("demo/workspace 1", createdScene, 0);
    const deleted = await client.deleteScene("demo/workspace 1", "scene-b", 1);

    expect(listed).toEqual({
      scenes: [
        {
          scene: getScene(workspace, "scene-a"),
          revision: 0,
        },
        {
          scene: getScene(workspace, "scene-b"),
          revision: 0,
        },
      ],
      globalRevision: 0,
    });
    expect(loaded).toEqual({
      scene: getScene(workspace, "scene-a"),
      revision: 0,
      globalRevision: 0,
    });
    expect(updated).toEqual({
      scene: updatedScene,
      revision: 1,
      globalRevision: 0,
    });
    expect(created).toEqual({
      scene: createdScene,
      revision: 0,
      globalRevision: 1,
    });
    expect(deleted).toEqual({
      deletedSceneId: "scene-b",
      globalRevision: 2,
    });

    expect(requests).toEqual([
      {
        input: "https://workspace.qa/api/workspaces/demo%2Fworkspace%201/scenes",
        init: {
          method: "GET",
          headers: {},
          body: undefined,
        },
      },
      {
        input: "https://workspace.qa/api/workspaces/demo%2Fworkspace%201/scenes/scene-a",
        init: {
          method: "GET",
          headers: {},
          body: undefined,
        },
      },
      {
        input: "https://workspace.qa/api/workspaces/demo%2Fworkspace%201/scenes/scene-a",
        init: {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            revision: 0,
            scene: updatedScene,
          }),
        },
      },
      {
        input: "https://workspace.qa/api/workspaces/demo%2Fworkspace%201/scenes",
        init: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            revision: 0,
            scene: createdScene,
          }),
        },
      },
      {
        input: "https://workspace.qa/api/workspaces/demo%2Fworkspace%201/scenes/scene-b",
        init: {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ revision: 1 }),
        },
      },
    ]);
  });

  it("detects typed scene revision_conflict payloads that include sceneId", async () => {
    const workspace = createSceneWorkspaceSnapshot();
    const conflict: MotionWorkspaceSceneConflictErrorShape = {
      code: "revision_conflict",
      message: "scene revision이 충돌했습니다. sceneId=scene-a, expectedRevision=0, actualRevision=1.",
      sceneId: "scene-a",
      expectedRevision: 0,
      actualRevision: 1,
    };
    const { fetch } = createFetchHarness([
      createMockResponse(409, conflict),
    ]);
    const client = new MotionWorkspaceClient({
      baseUrl: "https://workspace.qa/api",
      fetch,
    });

    let caught: unknown;
    try {
      await client.updateScene("demo/workspace 1", "scene-a", {
        ...getScene(workspace, "scene-a"),
        title: "Scene A stale retry",
      }, 0);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(MotionWorkspaceClientError);
    expect(isMotionWorkspaceConflictError(caught)).toBe(true);
    expect(isMotionWorkspaceSceneConflictError(caught)).toBe(true);
    expect(isMotionWorkspaceSceneConflictErrorShape(conflict)).toBe(true);

    const error = caught as MotionWorkspaceClientError;
    expect(error.status).toBe(409);
    expect(error.message).toBe(conflict.message);
    expect(error.payload).toEqual(conflict);
  });
});
