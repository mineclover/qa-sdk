import { describe, expect, it } from "vitest";
import {
  createMotionStageNodeTarget,
  createMotionCompositionDocument,
  createPromoGridComposition,
} from "motion-content";
import * as workspaceEntry from "./index.js";
import { createMotionWorkspaceController } from "./controller.js";
import { createMotionWorkspaceSnapshot } from "./io.js";

describe("motion workspace controller", () => {
  it("loads workspace snapshots and restores persisted editor state into the internal session", () => {
    const snapshot = {
      ...createMotionWorkspaceSnapshot({
        composition: createPromoGridComposition("flash"),
        values: {
          headline: "Loaded headline",
        },
        source: {
          storageKey: "workspace:loaded",
        },
        savedAt: "2026-03-27T00:00:00.000Z",
      }),
      editor: {
        values: {
          headline: "Loaded headline",
          subline: "Loaded subline",
          accent: "#445566",
          transitionStyle: "flash",
        },
        selection: { kind: "sequence", id: "cards" } as const,
        viewport: {
          zoom: 1.75,
          scrollLeftMs: 240,
          visibleDurationMs: 1800,
        },
        loop: true,
        playbackRate: 1.25,
      },
      revision: 4,
    };

    const controller = createMotionWorkspaceController({
      composition: createPromoGridComposition("crossfade"),
    });

    const loaded = controller.loadWorkspace(JSON.stringify(snapshot));

    expect(loaded).toEqual({
      workspace: snapshot,
      dirty: false,
      checkpointCount: 0,
    });
    expect(controller.getSession().present.selection).toEqual(snapshot.editor.selection);
    expect(controller.getSession().present.viewport).toEqual(snapshot.editor.viewport);
    expect(controller.getSession().present.transport.loop).toBe(true);
    expect(controller.getSession().present.transport.playbackRate).toBe(1.25);
    expect(controller.isDirty()).toBe(false);
    expect(controller.getRevision()).toBe(4);
    expect(controller.getCheckpointCount()).toBe(0);
  });

  it("exports the current working copy and saveWorkspace commits revision and clears checkpoints", () => {
    const controller = createMotionWorkspaceController({
      composition: createPromoGridComposition("lift"),
      source: {
        presetId: "promo-grid",
      },
      savedAt: "2026-03-27T00:00:00.000Z",
    });

    controller.apply({
      type: "set-parameter",
      parameterId: "headline",
      value: "Saved headline",
    });
    controller.apply({
      type: "select",
      selection: { kind: "layer", id: "headline" },
    });
    controller.apply({
      type: "set-loop",
      loop: true,
    });
    controller.apply({
      type: "set-playback-rate",
      playbackRate: 1.5,
    });

    const beforeSave = controller.getSnapshot();

    expect(beforeSave.dirty).toBe(true);
    expect(beforeSave.checkpointCount).toBe(1);
    expect(beforeSave.workspace.revision).toBe(0);
    expect(beforeSave.workspace.savedAt).toBe("2026-03-27T00:00:00.000Z");
    expect(beforeSave.workspace.editor.values.headline).toBe("Saved headline");
    expect(beforeSave.workspace.editor.selection).toEqual({ kind: "layer", id: "headline" });
    expect(beforeSave.workspace.editor.loop).toBe(true);
    expect(beforeSave.workspace.editor.playbackRate).toBe(1.5);
    expect(controller.exportWorkspace()).toEqual(beforeSave.workspace);
    expect(controller.isDirty()).toBe(true);
    expect(controller.getRevision()).toBe(0);
    expect(controller.getCheckpointCount()).toBe(1);

    const saved = controller.saveWorkspace({
      savedAt: "2026-03-27T01:00:00.000Z",
    });

    // save는 undo/redo 히스토리를 보존해야 한다 (past/future 유지)
    expect(saved.dirty).toBe(true);
    expect(saved.checkpointCount).toBe(1);
    expect(saved.workspace.revision).toBe(1);
    expect(saved.workspace.savedAt).toBe("2026-03-27T01:00:00.000Z");
    expect(saved.workspace.editor.values.headline).toBe("Saved headline");
    expect(saved.workspace.editor.selection).toEqual({ kind: "layer", id: "headline" });
    expect(saved.workspace.editor.loop).toBe(true);
    expect(saved.workspace.editor.playbackRate).toBe(1.5);
    expect(controller.getSession().present.selection).toEqual({ kind: "layer", id: "headline" });
    expect(controller.getSession().present.transport.loop).toBe(true);
    expect(controller.getSession().present.transport.playbackRate).toBe(1.5);
    expect(controller.isDirty()).toBe(true);
    expect(controller.getRevision()).toBe(1);
    expect(controller.getCheckpointCount()).toBe(1);

    // save 후에도 undo가 가능해야 한다
    expect(controller.canUndo()).toBe(true);
  });

  it("applies mutation commands through the shared session/history path", () => {
    const controller = createMotionWorkspaceController({
      composition: createPromoGridComposition("crossfade"),
    });

    expect(controller.isDirty()).toBe(false);
    expect(controller.getRevision()).toBe(0);
    expect(controller.getCheckpointCount()).toBe(0);

    const parameterApplied = controller.apply({
      type: "set-parameter",
      parameterId: "headline",
      value: "Controller headline",
    });

    expect(parameterApplied.dirty).toBe(true);
    expect(parameterApplied.workspace.revision).toBe(0);
    expect(parameterApplied.workspace.editor.values.headline).toBe("Controller headline");
    expect(controller.getSession().present.values.headline).toBe("Controller headline");
    expect(controller.isDirty()).toBe(true);
    expect(controller.getRevision()).toBe(0);
    expect(controller.getCheckpointCount()).toBe(1);

    const timingApplied = controller.apply({
      type: "update-item-timing",
      itemKind: "sequence",
      itemId: "intro",
      startMs: 120,
      durationMs: 1680,
    });

    expect(timingApplied.checkpointCount).toBe(2);
    expect(controller.getSession().present.composition.sequences.find((sequence) => sequence.id === "intro")).toMatchObject({
      startMs: 120,
      durationMs: 1680,
    });

    controller.apply({
      type: "add-layer",
      id: "layer-8",
      label: "Layer 8",
      target: createMotionStageNodeTarget("layer-8"),
      content: { type: "dom" },
      durationMs: 960,
    });
    expect(controller.getCheckpointCount()).toBe(3);
    expect(controller.getSession().present.composition.layers.some((layer) => layer.id === "layer-8")).toBe(true);

    controller.apply({
      type: "remove-layer",
      layerId: "layer-8",
    });
    expect(controller.getCheckpointCount()).toBe(4);
    expect(controller.getSession().present.composition.layers.some((layer) => layer.id === "layer-8")).toBe(false);

    controller.apply({
      type: "add-sequence",
      id: "sequence-4",
      title: "Sequence 4",
      startMs: 5400,
      durationMs: 1200,
      layerIds: ["headline"],
      captionIds: [],
    });
    expect(controller.getCheckpointCount()).toBe(5);
    expect(controller.getSession().present.composition.sequences.some((sequence) => sequence.id === "sequence-4")).toBe(true);

    controller.apply({
      type: "remove-sequence",
      sequenceId: "sequence-4",
    });
    expect(controller.getCheckpointCount()).toBe(6);
    expect(controller.getSession().present.composition.sequences.some((sequence) => sequence.id === "sequence-4")).toBe(false);

    controller.apply({
      type: "add-caption",
      id: "cap-5",
      text: "새 캡션 5",
      startMs: 5200,
      durationMs: 900,
      tone: "neutral",
    });
    expect(controller.getCheckpointCount()).toBe(7);
    expect(controller.getSession().present.composition.captions.some((caption) => caption.id === "cap-5")).toBe(true);

    controller.apply({
      type: "remove-caption",
      captionId: "cap-5",
    });
    expect(controller.getCheckpointCount()).toBe(8);
    expect(controller.getSession().present.composition.captions.some((caption) => caption.id === "cap-5")).toBe(false);

    controller.apply({
      type: "add-transition",
      id: "intro-cards-2",
      fromSequenceId: "intro",
      toSequenceId: "cards",
      style: "flash",
      durationMs: 280,
      params: { glowSize: 96 },
    });
    expect(controller.getCheckpointCount()).toBe(9);
    expect(controller.getSession().present.composition.transitions.some((transition) => transition.id === "intro-cards-2")).toBe(true);

    controller.apply({
      type: "remove-transition",
      transitionId: "intro-cards-2",
    });
    expect(controller.getCheckpointCount()).toBe(10);
    expect(controller.getSession().present.composition.transitions.some((transition) => transition.id === "intro-cards-2")).toBe(false);

    const imported = controller.apply({
      type: "set-composition",
      composition: {
        ...createPromoGridComposition("lift"),
        id: "imported-motion",
        title: "Imported Motion",
      },
      values: {
        headline: "Imported headline",
      },
    });

    expect(imported).toMatchObject({
      dirty: false,
      checkpointCount: 0,
      workspace: {
        revision: 0,
      },
    });
    expect(controller.isDirty()).toBe(false);
    expect(controller.getRevision()).toBe(0);
    expect(controller.getCheckpointCount()).toBe(0);
    expect(controller.getSession().present.composition.id).toBe("imported-motion");
    expect(controller.getSession().present.values.headline).toBe("Imported headline");
  });

  it("exposes preview plus undo/redo helpers over the internal session", () => {
    const controller = createMotionWorkspaceController({
      composition: createPromoGridComposition("crossfade"),
    });

    const preview = controller.preview({
      type: "set-parameter",
      parameterId: "headline",
      value: "Preview headline",
    });

    expect(preview.values.headline).toBe("Preview headline");
    expect(controller.getState().values.headline).toBe("GSAP Motion Canvas");
    expect(controller.canUndo()).toBe(false);
    expect(controller.canRedo()).toBe(false);

    controller.apply({
      type: "set-parameter",
      parameterId: "headline",
      value: "Committed headline",
    });

    expect(controller.canUndo()).toBe(true);
    expect(controller.canRedo()).toBe(false);
    expect(controller.getState().values.headline).toBe("Committed headline");

    controller.undo();
    expect(controller.getState().values.headline).toBe("GSAP Motion Canvas");
    expect(controller.canUndo()).toBe(false);
    expect(controller.canRedo()).toBe(true);

    controller.redo();
    expect(controller.getState().values.headline).toBe("Committed headline");
    expect(controller.canUndo()).toBe(true);
    expect(controller.canRedo()).toBe(false);
  });

  it("loads composition documents and exports the portable document envelope", () => {
    const document = createMotionCompositionDocument(createPromoGridComposition("flash"));
    const controller = createMotionWorkspaceController({
      composition: createPromoGridComposition("crossfade"),
      source: {
        path: "/tmp/promo-grid.motion.json",
      },
    });

    const loaded = controller.loadDocument(document);

    expect(loaded.workspace.document).toEqual(document);
    expect(loaded.workspace.source).toEqual({
      path: "/tmp/promo-grid.motion.json",
    });
    expect(controller.exportDocument()).toEqual(document);
    expect(controller.exportWorkspace().document).toEqual(document);
  });

  it("exports controller helpers from the public entrypoint", () => {
    expect(typeof workspaceEntry.createMotionWorkspaceController).toBe("function");
  });
});
