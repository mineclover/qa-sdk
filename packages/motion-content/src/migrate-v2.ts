import type {
  MotionCaptionCue,
  MotionCompositionDef,
  MotionCompositionDefV2,
  MotionLayerDef,
  MotionSceneDef,
  MotionSceneSequenceDef,
  MotionTargetDef,
} from "./model.js";

type MotionTargetCompat = MotionTargetDef & {
  readonly label?: string;
};

type SceneLayerPlacementCompat = MotionSceneDef["layers"][number] & {
  readonly layerId?: string;
  readonly label?: string;
};

function migrateTarget(
  layer: MotionLayerDef,
): MotionTargetCompat {
  return {
    id: layer.id,
    label: layer.label,
    target: layer.target,
    ...(layer.content ? { content: layer.content } : {}),
  };
}

function migratePlacement(
  layer: MotionLayerDef,
): SceneLayerPlacementCompat {
  return {
    targetId: layer.id,
    layerId: layer.id,
    label: layer.label,
    startMs: layer.startMs,
    durationMs: layer.durationMs,
    enter: layer.enter,
    ...(layer.exit ? { exit: layer.exit } : {}),
  };
}

function migrateSequence(
  sequence: MotionCompositionDef["sequences"][number],
): MotionSceneSequenceDef {
  return {
    id: sequence.id,
    title: sequence.title,
    startMs: sequence.startMs,
    durationMs: sequence.durationMs,
    targetIds: sequence.layerIds,
    ...(sequence.layers
      ? {
        layers: sequence.layers.map((slot) => ({
          targetId: slot.layerId,
          ...(slot.offsetMs !== undefined ? { offsetMs: slot.offsetMs } : {}),
          ...(slot.zIndex !== undefined ? { zIndex: slot.zIndex } : {}),
          ...(slot.role ? { role: slot.role } : {}),
        })),
      }
      : {}),
    ...(sequence.stagger ? { stagger: sequence.stagger } : {}),
    ...(sequence.captionIds ? { captionIds: sequence.captionIds } : {}),
  };
}

export function migrateCompositionV1toV2(
  composition: MotionCompositionDef,
): MotionCompositionDefV2 {
  const mainScene: MotionSceneDef = {
    id: "main",
    title: "Main",
    startMs: 0,
    durationMs: composition.durationMs,
    layers: composition.layers.map(migratePlacement),
    sequences: composition.sequences.map(migrateSequence),
    captions: composition.captions.map((caption: MotionCaptionCue) => ({
      id: caption.id,
      text: caption.text,
      startMs: caption.startMs,
      durationMs: caption.durationMs,
      ...(caption.tone ? { tone: caption.tone } : {}),
    })),
  };

  const migrated = {
    id: composition.id,
    title: composition.title,
    description: composition.description,
    durationMs: composition.durationMs,
    parameters: composition.parameters,
    ...(composition.cuePresets ? { cuePresets: composition.cuePresets } : {}),
    assets: composition.assets,
    targets: composition.layers.map(migrateTarget),
    scenes: [mainScene],
    transitions: composition.transitions,
  };

  return migrated as MotionCompositionDefV2;
}
