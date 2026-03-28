import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createPromoGridComposition,
  migrateCompositionV1toV2,
  type MotionCompositionDefV2,
  type MotionSceneDef,
} from "motion-content";
import {
  createMotionWorkspaceSnapshot,
  createMotionWorkspaceSnapshotV1,
  type MotionWorkspaceSnapshotV2,
} from "motion-workspace";
import {
  MotionWorkspaceRepositoryError,
  createMotionWorkspaceRepository,
} from "../src/index.js";

function createWorkspaceSnapshot(
  overrides: Partial<MotionWorkspaceSnapshotV2> = {},
): MotionWorkspaceSnapshotV2 {
  const base = createMotionWorkspaceSnapshot({
    composition: migrateCompositionV1toV2(createPromoGridComposition("flash")),
    values: {
      headline: "Repository headline",
    },
    source: {
      storageKey: "workspace:sqlite",
    },
    savedAt: "2026-03-27T00:00:00.000Z",
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

function insertPersistedLegacyWorkspace(
  path: string,
  workspaceId: string,
  workspaceJson: string,
  revision: number,
  savedAt: string,
  title: string,
): void {
  const require = createRequire(import.meta.url);
  const { DatabaseSync } = require("node:sqlite") as {
    DatabaseSync: new (databasePath: string) => {
      prepare(sql: string): {
        run(...params: unknown[]): unknown;
      };
      close(): void;
    };
  };
  const db = new DatabaseSync(path);
  try {
    db.prepare(
      `INSERT INTO motion_workspaces (
        id,
        title,
        global_revision,
        saved_at,
        workspace_json
      ) VALUES (?, ?, ?, ?, ?)`,
    ).run(workspaceId, title, revision, savedAt, workspaceJson);
  } finally {
    db.close();
  }
}

function createSceneComposition(): MotionCompositionDefV2 {
  return {
    id: "scene-repository-demo",
    title: "Scene Repository Demo",
    description: "Scene-level persistence demo",
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

function createSceneWorkspaceSnapshot(
  overrides: Partial<MotionWorkspaceSnapshotV2> = {},
): MotionWorkspaceSnapshotV2 {
  const base = createMotionWorkspaceSnapshot({
    composition: createSceneComposition(),
    values: {
      headline: "Scene workspace headline",
    },
    source: {
      storageKey: "workspace:sqlite:scenes",
    },
    savedAt: "2026-03-27T00:00:00.000Z",
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

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const path = tempDirs.pop();
    if (path) {
      rmSync(path, { recursive: true, force: true });
    }
  }
});

describe("sqlite motion workspace repository", () => {
  it("creates, loads, lists, and deletes persisted workspaces", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "motion-workspace-service-"));
    tempDirs.push(tempDir);
    const repository = createMotionWorkspaceRepository({
      path: join(tempDir, "workspace.sqlite"),
    });

    const workspace = createWorkspaceSnapshot();

    await repository.create({
      id: "demo/workspace-1",
      workspace,
    });

    expect(await repository.get("demo/workspace-1")).toEqual(workspace);
    expect(await repository.list()).toEqual([
      {
        id: "demo/workspace-1",
        title: workspace.document.composition.title,
        revision: workspace.globalRevision,
        savedAt: workspace.savedAt,
      },
    ]);

    expect(await repository.delete("demo/workspace-1")).toBe(true);
    expect(await repository.get("demo/workspace-1")).toBeNull();
    expect(await repository.list()).toEqual([]);

    repository.close();
  });

  it("saves a new snapshot only when expectedRevision matches the stored globalRevision", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "motion-workspace-service-"));
    tempDirs.push(tempDir);
    const repository = createMotionWorkspaceRepository({
      path: join(tempDir, "workspace.sqlite"),
    });

    const initial = createWorkspaceSnapshot();
    await repository.create({
      id: "demo/workspace-2",
      workspace: initial,
    });

    const next = createWorkspaceSnapshot({
      globalRevision: 1,
      savedAt: "2026-03-27T01:00:00.000Z",
      editor: {
        ...initial.editor,
        values: {
          ...initial.editor.values,
          headline: "Revision 1 headline",
        },
      },
    });

    const saved = await repository.save({
      id: "demo/workspace-2",
      workspace: next,
      expectedRevision: 0,
    });

    expect(saved).toEqual(next);
    expect(await repository.get("demo/workspace-2")).toEqual(next);
    expect(await repository.list()).toEqual([
      {
        id: "demo/workspace-2",
        title: next.document.composition.title,
        revision: 1,
        savedAt: "2026-03-27T01:00:00.000Z",
      },
    ]);

    repository.close();
  });

  it("loads persisted v1 workspace rows as scene-based v2 snapshots", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "motion-workspace-service-"));
    tempDirs.push(tempDir);
    const repository = createMotionWorkspaceRepository({
      path: join(tempDir, "workspace.sqlite"),
    });
    const workspacePath = join(tempDir, "workspace.sqlite");
    const legacyComposition = createPromoGridComposition("lift");
    const legacyWorkspaceBase = createMotionWorkspaceSnapshotV1({
      composition: legacyComposition,
      values: {
        headline: "Legacy headline",
      },
      source: {
        storageKey: "workspace:legacy-row",
      },
      savedAt: "2026-03-27T00:00:00.000Z",
    });
    const legacyWorkspace = {
      ...legacyWorkspaceBase,
      revision: 4,
      editor: {
        ...legacyWorkspaceBase.editor,
        selection: {
          kind: "layer",
          id: "headline",
        } as const,
      },
    };

    insertPersistedLegacyWorkspace(
      workspacePath,
      "demo/workspace-legacy-row",
      JSON.stringify(legacyWorkspace),
      legacyWorkspace.revision,
      legacyWorkspace.savedAt,
      legacyComposition.title,
    );

    const loaded = await repository.get("demo/workspace-legacy-row");

    expect(loaded).toMatchObject({
      schemaVersion: "qa-sdk.motion-workspace/v2",
      globalRevision: 4,
      sceneRevisions: {
        main: 4,
      },
      document: {
        schemaVersion: "qa-sdk.motion-composition/v2",
        composition: {
          scenes: [
            {
              id: "main",
              title: "Main",
            },
          ],
        },
      },
      editor: {
        values: {
          headline: "Legacy headline",
        },
        selection: {
          kind: "scene-layer",
          sceneId: "main",
          targetId: "headline",
        },
      },
      source: {
        storageKey: "workspace:legacy-row",
      },
      savedAt: "2026-03-27T00:00:00.000Z",
    });

    repository.close();
  });

  it("does not create false conflicts when different scenes are saved independently", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "motion-workspace-service-"));
    tempDirs.push(tempDir);
    const repository = createMotionWorkspaceRepository({
      path: join(tempDir, "workspace.sqlite"),
    });

    const initial = createSceneWorkspaceSnapshot();
    await repository.create({
      id: "demo/workspace-scenes",
      workspace: initial,
    });

    const sceneA = {
      ...getScene(initial, "scene-a"),
      title: "Scene A updated",
      durationMs: 2000,
    };
    const afterSceneA = await repository.saveScene(
      "demo/workspace-scenes",
      "scene-a",
      sceneA,
      0,
    );

    expect(afterSceneA.globalRevision).toBe(0);
    expect(afterSceneA.sceneRevisions).toEqual({
      "scene-a": 1,
      "scene-b": 0,
    });
    expect(getScene(afterSceneA, "scene-a")).toMatchObject({
      id: "scene-a",
      title: "Scene A updated",
      durationMs: 2000,
    });

    const sceneB = {
      ...getScene(initial, "scene-b"),
      title: "Scene B updated",
      startMs: 1900,
    };
    const afterSceneB = await repository.saveScene(
      "demo/workspace-scenes",
      "scene-b",
      sceneB,
      0,
    );

    expect(afterSceneB.globalRevision).toBe(0);
    expect(afterSceneB.sceneRevisions).toEqual({
      "scene-a": 1,
      "scene-b": 1,
    });
    expect(getScene(afterSceneB, "scene-a")).toMatchObject({
      id: "scene-a",
      title: "Scene A updated",
      durationMs: 2000,
    });
    expect(getScene(afterSceneB, "scene-b")).toMatchObject({
      id: "scene-b",
      title: "Scene B updated",
      startMs: 1900,
    });
    expect(await repository.get("demo/workspace-scenes")).toMatchObject({
      globalRevision: 0,
      sceneRevisions: {
        "scene-a": 1,
        "scene-b": 1,
      },
    });

    repository.close();
  });

  it("throws a typed scene revision_conflict error with sceneId when the same scene changed", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "motion-workspace-service-"));
    tempDirs.push(tempDir);
    const repository = createMotionWorkspaceRepository({
      path: join(tempDir, "workspace.sqlite"),
    });

    const initial = createSceneWorkspaceSnapshot();
    await repository.create({
      id: "demo/workspace-scene-conflict",
      workspace: initial,
    });

    await repository.saveScene(
      "demo/workspace-scene-conflict",
      "scene-a",
      {
        ...getScene(initial, "scene-a"),
        title: "Scene A baseline",
      },
      0,
    );

    await expect(repository.saveScene(
      "demo/workspace-scene-conflict",
      "scene-a",
      {
        ...getScene(initial, "scene-a"),
        title: "Scene A stale retry",
      },
      0,
    )).rejects.toMatchObject({
      name: "MotionWorkspaceRepositoryError",
      shape: {
        code: "revision_conflict",
        sceneId: "scene-a",
        expectedRevision: 0,
        actualRevision: 1,
      },
    } satisfies Partial<MotionWorkspaceRepositoryError>);

    repository.close();
  });
});
