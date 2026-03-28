import { describe, expect, it } from "vitest";
import {
  createMotionStageNodeTarget,
  createMotionCompositionDocument,
  createPromoGridComposition,
  migrateCompositionV1toV2,
} from "motion-content";
import * as workspaceEntry from "./index.js";
import { createMotionWorkspaceController } from "./controller.js";
import { createMotionWorkspaceSnapshot } from "./io.js";

type MotionWorkspaceControllerInstance = ReturnType<typeof createMotionWorkspaceController>;

function createSceneWorkspaceComposition() {
  const base = migrateCompositionV1toV2(createPromoGridComposition("crossfade"));

  return {
    ...base,
    scenes: [
      ...base.scenes,
      {
        id: "stinger",
        title: "Stinger",
        startMs: 5200,
        durationMs: 800,
        layers: [
          {
            targetId: "card-a",
            startMs: 0,
            durationMs: 600,
            enter: { preset: "pop-in" },
          },
        ],
        sequences: [],
        captions: [],
      },
    ],
  };
}

function getLegacyComposition(controller: MotionWorkspaceControllerInstance) {
  const composition = controller.getSession().present.composition;
  if ("scenes" in composition) {
    throw new Error("expected legacy composition");
  }
  return composition;
}

function getSceneComposition(controller: MotionWorkspaceControllerInstance) {
  const composition = controller.getSession().present.composition;
  if (!("scenes" in composition)) {
    throw new Error("expected scene composition");
  }
  return composition;
}

function findScenePlacement(
  controller: MotionWorkspaceControllerInstance,
  sceneId: string,
  targetId: string,
) {
  return getSceneComposition(controller)
    .scenes
    .find((scene) => scene.id === sceneId)
    ?.layers.find((layer) => layer.targetId === targetId);
}

