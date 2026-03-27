import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createPromoGridComposition,
  MOTION_COMPOSITION_SCHEMA_V1,
  serializeMotionComposition,
} from "motion-content";
import {
  createMotionWorkspaceSnapshot,
  createMotionWorkspaceController,
  MOTION_WORKSPACE_SCHEMA_V1,
  type MotionWorkspaceSnapshotV1,
} from "motion-workspace";
import {
  MotionWorkspaceClient,
  MotionWorkspaceClientError,
  type MotionWorkspaceGetResponse,
  type MotionWorkspaceListResponse,
} from "motion-workspace-client";
import { createApp, createMotionWorkspaceRepository } from "@qa-sdk/motion-workspace-service";
import { USAGE, resolveSubcommand } from "../index.js";
import {
  MOTION_APPLY_USAGE,
  MOTION_EXPORT_USAGE,
  MOTION_IMPORT_USAGE,
  MOTION_PREVIEW_USAGE,
  MOTION_WORKSPACE_CREATE_USAGE,
  MOTION_WORKSPACE_DELETE_USAGE,
  MOTION_WORKSPACE_LIST_USAGE,
  MOTION_WORKSPACE_SHOW_USAGE,
  motionApply,
  motionExport,
  motionImport,
  motionPreview,
  motionWorkspaceCreate,
  motionWorkspaceDelete,
  motionWorkspaceList,
  motionWorkspaceShow,
  type MotionWorkspaceClientLike,
} from "./motion-workspace.js";

interface MockClientState {
  readonly workspaces: Map<string, MotionWorkspaceSnapshotV1>;
  readonly requests: string[];
  readonly created: MotionWorkspaceSnapshotV1[];
  readonly updated: MotionWorkspaceSnapshotV1[];
  readonly deleted: string[];
  readonly applied: Array<{
    readonly id: string;
    readonly revision: number;
    readonly commandType: string;
  }>;
}

