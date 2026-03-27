import { describe, expect, it } from "vitest";
import { createPromoGridComposition, serializeMotionComposition } from "motion-content";
import * as workspaceEntry from "./index.js";
import { createMotionWorkspaceSnapshot } from "./io.js";
import {
  LEGACY_MOTION_EDITOR_DEMO_STORAGE_KEY,
  MotionWorkspaceMigrationError,
  migrateLegacyMotionEditorDemoState,
  migrateMotionWorkspace,
  migrateMotionWorkspaceSnapshot,
  parseLegacyMotionEditorDemoState,
} from "./migrate.js";
import { MOTION_WORKSPACE_SCHEMA_V1 } from "./types.js";

describe("motion workspace migration", () => {
  it("passes through current snapshots and reports migration metadata", () => {
    const snapshot = createMotionWorkspaceSnapshot({
      composition: createPromoGridComposition("lift"),
      savedAt: "2026-03-27T00:00:00.000Z",
    });

    const result = migrateMotionWorkspace(JSON.stringify(snapshot));

    expect(result).toEqual({
      workspace: snapshot,
      migrated: false,
      fromSchemaVersion: MOTION_WORKSPACE_SCHEMA_V1,
      toSchemaVersion: MOTION_WORKSPACE_SCHEMA_V1,
    });
    expect(migrateMotionWorkspaceSnapshot(snapshot)).toEqual(snapshot);
  });

  it("throws a typed revision conflict error when expectedRevision does not match", () => {
    const snapshot = {
      ...createMotionWorkspaceSnapshot({
        composition: createPromoGridComposition("crossfade"),
        savedAt: "2026-03-27T00:00:00.000Z",
      }),
      revision: 7,
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
        composition: createPromoGridComposition("crossfade"),
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
      toSchemaVersion: MOTION_WORKSPACE_SCHEMA_V1,
      workspace: {
        schemaVersion: MOTION_WORKSPACE_SCHEMA_V1,
        revision: 0,
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
