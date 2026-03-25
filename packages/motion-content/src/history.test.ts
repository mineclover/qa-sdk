import { describe, expect, it } from "vitest";
import type { MotionEditorCommand } from "./editor.js";
import {
  applyMotionEditorSessionCommand,
  canRedoMotionEditorSession,
  canUndoMotionEditorSession,
  createMotionEditorSession,
  getMotionEditorCheckpointStrategy,
  isMotionEditorSessionDirty,
  previewMotionEditorSessionCommand,
} from "./history.js";
import { createPromoGridComposition } from "./presets.js";

describe("motion editor history", () => {
  it("does not push selection into the undo stack", () => {
    const session = createMotionEditorSession(createPromoGridComposition("crossfade"));

    const next = applyMotionEditorSessionCommand(session, {
      type: "select",
      selection: { kind: "layer", id: "headline" },
    });

    expect(getMotionEditorCheckpointStrategy({ type: "select", selection: null })).toBe("ignore");
    expect(next.past).toHaveLength(0);
    expect(next.present.selection).toEqual({ kind: "layer", id: "headline" });
    expect(canUndoMotionEditorSession(next)).toBe(false);
    expect(isMotionEditorSessionDirty(next)).toBe(false);
  });

  it("keeps drag preview separate from commit", () => {
    const session = createMotionEditorSession(createPromoGridComposition("lift"));
    // sequence 이동으로 테스트 (상대좌표 layer가 있으므로)
    const command: MotionEditorCommand = {
      type: "update-item-timing",
      itemKind: "sequence",
      itemId: "intro",
      startMs: 100,
      durationMs: 1700,
    };

    const preview = previewMotionEditorSessionCommand(session, command);

    expect(preview.composition.sequences.find((s) => s.id === "intro")?.startMs).toBe(100);
    expect(session.present.composition.sequences.find((s) => s.id === "intro")?.startMs).toBe(0);
    expect(canUndoMotionEditorSession(session)).toBe(false);

    const committed = applyMotionEditorSessionCommand(session, command);

    expect(getMotionEditorCheckpointStrategy(command)).toBe("append");
    expect(committed.past).toHaveLength(1);
    expect(canUndoMotionEditorSession(committed)).toBe(true);
    expect(isMotionEditorSessionDirty(committed)).toBe(true);
    expect(committed.present.composition.sequences.find((s) => s.id === "intro")?.startMs).toBe(100);
  });

  it("does not create a checkpoint for a no-op drag commit", () => {
    const session = createMotionEditorSession(createPromoGridComposition("flash"));
    const layer = session.present.composition.layers.find((entry) => entry.id === "headline");
    expect(layer).toBeDefined();

    const committed = applyMotionEditorSessionCommand(session, {
      type: "update-item-timing",
      itemKind: "layer",
      itemId: "headline",
      startMs: layer!.startMs,
      durationMs: layer!.durationMs,
    });

    expect(committed).toBe(session);
    expect(canUndoMotionEditorSession(committed)).toBe(false);
    expect(isMotionEditorSessionDirty(committed)).toBe(false);
  });

  it("treats set-composition as a fresh clean checkpoint", () => {
    const initial = createMotionEditorSession(createPromoGridComposition("crossfade"));
    const edited = applyMotionEditorSessionCommand(initial, {
      type: "set-parameter",
      parameterId: "headline",
      value: "Edited headline",
    });
    const importedComposition = {
      ...createPromoGridComposition("lift"),
      id: "imported-motion",
      title: "Imported Motion",
    };

    const imported = applyMotionEditorSessionCommand(edited, {
      type: "set-composition",
      composition: importedComposition,
      values: { headline: "Imported headline" },
    });

    expect(getMotionEditorCheckpointStrategy({
      type: "set-composition",
      composition: importedComposition,
      values: { headline: "Imported headline" },
    })).toBe("reset");
    expect(imported.past).toHaveLength(0);
    expect(imported.future).toHaveLength(0);
    expect(canUndoMotionEditorSession(imported)).toBe(false);
    expect(canRedoMotionEditorSession(imported)).toBe(false);
    expect(isMotionEditorSessionDirty(imported)).toBe(false);
    expect(imported.present.composition.id).toBe("imported-motion");
    expect(imported.present.values["headline"]).toBe("Imported headline");
  });
});
