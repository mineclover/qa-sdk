import { describe, expect, it } from "vitest";
import {
  assembleComposition,
  createPromoGridComposition,
  migrateCompositionV1toV2,
  serializeMotionComposition,
} from "motion-content";
import * as workspaceEntry from "./index.js";
import {
  createMotionWorkspaceSnapshot,
  createMotionWorkspaceSnapshotV1,
} from "./io.js";
import {
  LEGACY_MOTION_EDITOR_DEMO_STORAGE_KEY,
  MotionWorkspaceMigrationError,
  migrateLegacyMotionEditorDemoState,
  migrateMotionWorkspace,
  migrateMotionWorkspaceSnapshot,
  parseLegacyMotionEditorDemoState,
} from "./migrate.js";
import {
  MOTION_WORKSPACE_SCHEMA_V1,
  MOTION_WORKSPACE_SCHEMA_V2,
} from "./types.js";

describe("motion workspace migration", () => {
  it("passes through current v2 snapshots and reports migration metadata", () => {
    const snapshot = createMotionWorkspaceSnapshot({
      composition: migrateCompositionV1toV2(createPromoGridComposition("lift")),
      savedAt: "2026-03-27T00:00:00.000Z",
    });

    const result = migrateMotionWorkspace(JSON.stringify(snapshot));

    expect(result).toEqual({
      workspace: snapshot,
      migrated: false,
      fromSchemaVersion: MOTION_WORKSPACE_SCHEMA_V2,
      toSchemaVersion: MOTION_WORKSPACE_SCHEMA_V2,
    });
    expect(migrateMotionWorkspaceSnapshot(snapshot)).toEqual(snapshot);
  });

  it("migrates v1 snapshots into v2 scene revision envelopes", () => {
    const snapshot = {
      ...createMotionWorkspaceSnapshotV1({
        composition: migrateCompositionV1toV2(createPromoGridComposition("crossfade")),
        savedAt: "2026-03-27T00:00:00.000Z",
      }),
      revision: 7,
    };

    const result = migrateMotionWorkspace(snapshot, { expectedRevision: 7 });

    expect(result).toMatchObject({
      migrated: true,
      fromSchemaVersion: MOTION_WORKSPACE_SCHEMA_V1,
      toSchemaVersion: MOTION_WORKSPACE_SCHEMA_V2,
      workspace: {
        schemaVersion: MOTION_WORKSPACE_SCHEMA_V2,
        globalRevision: 7,
        sceneRevisions: {
          main: 7,
        },
      },
    });
  });

  it("migrates legacy v1 workspace compositions into a single main scene", () => {
    const original = createPromoGridComposition("flash");
    const snapshot = {
      ...createMotionWorkspaceSnapshotV1({
        composition: original,
        savedAt: "2026-03-27T00:00:00.000Z",
      }),
      revision: 3,
      editor: {
        ...createMotionWorkspaceSnapshotV1({
          composition: original,
          savedAt: "2026-03-27T00:00:00.000Z",
        }).editor,
        selection: {
          kind: "layer",
          id: "headline",
        } as const,
      },
    };

    const result = migrateMotionWorkspace(snapshot, { expectedRevision: 3 });

    expect(result).toMatchObject({
      migrated: true,
      fromSchemaVersion: MOTION_WORKSPACE_SCHEMA_V1,
      toSchemaVersion: MOTION_WORKSPACE_SCHEMA_V2,
      workspace: {
        schemaVersion: MOTION_WORKSPACE_SCHEMA_V2,
        globalRevision: 3,
        sceneRevisions: {
          main: 3,
        },
        document: {
          schemaVersion: "qa-sdk.motion-composition/v2",
          composition: {
            scenes: [
              {
                id: "main",
                title: "Main",
                durationMs: original.durationMs,
              },
            ],
          },
        },
        editor: {
          selection: {
            kind: "scene-layer",
            sceneId: "main",
            targetId: "headline",
          },
        },
      },
    });
  });

  it("roundtrips migrated legacy workspaces back to the original v1 assembly", () => {
    const original = createPromoGridComposition("lift");
    const snapshot = createMotionWorkspaceSnapshotV1({
      composition: original,
      savedAt: "2026-03-27T00:00:00.000Z",
    });

    const migrated = migrateMotionWorkspaceSnapshot(snapshot);

    expect(migrated.document.schemaVersion).toBe("qa-sdk.motion-composition/v2");
    expect(assembleComposition(migrated.document.composition)).toEqual(original);
  });

  it("throws a typed revision conflict error when expectedRevision does not match", () => {
    const snapshot = {
      ...createMotionWorkspaceSnapshot({
        composition: migrateCompositionV1toV2(createPromoGridComposition("crossfade")),
        savedAt: "2026-03-27T00:00:00.000Z",
      }),
      globalRevision: 7,
    };

    try {
      migrateMotionWorkspace(snapshot, { expectedRevision: 6 });
      throw new Error("expected migration to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(MotionWorkspaceMigrationError);
      const migrationError = error as MotionWorkspaceMigrationError;
      expect(migrationError.shape).toEqual({
        code: "revision_conflict",
        message: "workspace revision이 충돌했습니다. expectedRevision=6, actualRevision=7.",
        expectedRevision: 6,
        actualRevision: 7,
      });
    }
  });

  it("throws a typed unknown schemaVersion error for unsupported inputs", () => {
    const unsupported = JSON.stringify({
      ...createMotionWorkspaceSnapshot({
        composition: migrateCompositionV1toV2(createPromoGridComposition("crossfade")),
        savedAt: "2026-03-27T00:00:00.000Z",
      }),
      schemaVersion: "qa-sdk.motion-workspace/v99",
    });

    try {
      migrateMotionWorkspace(unsupported);
      throw new Error("expected migration to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(MotionWorkspaceMigrationError);
      const migrationError = error as MotionWorkspaceMigrationError;
      expect(migrationError.shape).toEqual({
        code: "unknown_schema_version",
        message: "지원되지 않는 workspace schemaVersion입니다: \"qa-sdk.motion-workspace/v99\".",
        schemaVersion: "qa-sdk.motion-workspace/v99",
      });
    }
  });

  it("migrates legacy local demo state into a workspace snapshot with provenance", () => {
    const legacy = JSON.stringify({
      presetId: "promo-grid",
      document: serializeMotionComposition(createPromoGridComposition("lift")),
      savedAt: "2026-03-26T23:59:59.000Z",
    });

    const result = migrateLegacyMotionEditorDemoState(legacy);

    expect(result).toMatchObject({
      migrated: true,
      fromSchemaVersion: LEGACY_MOTION_EDITOR_DEMO_STORAGE_KEY,
      toSchemaVersion: MOTION_WORKSPACE_SCHEMA_V2,
      workspace: {
        schemaVersion: MOTION_WORKSPACE_SCHEMA_V2,
        globalRevision: 0,
        savedAt: "2026-03-26T23:59:59.000Z",
        source: {
          presetId: "promo-grid",
          storageKey: LEGACY_MOTION_EDITOR_DEMO_STORAGE_KEY,
        },
      },
    });
    expect(result.workspace.document.composition.transitions[0]?.style).toBe("lift");
    expect(parseLegacyMotionEditorDemoState(legacy)).toEqual({
      presetId: "promo-grid",
      document: serializeMotionComposition(createPromoGridComposition("lift")),
      savedAt: "2026-03-26T23:59:59.000Z",
    });
  });

  it("rejects malformed legacy local demo state with workspace parse diagnostics", () => {
    expect(() => parseLegacyMotionEditorDemoState(JSON.stringify({
      document: 123,
      savedAt: null,
    }))).toThrowError(
      "MotionWorkspace JSON 검증 실패\n- $.presetId: 필수 string | null 필드가 없습니다.\n- $.document: string여야 하지만 number입니다.\n- $.savedAt: string여야 하지만 null입니다.",
    );
  });

  it("exports migration helpers from the public entrypoint", () => {
    expect(typeof workspaceEntry.migrateMotionWorkspace).toBe("function");
    expect(typeof workspaceEntry.migrateMotionWorkspaceSnapshot).toBe("function");
    expect(typeof workspaceEntry.parseLegacyMotionEditorDemoState).toBe("function");
    expect(typeof workspaceEntry.migrateLegacyMotionEditorDemoState).toBe("function");
  });
});
