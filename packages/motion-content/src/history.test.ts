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
  redoMotionEditorSession,
  undoMotionEditorSession,
} from "./history.js";
import { migrateCompositionV1toV2 } from "./migrate-v2.js";
import { createMotionStageNodeTarget } from "./model.js";
import { createPromoGridComposition } from "./presets.js";

function createSceneEditorSession() {
  return createMotionEditorSession(
    migrateCompositionV1toV2(createPromoGridComposition("crossfade")),
  );
}

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

  it("treats layer add/remove as append checkpoints", () => {
    const session = createMotionEditorSession(createPromoGridComposition("flash"));

    const added = applyMotionEditorSessionCommand(session, {
      type: "add-layer",
      id: "layer-8",
      label: "Layer 8",
      target: createMotionStageNodeTarget("layer-8"),
      content: { type: "dom" },
      durationMs: 960,
    });

    expect(getMotionEditorCheckpointStrategy({
      type: "add-layer",
      id: "layer-8",
      label: "Layer 8",
      target: createMotionStageNodeTarget("layer-8"),
      content: { type: "dom" },
      durationMs: 960,
    })).toBe("append");
    expect(added.past).toHaveLength(1);

    const removed = applyMotionEditorSessionCommand(added, {
      type: "remove-layer",
      layerId: "layer-8",
    });

    expect(getMotionEditorCheckpointStrategy({
      type: "remove-layer",
      layerId: "layer-8",
    })).toBe("append");
    expect(removed.past).toHaveLength(2);
    expect(removed.present.composition.layers.some((layer) => layer.id === "layer-8")).toBe(false);
  });

  it("treats sequence/caption/transition CRUD as append checkpoints", () => {
    const session = createMotionEditorSession(createPromoGridComposition("crossfade"));

    const withSequence = applyMotionEditorSessionCommand(session, {
      type: "add-sequence",
      id: "sequence-4",
      title: "Sequence 4",
      startMs: 5400,
      durationMs: 1200,
      layerIds: [],
      captionIds: [],
    });
    expect(withSequence.past).toHaveLength(1);

    const withCaption = applyMotionEditorSessionCommand(withSequence, {
      type: "add-caption",
      id: "cap-5",
      text: "새 캡션 5",
      startMs: 5200,
      durationMs: 900,
      tone: "neutral",
    });
    expect(withCaption.past).toHaveLength(2);

    const withTransition = applyMotionEditorSessionCommand(withCaption, {
      type: "add-transition",
      id: "intro-cards-2",
      fromSequenceId: "intro",
      toSequenceId: "cards",
      style: "flash",
      durationMs: 280,
      params: { glowSize: 96 },
    });
    expect(withTransition.past).toHaveLength(3);

    const withoutTransition = applyMotionEditorSessionCommand(withTransition, {
      type: "remove-transition",
      transitionId: "intro-cards-2",
    });
    expect(withoutTransition.past).toHaveLength(4);

    const withoutCaption = applyMotionEditorSessionCommand(withoutTransition, {
      type: "remove-caption",
      captionId: "cap-5",
    });
    expect(withoutCaption.past).toHaveLength(5);

    const withoutSequence = applyMotionEditorSessionCommand(withoutCaption, {
      type: "remove-sequence",
      sequenceId: "sequence-4",
    });
    expect(withoutSequence.past).toHaveLength(6);
  });

  it("treats selection detail numeric edits as append checkpoints", () => {
    const session = createMotionEditorSession(createPromoGridComposition("flash"));

    const slotEdited = applyMotionEditorSessionCommand(session, {
      type: "update-sequence-layer-slot",
      sequenceId: "intro",
      layerId: "headline",
      field: "offsetMs",
      value: 180,
    });
    expect(slotEdited.past).toHaveLength(1);

    const staggerEdited = applyMotionEditorSessionCommand(slotEdited, {
      type: "update-sequence-stagger",
      sequenceId: "cards",
      field: "intervalMs",
      value: 320,
    });
    expect(staggerEdited.past).toHaveLength(2);

    const transitionEdited = applyMotionEditorSessionCommand(staggerEdited, {
      type: "update-transition-param",
      transitionId: "intro-cards",
      param: "glowSize",
      value: 144,
    });
    expect(transitionEdited.past).toHaveLength(3);
  });

  it("treats selection detail string edits as append checkpoints", () => {
    const session = createMotionEditorSession(createPromoGridComposition("crossfade"));

    const labelEdited = applyMotionEditorSessionCommand(session, {
      type: "update-item-string",
      itemKind: "layer",
      itemId: "headline",
      value: "새 레이어 라벨",
    });
    expect(labelEdited.past).toHaveLength(1);

    const titleEdited = applyMotionEditorSessionCommand(labelEdited, {
      type: "update-item-string",
      itemKind: "sequence",
      itemId: "cards",
      value: "카드 시퀀스",
    });
    expect(titleEdited.past).toHaveLength(2);

    const textEdited = applyMotionEditorSessionCommand(titleEdited, {
      type: "update-item-string",
      itemKind: "caption",
      itemId: "cap-2",
      value: "두 번째 캡션",
    });
    expect(textEdited.past).toHaveLength(3);
  });

  it("treats selection detail enum/color edits as append checkpoints", () => {
    const session = createMotionEditorSession(createPromoGridComposition("crossfade"));

    const cueEdited = applyMotionEditorSessionCommand(session, {
      type: "update-layer-cue-kind",
      layerId: "headline",
      cue: "enter",
      kind: "scale-pop",
    });
    expect(cueEdited.past).toHaveLength(1);

    const contentEdited = applyMotionEditorSessionCommand(cueEdited, {
      type: "update-layer-content-type",
      layerId: "headline",
      contentType: "video",
    });
    expect(contentEdited.past).toHaveLength(2);

    const roleEdited = applyMotionEditorSessionCommand(contentEdited, {
      type: "update-sequence-layer-role",
      sequenceId: "intro",
      layerId: "headline",
      role: "overlay",
    });
    expect(roleEdited.past).toHaveLength(3);

    const styleEdited = applyMotionEditorSessionCommand(roleEdited, {
      type: "update-transition-style",
      transitionId: "intro-cards",
      style: "flash",
    });
    expect(styleEdited.past).toHaveLength(4);

    const colorEdited = applyMotionEditorSessionCommand(styleEdited, {
      type: "update-transition-param",
      transitionId: "intro-cards",
      param: "glowColor",
      value: "rgba(17,34,51,0.24)",
    });
    expect(colorEdited.past).toHaveLength(5);

    const presetEdited = applyMotionEditorSessionCommand(colorEdited, {
      type: "update-layer-cue-preset",
      layerId: "card-a",
      cue: "enter",
      presetId: "slide-up-default",
    });
    expect(presetEdited.past).toHaveLength(6);
  });

  it("treats scene CRUD as append checkpoints and supports undo/redo", () => {
    const session = createSceneEditorSession();

    const added = applyMotionEditorSessionCommand(session, {
      type: "add-scene",
      id: "stinger",
      title: "Stinger",
      startMs: 5200,
      durationMs: 800,
      layers: [
        {
          targetId: "chip",
          startMs: 40,
          durationMs: 600,
          enter: { preset: "slide-up-default" },
        },
      ],
      sequences: [
        {
          id: "stinger-seq",
          title: "Stinger Sequence",
          startMs: 20,
          durationMs: 700,
          targetIds: ["chip"],
          layers: [{ targetId: "chip", role: "accent", zIndex: 2 }],
          captionIds: ["stinger-cap"],
        },
      ],
      captions: [
        {
          id: "stinger-cap",
          text: "씬 캡션",
          startMs: 80,
          durationMs: 500,
          tone: "accent",
        },
      ],
    });
    expect(getMotionEditorCheckpointStrategy({
      type: "add-scene",
      id: "stinger",
      title: "Stinger",
      startMs: 5200,
      durationMs: 800,
      layers: [],
      sequences: [],
      captions: [],
    })).toBe("append");

    const renamed = applyMotionEditorSessionCommand(added, {
      type: "rename-scene",
      sceneId: "stinger",
      title: "Stinger Final",
    });
    const retimed = applyMotionEditorSessionCommand(renamed, {
      type: "update-scene-timing",
      sceneId: "stinger",
      startMs: 6500,
      durationMs: 900,
    });
    const removed = applyMotionEditorSessionCommand(retimed, {
      type: "remove-scene",
      sceneId: "stinger",
    });

    expect(removed.past).toHaveLength(4);
    expect(removed.present.composition.scenes.some((scene) => scene.id === "stinger")).toBe(false);
    expect(canUndoMotionEditorSession(removed)).toBe(true);

    const undoneRemove = undoMotionEditorSession(removed);
    expect(undoneRemove.present.composition.scenes.find((scene) => scene.id === "stinger")).toMatchObject({
      title: "Stinger Final",
      startMs: 6480,
      durationMs: 120,
    });
    expect(canRedoMotionEditorSession(undoneRemove)).toBe(true);

    const undoneRetime = undoMotionEditorSession(undoneRemove);
    expect(undoneRetime.present.composition.scenes.find((scene) => scene.id === "stinger")).toMatchObject({
      title: "Stinger Final",
      startMs: 5200,
      durationMs: 800,
    });

    const redoneRetime = redoMotionEditorSession(undoneRetime);
    const redoneRemove = redoMotionEditorSession(redoneRetime);
    expect(redoneRemove.present.composition.scenes.some((scene) => scene.id === "stinger")).toBe(false);
    expect(canRedoMotionEditorSession(redoneRemove)).toBe(false);
  });

  it("treats scene placement commands as append checkpoints and supports undo/redo", () => {
    const session = createSceneEditorSession();

    const withScene = applyMotionEditorSessionCommand(session, {
      type: "add-scene",
      id: "stinger",
      title: "Stinger",
      startMs: 5200,
      durationMs: 800,
      layers: [],
      sequences: [],
      captions: [],
    });
    const withPlacement = applyMotionEditorSessionCommand(withScene, {
      type: "add-scene-placement",
      sceneId: "stinger",
      targetId: "chip",
    });
    expect(getMotionEditorCheckpointStrategy({
      type: "add-scene-placement",
      sceneId: "stinger",
      targetId: "chip",
    })).toBe("append");

    const retimed = applyMotionEditorSessionCommand(withPlacement, {
      type: "update-scene-placement-timing",
      sceneId: "stinger",
      targetId: "chip",
      startMs: 780,
      durationMs: 200,
    });
    const cueEdited = applyMotionEditorSessionCommand(retimed, {
      type: "update-scene-placement-cue",
      sceneId: "stinger",
      targetId: "chip",
      cue: "enter",
      cueRef: { kind: "scale-pop", durationMs: 360 },
    });
    const removed = applyMotionEditorSessionCommand(cueEdited, {
      type: "remove-scene-placement",
      sceneId: "stinger",
      targetId: "chip",
    });

    expect(removed.past).toHaveLength(5);
    expect(
      removed.present.composition.scenes.find((scene) => scene.id === "stinger")?.layers.some((placement) => placement.targetId === "chip"),
    ).toBe(false);

    const undoneRemove = undoMotionEditorSession(removed);
    expect(undoneRemove.present.composition.scenes.find((scene) => scene.id === "stinger")?.layers[0]).toMatchObject({
      targetId: "chip",
      startMs: 680,
      durationMs: 120,
      enter: { kind: "scale-pop", durationMs: 360 },
    });
    expect(canRedoMotionEditorSession(undoneRemove)).toBe(true);

    const redoneRemove = redoMotionEditorSession(undoneRemove);
    expect(
      redoneRemove.present.composition.scenes.find((scene) => scene.id === "stinger")?.layers.some((placement) => placement.targetId === "chip"),
    ).toBe(false);
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
