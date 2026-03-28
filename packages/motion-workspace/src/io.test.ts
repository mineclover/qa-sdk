import { describe, expect, it } from "vitest";
import {
  createPromoGridComposition,
  MOTION_COMPOSITION_SCHEMA_V1,
  migrateCompositionV1toV2,
  parseMotionComposition,
} from "motion-content";
import * as workspaceEntry from "./index.js";
import {
  MotionWorkspaceParseError,
  createMotionWorkspaceSnapshot,
  createMotionWorkspaceSnapshotV1,
  isMotionWorkspaceSnapshotV1,
  isMotionWorkspaceSnapshotV2,
  parseMotionWorkspaceSnapshot,
  serializeMotionWorkspaceSnapshot,
  validateMotionWorkspaceSnapshot,
} from "./io.js";
import {
  MOTION_WORKSPACE_SCHEMA_V1,
  MOTION_WORKSPACE_SCHEMA_V2,
} from "./types.js";

describe("motion workspace io", () => {
  it("serializes and parses v2 workspace snapshots without changing persisted fields", () => {
    const snapshot = createMotionWorkspaceSnapshot({
      composition: migrateCompositionV1toV2(createPromoGridComposition("lift")),
      values: {
        headline: "Workspace headline",
      },
      source: {
        presetId: "promo-grid",
        storageKey: "workspace:demo",
        path: "/tmp/promo-grid.json",
      },
      savedAt: "2026-03-27T00:00:00.000Z",
    });

    const serialized = serializeMotionWorkspaceSnapshot(snapshot);
    const parsed = parseMotionWorkspaceSnapshot(serialized);

    expect(parsed).toEqual(snapshot);
    expect(validateMotionWorkspaceSnapshot(parsed)).toEqual([]);
    expect(isMotionWorkspaceSnapshotV1(parsed)).toBe(false);
    expect(isMotionWorkspaceSnapshotV2(parsed)).toBe(true);
    expect(parsed).toMatchObject({
      schemaVersion: MOTION_WORKSPACE_SCHEMA_V2,
      globalRevision: 0,
      sceneRevisions: {
        main: 0,
      },
    });
  });

  it("rejects schemaVersion mismatches with a concrete workspace error", () => {
    const invalidJson = JSON.stringify({
      ...createMotionWorkspaceSnapshot({
        composition: createPromoGridComposition("crossfade"),
        savedAt: "2026-03-27T00:00:00.000Z",
      }),
      schemaVersion: "qa-sdk.motion-workspace/v0",
    });

    expect(() => parseMotionWorkspaceSnapshot(invalidJson)).toThrowError(MotionWorkspaceParseError);
    expect(() => parseMotionWorkspaceSnapshot(invalidJson)).toThrowError(
      /\$\.schemaVersion: qa-sdk\.motion-workspace\/v1 \| qa-sdk\.motion-workspace\/v2 중 하나여야 하지만 "qa-sdk\.motion-workspace\/v0"입니다\./,
    );
  });

  it("reports missing required v1 workspace and embedded document fields", () => {
    const issues = validateMotionWorkspaceSnapshot({
      schemaVersion: MOTION_WORKSPACE_SCHEMA_V1,
      document: {
        schemaVersion: MOTION_COMPOSITION_SCHEMA_V1,
      },
      editor: {
        viewport: {
          zoom: 1,
          scrollLeftMs: 0,
        },
        loop: false,
      },
      revision: 0,
    });

    expect(issues).toContain("$.document.composition: 필수 object 필드가 없습니다.");
    expect(issues).toContain("$.editor.values: 필수 object 필드가 없습니다.");
    expect(issues).toContain("$.editor.selection: 필수 object 또는 null 필드가 없습니다.");
    expect(issues).toContain("$.editor.viewport.visibleDurationMs: 필수 number 필드가 없습니다.");
    expect(issues).toContain("$.editor.playbackRate: 필수 number 필드가 없습니다.");
    expect(issues).toContain("$.savedAt: 필수 string 필드가 없습니다.");
  });

  it("validates v2 scene revisions against the embedded scene list", () => {
    const composition = migrateCompositionV1toV2(createPromoGridComposition("crossfade"));

    const issues = validateMotionWorkspaceSnapshot({
      schemaVersion: MOTION_WORKSPACE_SCHEMA_V2,
      document: {
        schemaVersion: "qa-sdk.motion-composition/v2",
        composition,
      },
      editor: createMotionWorkspaceSnapshot({ composition }).editor,
      globalRevision: 1,
      sceneRevisions: {},
      savedAt: "2026-03-27T00:00:00.000Z",
    });

    expect(issues).toContain("$.sceneRevisions.main: 필수 number 필드가 없습니다.");
  });

  it("keeps composition and workspace parsers on separate entrypoints", () => {
    expect(typeof parseMotionComposition).toBe("function");
    expect(typeof workspaceEntry.parseMotionWorkspaceSnapshot).toBe("function");
    expect("parseMotionComposition" in workspaceEntry).toBe(false);
    expect("parseMotionWorkspaceOrComposition" in workspaceEntry).toBe(false);
  });

  it("accepts v2 scene selections in persisted workspace snapshots", () => {
    const snapshot = createMotionWorkspaceSnapshot({
      composition: migrateCompositionV1toV2(createPromoGridComposition("crossfade")),
      savedAt: "2026-03-27T00:00:00.000Z",
    });

    const persisted = {
      ...snapshot,
      editor: {
        ...snapshot.editor,
        selection: {
          kind: "scene-layer",
          sceneId: "main",
          targetId: "headline",
        } as const,
      },
    };

    const serialized = serializeMotionWorkspaceSnapshot(persisted);
    const parsed = parseMotionWorkspaceSnapshot(serialized);

    expect(parsed).toEqual(persisted);
    expect(validateMotionWorkspaceSnapshot(parsed)).toEqual([]);
  });

  it("still parses and narrows legacy v1 workspace snapshots", () => {
    const snapshot = createMotionWorkspaceSnapshotV1({
      composition: createPromoGridComposition("lift"),
      savedAt: "2026-03-27T00:00:00.000Z",
    });

    const parsed = parseMotionWorkspaceSnapshot(serializeMotionWorkspaceSnapshot(snapshot));

    expect(parsed).toEqual(snapshot);
    expect(isMotionWorkspaceSnapshotV1(parsed)).toBe(true);
    expect(isMotionWorkspaceSnapshotV2(parsed)).toBe(false);
  });
});
