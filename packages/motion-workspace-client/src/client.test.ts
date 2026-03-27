import { afterEach, describe, expect, it } from "vitest";
import { createPromoGridComposition } from "motion-content";
import { createMotionWorkspaceSnapshot } from "motion-workspace";
import {
  MotionWorkspaceClient,
  MotionWorkspaceClientError,
  isMotionWorkspaceConflictError,
  isMotionWorkspaceConflictErrorShape,
} from "./client.js";
import type {
  MotionWorkspaceClientFetch,
  MotionWorkspaceClientRequestInit,
  MotionWorkspaceClientResponse,
  MotionWorkspaceConflictErrorShape,
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

function createWorkspaceSnapshot() {
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
            revision: workspace.revision,
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
          revision: workspace.revision,
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

  it("throws a concrete initialization error when no fetch implementation is available", () => {
    Object.defineProperty(globalThis, "fetch", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    expect(() => new MotionWorkspaceClient({
      baseUrl: "https://workspace.qa/api",
    })).toThrowError("global fetch가 없어 MotionWorkspaceClient를 초기화할 수 없습니다.");
  });
});

describe("motion workspace client apply-command and conflict handling", () => {
  it("posts apply-command requests with revision and editor command payload", async () => {
    const workspace = createWorkspaceSnapshot();
    const nextWorkspace = {
      ...workspace,
      revision: workspace.revision + 1,
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

    const applied = await client.applyCommand("demo/workspace 1", command, workspace.revision);

    expect(applied).toEqual({ workspace: nextWorkspace });
    expect(requests).toEqual([
      {
        input: "https://workspace.qa/api/workspaces/demo%2Fworkspace%201/apply-command",
        init: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            revision: workspace.revision,
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
      }, workspace.revision);
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