function createWorkspaceSnapshot(
  overrides: Partial<MotionWorkspaceSnapshotV1> = {},
): MotionWorkspaceSnapshotV1 {
  const base = createMotionWorkspaceSnapshot({
    composition: createPromoGridComposition("flash"),
    source: {
      presetId: "promo-grid",
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

function createMockClientFactory(state: MockClientState) {
  const seenBaseUrls: string[] = [];

  return {
    seenBaseUrls,
    clientFactory(baseUrl: string): MotionWorkspaceClientLike {
      seenBaseUrls.push(baseUrl);
      return {
        async list(): Promise<MotionWorkspaceListResponse> {
          state.requests.push("list");
          return {
            workspaces: [...state.workspaces.entries()].map(([id, workspace]) => ({
              id,
              title: workspace.document.composition.title,
              revision: workspace.revision,
              savedAt: workspace.savedAt,
            })),
          };
        },
        async get(id: string): Promise<MotionWorkspaceGetResponse> {
          state.requests.push(`get:${id}`);
          const workspace = state.workspaces.get(id);
          if (!workspace) {
            throw new MotionWorkspaceClientError(
              `workspace를 찾을 수 없습니다: ${id}.`,
              404,
              {
                code: "workspace_not_found",
                message: `workspace를 찾을 수 없습니다: ${id}.`,
                id,
              },
            );
          }
          return { workspace };
        },
        async create(id: string, workspace: MotionWorkspaceSnapshotV1): Promise<MotionWorkspaceGetResponse> {
          state.requests.push(`create:${id}`);
          state.created.push(workspace);
          state.workspaces.set(id, workspace);
          return { workspace };
        },
        async update(id: string, workspace: MotionWorkspaceSnapshotV1): Promise<MotionWorkspaceGetResponse> {
          state.requests.push(`update:${id}`);
          state.updated.push(workspace);
          state.workspaces.set(id, workspace);
          return { workspace };
        },
        async delete(id: string): Promise<void> {
          state.requests.push(`delete:${id}`);
          state.deleted.push(id);
          if (!state.workspaces.delete(id)) {
            throw new MotionWorkspaceClientError(
              `workspace를 찾을 수 없습니다: ${id}.`,
              404,
              {
                code: "workspace_not_found",
                message: `workspace를 찾을 수 없습니다: ${id}.`,
                id,
              },
            );
          }
        },
        async applyCommand(id, command, revision): Promise<MotionWorkspaceGetResponse> {
          state.requests.push(`apply:${id}:r${revision}`);
          state.applied.push({
            id,
            revision,
            commandType: command.type,
          });
          const workspace = state.workspaces.get(id);
          if (!workspace) {
            throw new MotionWorkspaceClientError(
              `workspace를 찾을 수 없습니다: ${id}.`,
              404,
              {
                code: "workspace_not_found",
                message: `workspace를 찾을 수 없습니다: ${id}.`,
                id,
              },
            );
          }

          const controller = createMotionWorkspaceController({
            composition: workspace.document.composition,
            source: workspace.source,
            savedAt: workspace.savedAt,
          });
          controller.loadWorkspace(workspace);
          controller.apply(command);
          const nextWorkspace = controller.saveWorkspace({
            savedAt: "2026-03-27T08:00:00.000Z",
          }).workspace;
          state.workspaces.set(id, nextWorkspace);
          return { workspace: nextWorkspace };
        },
      };
    },
  };
}

function createAppFetch(
  app: ReturnType<typeof createApp>,
): typeof fetch {
  return async (input, init) => {
    const requestUrl = input instanceof Request
      ? new URL(input.url)
      : new URL(typeof input === "string" ? input : input.toString());
    return app.request(`${requestUrl.pathname}${requestUrl.search}`, init);
  };
}

describe("motion workspace CLI", () => {
  let tempDir: string;
  let state: MockClientState;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "qa-motion-workspace-cli-"));
    process.exitCode = undefined;
    state = {
      workspaces: new Map(),
      requests: [],
      created: [],
      updated: [],
      deleted: [],
      applied: [],
    };
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
    await rm(tempDir, { recursive: true, force: true });
  });

  it("lists remote workspaces through the typed client", async () => {
    const workspaceId = "demo/workspace-1";
    state.workspaces.set(workspaceId, createWorkspaceSnapshot());
    const mock = createMockClientFactory(state);

    const output = await captureConsole(() => motionWorkspaceList(["--base-url", "https://workspace.qa/api"], {
      clientFactory: mock.clientFactory,
    }));

    expect(output.stdout).toContain("Remote Motion Workspaces (1)");
    expect(output.stdout).toContain(workspaceId);
    expect(output.stdout).toContain("Promo Grid");
    expect(mock.seenBaseUrls).toEqual(["https://workspace.qa/api"]);
    expect(state.requests).toEqual(["list"]);
  });

  it("shows a remote workspace summary", async () => {
    const workspaceId = "demo/workspace-show";
    state.workspaces.set(workspaceId, createWorkspaceSnapshot({
      revision: 3,
      savedAt: "2026-03-27T03:00:00.000Z",
    }));
    const mock = createMockClientFactory(state);

    const output = await captureConsole(() => motionWorkspaceShow([workspaceId], {
      clientFactory: mock.clientFactory,
    }));

    expect(output.stdout).toContain("Remote Motion Workspace");
    expect(output.stdout).toContain(`workspace: ${workspaceId}`);
    expect(output.stdout).toContain(`schemaVersion: ${MOTION_WORKSPACE_SCHEMA_V1}`);
    expect(output.stdout).toContain("revision: 3");
    expect(output.stdout).toContain("composition.title: Promo Grid");
  });

  it("creates a default preset workspace", async () => {
    const workspaceId = "demo/workspace-create";
    const mock = createMockClientFactory(state);

    const output = await captureConsole(() => motionWorkspaceCreate([workspaceId], {
      clientFactory: mock.clientFactory,
      now: () => "2026-03-27T04:00:00.000Z",
    }));

    expect(output.stdout).toContain(`workspace 생성 완료: ${workspaceId}`);
    expect(state.created).toHaveLength(1);
    expect(state.created[0]).toMatchObject({
      schemaVersion: MOTION_WORKSPACE_SCHEMA_V1,
      revision: 0,
      savedAt: "2026-03-27T04:00:00.000Z",
      source: {
        presetId: "promo-grid",
      },
    });
    expect(state.created[0].document.composition.id).toBe("promo-grid");
  });

  it("deletes a remote workspace", async () => {
    const workspaceId = "demo/workspace-delete";
    state.workspaces.set(workspaceId, createWorkspaceSnapshot());
    const mock = createMockClientFactory(state);

    const output = await captureConsole(() => motionWorkspaceDelete([workspaceId], {
      clientFactory: mock.clientFactory,
    }));

    expect(output.stdout).toContain(`workspace 삭제 완료: ${workspaceId}`);
    expect(state.deleted).toEqual([workspaceId]);
    expect(state.workspaces.has(workspaceId)).toBe(false);
  });

  it("exports a remote workspace as a composition document envelope", async () => {
    const workspaceId = "demo/workspace-export";
    state.workspaces.set(workspaceId, createWorkspaceSnapshot());
    const mock = createMockClientFactory(state);
    const outPath = join(tempDir, "exported-composition.json");

    const output = await captureConsole(() => motionExport([
      "--workspace",
      workspaceId,
      "--out",
      outPath,
    ], {
      clientFactory: mock.clientFactory,
    }));

    const exported = JSON.parse(await readFile(outPath, "utf-8")) as Record<string, unknown>;
    expect(output.stdout).toContain(`motion export 완료: ${workspaceId}`);
    expect(exported["schemaVersion"]).toBe(MOTION_COMPOSITION_SCHEMA_V1);
    expect(exported).not.toHaveProperty("document");
    expect(exported).not.toHaveProperty("editor");
  });

  it("imports a composition document into an existing remote workspace via update", async () => {
    const workspaceId = "demo/workspace-import";
    state.workspaces.set(workspaceId, createWorkspaceSnapshot({
      revision: 5,
      savedAt: "2026-03-27T05:00:00.000Z",
    }));
    const mock = createMockClientFactory(state);
    const filePath = join(tempDir, "imported-composition.json");
    await writeFile(
      filePath,
      serializeMotionComposition(createPromoGridComposition("lift")),
      "utf-8",
    );

    const output = await captureConsole(() => motionImport([
      filePath,
      "--workspace",
      workspaceId,
    ], {
      clientFactory: mock.clientFactory,
      now: () => "2026-03-27T06:00:00.000Z",
    }));

    expect(output.stdout).toContain(`motion import 완료: ${filePath} -> ${workspaceId} (updated)`);
    expect(state.updated).toHaveLength(1);
    expect(state.updated[0]).toMatchObject({
      schemaVersion: MOTION_WORKSPACE_SCHEMA_V1,
      revision: 6,
      savedAt: "2026-03-27T06:00:00.000Z",
      source: {
        path: filePath,
      },
    });
    expect(state.updated[0].document.composition.transitions[0]?.style).toBe("lift");
  });

  it("creates a new remote workspace when import target does not exist", async () => {
    const workspaceId = "demo/workspace-import-create";
    const mock = createMockClientFactory(state);
    const filePath = join(tempDir, "import-create.json");
    await writeFile(
      filePath,
      serializeMotionComposition(createPromoGridComposition("crossfade")),
      "utf-8",
    );

    const output = await captureConsole(() => motionImport([
      filePath,
      "--workspace",
      workspaceId,
    ], {
      clientFactory: mock.clientFactory,
      now: () => "2026-03-27T07:00:00.000Z",
    }));

    expect(output.stdout).toContain(`motion import 완료: ${filePath} -> ${workspaceId} (created)`);
    expect(state.created).toHaveLength(1);
    expect(state.created[0]).toMatchObject({
      revision: 0,
      savedAt: "2026-03-27T07:00:00.000Z",
      source: {
        path: filePath,
      },
    });
  });

  it("runs export/import end-to-end through motion-workspace-service and the typed client", async () => {
    const workspaceId = "demo/workspace-e2e";
    const repository = createMotionWorkspaceRepository({
      path: join(tempDir, "motion-workspace-e2e.sqlite"),
    });
    const app = createApp({
      repository,
      version: "test-build",
      getNow: () => "2026-03-27T09:30:00.000Z",
    });
    const fetchImpl = createAppFetch(app);
    const baseUrl = "http://workspace.qa";
    const clientFactory = (resolvedBaseUrl: string): MotionWorkspaceClientLike =>
      new MotionWorkspaceClient({ baseUrl: resolvedBaseUrl, fetch: fetchImpl });
    const client = new MotionWorkspaceClient({ baseUrl, fetch: fetchImpl });
    const outPath = join(tempDir, "workspace-e2e-export.json");

    try {
      await client.create(workspaceId, createWorkspaceSnapshot({
        savedAt: "2026-03-27T08:00:00.000Z",
      }));

      const exportOutput = await captureConsole(() => motionExport([
        "--workspace",
        workspaceId,
        "--out",
        outPath,
        "--base-url",
        baseUrl,
      ], {
        clientFactory,
      }));

      expect(exportOutput.stdout).toContain(`motion export 완료: ${workspaceId}`);
      expect(JSON.parse(await readFile(outPath, "utf-8"))).toMatchObject({
        schemaVersion: MOTION_COMPOSITION_SCHEMA_V1,
        composition: {
          id: "promo-grid",
        },
      });

      await writeFile(
        outPath,
        serializeMotionComposition(createPromoGridComposition("lift")),
        "utf-8",
      );

      const importOutput = await captureConsole(() => motionImport([
        outPath,
        "--workspace",
        workspaceId,
        "--base-url",
        baseUrl,
      ], {
        clientFactory,
        now: () => "2026-03-27T09:30:00.000Z",
      }));

      expect(importOutput.stdout).toContain(`motion import 완료: ${outPath} -> ${workspaceId} (updated)`);
      const remote = await client.get(workspaceId);
      expect(remote.workspace).toMatchObject({
        revision: 1,
        savedAt: "2026-03-27T09:30:00.000Z",
        source: {
          path: outPath,
        },
      });
      expect(remote.workspace.document.composition.transitions[0]?.style).toBe("lift");
    } finally {
      await repository.close();
    }
  });

  it("applies a remote workspace command through the typed client", async () => {
    const workspaceId = "demo/workspace-apply";
    state.workspaces.set(workspaceId, createWorkspaceSnapshot());
    const mock = createMockClientFactory(state);

    const output = await captureConsole(() => motionApply([
      "--workspace",
      workspaceId,
      "--command",
      JSON.stringify({ type: "set-loop", loop: true }),
    ], {
      clientFactory: mock.clientFactory,
    }));

    expect(output.stdout).toContain(`motion apply 완료: ${workspaceId} (set-loop)`);
    expect(output.stdout).toContain(`workspace: ${workspaceId}`);
    expect(output.stdout).toContain("revision: 1");
    expect(output.stdout).toContain("editor.loop: true");
    expect(state.applied).toEqual([
      {
        id: workspaceId,
        revision: 0,
        commandType: "set-loop",
      },
    ]);
    expect(state.requests).toEqual([
      `get:${workspaceId}`,
      `apply:${workspaceId}:r0`,
    ]);
  });

  it("launches preview orchestration with the requested workspace", async () => {
    const previewLauncher = vi.fn(async (options: {
      readonly previewOrigin: string;
      readonly workspaceBaseUrl: string;
      readonly workspaceId?: string;
    }) => ({
      url: "http://localhost:4179/?workspace=demo%2Fworkspace-preview",
      previewOrigin: options.previewOrigin,
      workspaceBaseUrl: options.workspaceBaseUrl,
      reusedWorkspaceService: false,
      reusedPreviewServer: true,
    }));

    const output = await captureConsole(() => motionPreview([
      "--workspace",
      "demo/workspace-preview",
      "--base-url",
      "http://localhost:3810/api/motion-workspace",
      "--preview-url",
      "http://localhost:4279",
    ], {
      previewLauncher,
    }));

    expect(previewLauncher).toHaveBeenCalledWith({
      previewOrigin: "http://localhost:4279",
      workspaceBaseUrl: "http://localhost:3810/api/motion-workspace",
      workspaceId: "demo/workspace-preview",
    });
    expect(output.stdout).toContain("motion preview 준비 완료: http://localhost:4179/?workspace=demo%2Fworkspace-preview");
    expect(output.stdout).toContain("workspace service: started");
    expect(output.stdout).toContain("preview app: reuse");
  });

  it("prints command usage when required arguments are missing", async () => {
    const listOutput = await captureConsole(() => motionWorkspaceList(["--unknown"], {
      clientFactory: createMockClientFactory(state).clientFactory,
    }));
    const showOutput = await captureConsole(() => motionWorkspaceShow([], {
      clientFactory: createMockClientFactory(state).clientFactory,
    }));
    const createOutput = await captureConsole(() => motionWorkspaceCreate([], {
      clientFactory: createMockClientFactory(state).clientFactory,
    }));
    const deleteOutput = await captureConsole(() => motionWorkspaceDelete([], {
      clientFactory: createMockClientFactory(state).clientFactory,
    }));
    const exportOutput = await captureConsole(() => motionExport([], {
      clientFactory: createMockClientFactory(state).clientFactory,
    }));
    const importOutput = await captureConsole(() => motionImport([], {
      clientFactory: createMockClientFactory(state).clientFactory,
    }));
    const applyOutput = await captureConsole(() => motionApply([], {
      clientFactory: createMockClientFactory(state).clientFactory,
    }));
    const previewOutput = await captureConsole(() => motionPreview(["demo"], {
      clientFactory: createMockClientFactory(state).clientFactory,
    }));

    expect(listOutput.stderr).toContain(MOTION_WORKSPACE_LIST_USAGE);
    expect(showOutput.stderr).toContain(MOTION_WORKSPACE_SHOW_USAGE);
    expect(createOutput.stderr).toContain(MOTION_WORKSPACE_CREATE_USAGE);
    expect(deleteOutput.stderr).toContain(MOTION_WORKSPACE_DELETE_USAGE);
    expect(exportOutput.stderr).toContain(MOTION_EXPORT_USAGE);
    expect(importOutput.stderr).toContain(MOTION_IMPORT_USAGE);
    expect(applyOutput.stderr).toContain(MOTION_APPLY_USAGE);
    expect(previewOutput.stderr).toContain(MOTION_PREVIEW_USAGE);
  });

  it("exposes workspace/import/export motion commands in CLI usage and subcommand parsing", () => {
    expect(USAGE).toContain("qa-sdk motion workspace list");
    expect(USAGE).toContain("qa-sdk motion workspace show <id>");
    expect(USAGE).toContain("qa-sdk motion workspace create <id>");
    expect(USAGE).toContain("qa-sdk motion workspace delete <id>");
    expect(USAGE).toContain("qa-sdk motion export --workspace <id> --out <file>");
    expect(USAGE).toContain("qa-sdk motion import <file> --workspace <id>");
    expect(USAGE).toContain("qa-sdk motion apply --workspace <id> --command <json>");
    expect(USAGE).toContain("qa-sdk motion preview [--workspace <id>]");
    expect(resolveSubcommand(["motion", "workspace", "list"])).toEqual({
      name: "motion workspace list",
      rest: [],
    });
    expect(resolveSubcommand(["motion", "workspace", "show", "demo.json"])).toEqual({
      name: "motion workspace show",
      rest: ["demo.json"],
    });
    expect(resolveSubcommand(["motion", "workspace", "create", "demo.json"])).toEqual({
      name: "motion workspace create",
      rest: ["demo.json"],
    });
    expect(resolveSubcommand(["motion", "workspace", "delete", "demo.json"])).toEqual({
      name: "motion workspace delete",
      rest: ["demo.json"],
    });
    expect(resolveSubcommand(["motion", "export", "--workspace", "demo", "--out", "file.json"])).toEqual({
      name: "motion export",
      rest: ["--workspace", "demo", "--out", "file.json"],
    });
    expect(resolveSubcommand(["motion", "import", "file.json", "--workspace", "demo"])).toEqual({
      name: "motion import",
      rest: ["file.json", "--workspace", "demo"],
    });
    expect(resolveSubcommand(["motion", "apply", "--workspace", "demo", "--command", "{\"type\":\"play\"}"])).toEqual({
      name: "motion apply",
      rest: ["--workspace", "demo", "--command", "{\"type\":\"play\"}"],
    });
    expect(resolveSubcommand(["motion", "preview", "--workspace", "demo"])).toEqual({
      name: "motion preview",
      rest: ["--workspace", "demo"],
    });
  });
});

async function captureConsole(run: () => Promise<void> | void) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    stdout.push(args.join(" "));
  });
  const errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    stderr.push(args.join(" "));
  });

  try {
    await run();
  } finally {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  }

  return {
    stdout: stdout.join("\n"),
    stderr: stderr.join("\n"),
  };
}