describe("motion workspace controller", () => {
  it("loads legacy workspace snapshots into scene-based sessions while preserving editor state", () => {
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
        selection: { kind: "layer", id: "headline" } as const,
        viewport: {
          zoom: 1.75,
          scrollLeftMs: 240,
          visibleDurationMs: 1800,
        },
        loop: true,
        playbackRate: 1.25,
      },
      globalRevision: 4,
    };

    const controller = createMotionWorkspaceController({
      composition: createPromoGridComposition("crossfade"),
    });

    const loaded = controller.loadWorkspace(JSON.stringify(snapshot));

    expect(loaded).toMatchObject({
      dirty: false,
      checkpointCount: 0,
      workspace: {
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
          values: snapshot.editor.values,
          selection: {
            kind: "scene-layer",
            sceneId: "main",
            targetId: "headline",
          },
          viewport: snapshot.editor.viewport,
          loop: true,
          playbackRate: 1.25,
        },
      },
    });
    expect(controller.getSession().present.selection).toEqual({
      kind: "scene-layer",
      sceneId: "main",
      targetId: "headline",
    });
    expect(controller.getSession().present.viewport).toEqual(snapshot.editor.viewport);
    expect(controller.getSession().present.transport.loop).toBe(true);
    expect(controller.getSession().present.transport.playbackRate).toBe(1.25);
    expect(findScenePlacement(controller, "main", "headline")).toBeDefined();
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
    expect(beforeSave.workspace.globalRevision).toBe(0);
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
    expect(saved.workspace.globalRevision).toBe(1);
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
    expect(parameterApplied.workspace.globalRevision).toBe(0);
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
    expect(getLegacyComposition(controller).sequences.find((sequence) => sequence.id === "intro")).toMatchObject({
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
    expect(getLegacyComposition(controller).layers.some((layer) => layer.id === "layer-8")).toBe(true);

    controller.apply({
      type: "remove-layer",
      layerId: "layer-8",
    });
    expect(controller.getCheckpointCount()).toBe(4);
    expect(getLegacyComposition(controller).layers.some((layer) => layer.id === "layer-8")).toBe(false);

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
    expect(getLegacyComposition(controller).sequences.some((sequence) => sequence.id === "sequence-4")).toBe(true);

    controller.apply({
      type: "remove-sequence",
      sequenceId: "sequence-4",
    });
    expect(controller.getCheckpointCount()).toBe(6);
    expect(getLegacyComposition(controller).sequences.some((sequence) => sequence.id === "sequence-4")).toBe(false);

    controller.apply({
      type: "add-caption",
      id: "cap-5",
      text: "새 캡션 5",
      startMs: 5200,
      durationMs: 900,
      tone: "neutral",
    });
    expect(controller.getCheckpointCount()).toBe(7);
    expect(getLegacyComposition(controller).captions.some((caption) => caption.id === "cap-5")).toBe(true);

    controller.apply({
      type: "remove-caption",
      captionId: "cap-5",
    });
    expect(controller.getCheckpointCount()).toBe(8);
    expect(getLegacyComposition(controller).captions.some((caption) => caption.id === "cap-5")).toBe(false);

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
    expect(getLegacyComposition(controller).transitions.some((transition) => transition.id === "intro-cards-2")).toBe(true);

    controller.apply({
      type: "remove-transition",
      transitionId: "intro-cards-2",
    });
    expect(controller.getCheckpointCount()).toBe(10);
    expect(getLegacyComposition(controller).transitions.some((transition) => transition.id === "intro-cards-2")).toBe(false);

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
        globalRevision: 0,
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

  it("keeps undo/redo and dirty state isolated per scene session", () => {
    const controller = createMotionWorkspaceController({
      composition: createSceneWorkspaceComposition(),
    });

    controller.apply({
      type: "select",
      selection: { kind: "scene", id: "main" },
    });
    controller.apply({
      type: "update-scene-placement-timing",
      sceneId: "main",
      targetId: "headline",
      startMs: 240,
      durationMs: 2100,
    });

    expect(controller.isDirty()).toBe(true);
    expect(controller.getCheckpointCount()).toBe(1);
    expect(findScenePlacement(controller, "main", "headline")).toMatchObject({
      startMs: 240,
      durationMs: 2100,
    });

    controller.apply({
      type: "select",
      selection: { kind: "scene", id: "stinger" },
    });

    expect(controller.isDirty()).toBe(false);
    expect(controller.getCheckpointCount()).toBe(0);
    expect(findScenePlacement(controller, "main", "headline")).toMatchObject({
      startMs: 240,
      durationMs: 2100,
    });

    controller.apply({
      type: "update-scene-placement-timing",
      sceneId: "stinger",
      targetId: "card-a",
      startMs: 120,
      durationMs: 480,
    });

    expect(controller.isDirty()).toBe(true);
    expect(controller.getCheckpointCount()).toBe(1);

    controller.undo();

    expect(controller.isDirty()).toBe(false);
    expect(controller.getCheckpointCount()).toBe(0);
    expect(findScenePlacement(controller, "stinger", "card-a")).toMatchObject({
      startMs: 0,
      durationMs: 600,
    });
    expect(findScenePlacement(controller, "main", "headline")).toMatchObject({
      startMs: 240,
      durationMs: 2100,
    });

    controller.apply({
      type: "select",
      selection: { kind: "scene", id: "main" },
    });

    expect(controller.isDirty()).toBe(true);
    expect(controller.getCheckpointCount()).toBe(1);

    controller.undo();

    expect(controller.isDirty()).toBe(false);
    expect(controller.getCheckpointCount()).toBe(0);
    expect(findScenePlacement(controller, "main", "headline")).toMatchObject({
      startMs: 120,
      durationMs: 2400,
    });

    controller.apply({
      type: "select",
      selection: { kind: "scene", id: "stinger" },
    });

    expect(controller.isDirty()).toBe(false);
    expect(controller.getCheckpointCount()).toBe(0);
    expect(findScenePlacement(controller, "stinger", "card-a")).toMatchObject({
      startMs: 0,
      durationMs: 600,
    });
  });

  it("restores the active scene session when switching between scenes", () => {
    const controller = createMotionWorkspaceController({
      composition: createSceneWorkspaceComposition(),
    });

    controller.apply({
      type: "select",
      selection: { kind: "scene-layer", sceneId: "main", targetId: "headline" },
    });
    controller.apply({
      type: "set-current-time",
      timeMs: 900,
    });

    controller.apply({
      type: "select",
      selection: { kind: "scene-layer", sceneId: "stinger", targetId: "card-a" },
    });
    controller.apply({
      type: "set-current-time",
      timeMs: 3400,
    });

    controller.apply({
      type: "select",
      selection: { kind: "scene-layer", sceneId: "main", targetId: "headline" },
    });

    expect(controller.getSession().present.selection).toEqual({
      kind: "scene-layer",
      sceneId: "main",
      targetId: "headline",
    });
    expect(controller.getSession().present.transport.currentTimeMs).toBe(900);

    controller.apply({
      type: "select",
      selection: { kind: "scene-layer", sceneId: "stinger", targetId: "card-a" },
    });

    expect(controller.getSession().present.selection).toEqual({
      kind: "scene-layer",
      sceneId: "stinger",
      targetId: "card-a",
    });
    expect(controller.getSession().present.transport.currentTimeMs).toBe(3400);
  });

  it("increments only the touched scene revision and reserves globalRevision for scene structure changes", () => {
    const controller = createMotionWorkspaceController({
      composition: createSceneWorkspaceComposition(),
    });

    expect(controller.exportWorkspace()).toMatchObject({
      globalRevision: 0,
      sceneRevisions: {
        main: 0,
        stinger: 0,
      },
    });

    controller.apply({
      type: "select",
      selection: { kind: "scene", id: "main" },
    });
    controller.apply({
      type: "update-scene-placement-timing",
      sceneId: "main",
      targetId: "headline",
      startMs: 240,
      durationMs: 2100,
    });

    const mainSaved = controller.saveWorkspace({
      savedAt: "2026-03-27T02:00:00.000Z",
    });

    expect(mainSaved.workspace).toMatchObject({
      globalRevision: 0,
      sceneRevisions: {
        main: 1,
        stinger: 0,
      },
    });

    controller.apply({
      type: "select",
      selection: { kind: "scene", id: "stinger" },
    });
    controller.apply({
      type: "update-scene-placement-timing",
      sceneId: "stinger",
      targetId: "card-a",
      startMs: 120,
      durationMs: 480,
    });

    const stingerSaved = controller.saveWorkspace({
      savedAt: "2026-03-27T02:10:00.000Z",
    });

    expect(stingerSaved.workspace).toMatchObject({
      globalRevision: 0,
      sceneRevisions: {
        main: 1,
        stinger: 1,
      },
    });

    controller.apply({
      type: "add-scene",
      id: "outro",
      title: "Outro",
      startMs: 6800,
      durationMs: 900,
      layers: [],
      sequences: [],
      captions: [],
    });

    const structureSaved = controller.saveWorkspace({
      savedAt: "2026-03-27T02:20:00.000Z",
    });

    expect(structureSaved.workspace).toMatchObject({
      globalRevision: 1,
      sceneRevisions: {
        main: 1,
        stinger: 1,
        outro: 0,
      },
    });
  });

  it("exports controller helpers from the public entrypoint", () => {
    expect(typeof workspaceEntry.createMotionWorkspaceController).toBe("function");
  });
});
