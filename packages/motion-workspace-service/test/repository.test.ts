import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createPromoGridComposition } from "motion-content";
import {
  createMotionWorkspaceSnapshot,
  type MotionWorkspaceSnapshotV1,
} from "motion-workspace";
import {
  MotionWorkspaceRepositoryError,
  createMotionWorkspaceRepository,
} from "../src/index.js";

function createWorkspaceSnapshot(
  overrides: Partial<MotionWorkspaceSnapshotV1> = {},
): MotionWorkspaceSnapshotV1 {
  const base = createMotionWorkspaceSnapshot({
    composition: createPromoGridComposition("flash"),
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
        revision: workspace.revision,
        savedAt: workspace.savedAt,
      },
    ]);

    expect(await repository.delete("demo/workspace-1")).toBe(true);
    expect(await repository.get("demo/workspace-1")).toBeNull();
    expect(await repository.list()).toEqual([]);

    repository.close();
  });

  it("saves a new snapshot only when expectedRevision matches the stored revision", async () => {
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
      revision: 1,
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

  it("throws a typed revision_conflict error when the stored revision changed", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "motion-workspace-service-"));
    tempDirs.push(tempDir);
    const repository = createMotionWorkspaceRepository({
      path: join(tempDir, "workspace.sqlite"),
    });

    const initial = createWorkspaceSnapshot();
    await repository.create({
      id: "demo/workspace-3",
      workspace: initial,
    });

    const revisionOne = createWorkspaceSnapshot({
      revision: 1,
      savedAt: "2026-03-27T01:00:00.000Z",
    });
    await repository.save({
      id: "demo/workspace-3",
      workspace: revisionOne,
      expectedRevision: 0,
    });

    const staleRevisionTwo = createWorkspaceSnapshot({
      revision: 2,
      savedAt: "2026-03-27T02:00:00.000Z",
    });

    await expect(repository.save({
      id: "demo/workspace-3",
      workspace: staleRevisionTwo,
      expectedRevision: 0,
    })).rejects.toMatchObject({
      name: "MotionWorkspaceRepositoryError",
      shape: {
        code: "revision_conflict",
        expectedRevision: 0,
        actualRevision: 1,
      },
    } satisfies Partial<MotionWorkspaceRepositoryError>);

    repository.close();
  });
});
