import type {
  MotionCaptionCue,
  MotionCompositionDef,
  MotionCompositionDefV2,
  MotionLayerDef,
  MotionSceneDef,
  MotionSceneSequenceDef,
  MotionTargetDef,
  MotionTransitionDef,
  SequenceLayerSlot,
} from "./model.js";
import { endMs } from "./utils.js";

type SceneSequenceTargetSlot = NonNullable<MotionSceneSequenceDef["layers"]>[number];

function readOptionalString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : undefined;
}

function readTransitions(
  composition: MotionCompositionDefV2,
): readonly MotionTransitionDef[] {
  const candidate = (composition as { readonly transitions?: unknown }).transitions;
  return Array.isArray(candidate) ? (candidate as readonly MotionTransitionDef[]) : [];
}

function createUniqueId(baseId: string, usedIds: Set<string>): string {
  const normalized = baseId.length > 0 ? baseId : "item";
  if (!usedIds.has(normalized)) {
    usedIds.add(normalized);
    return normalized;
  }

  let suffix = 2;
  let nextId = `${normalized}-${suffix}`;
  while (usedIds.has(nextId)) {
    suffix += 1;
    nextId = `${normalized}-${suffix}`;
  }
  usedIds.add(nextId);
  return nextId;
}

function buildCountMap(values: readonly string[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function sceneTargetKey(sceneId: string, targetId: string): string {
  return `${sceneId}\u0000${targetId}`;
}

function resolveSceneSequenceSlots(
  sequence: MotionSceneSequenceDef,
): readonly SceneSequenceTargetSlot[] {
  if (!sequence.layers || sequence.layers.length === 0) return [];
  if (!sequence.stagger) return sequence.layers;
  const { startOffsetMs, intervalMs } = sequence.stagger;
  return sequence.layers.map((slot, index) => ({
    ...slot,
    offsetMs: slot.offsetMs ?? startOffsetMs + index * intervalMs,
  }));
}

function shouldPreserveSequenceTiming(
  scene: MotionSceneDef,
  sequence: MotionSceneSequenceDef,
): boolean {
  if (!sequence.layers || sequence.layers.length === 0) return true;

  const placementByTargetId = new Map(
    scene.layers.map((placement) => [placement.targetId, placement]),
  );

  return resolveSceneSequenceSlots(sequence).every((slot) => {
    if (slot.offsetMs === undefined) return true;
    const placement = placementByTargetId.get(slot.targetId);
    return placement ? sequence.startMs + slot.offsetMs === placement.startMs : false;
  });
}

function buildSequenceLayers(
  scene: MotionSceneDef,
  sequence: MotionSceneSequenceDef,
  layerIdBySceneTarget: ReadonlyMap<string, string>,
): {
  readonly layers?: readonly SequenceLayerSlot[];
  readonly stagger?: MotionSceneSequenceDef["stagger"];
} {
  if (!sequence.layers || sequence.layers.length === 0) return {};

  if (shouldPreserveSequenceTiming(scene, sequence)) {
    return {
      layers: sequence.layers.map((slot) => ({
        layerId: layerIdBySceneTarget.get(sceneTargetKey(scene.id, slot.targetId)) ?? slot.targetId,
        ...(slot.offsetMs !== undefined ? { offsetMs: slot.offsetMs } : {}),
        ...(slot.zIndex !== undefined ? { zIndex: slot.zIndex } : {}),
        ...(slot.role ? { role: slot.role } : {}),
      })),
      ...(sequence.stagger ? { stagger: sequence.stagger } : {}),
    };
  }

  const placementByTargetId = new Map(
    scene.layers.map((placement) => [placement.targetId, placement]),
  );

  return {
    layers: sequence.layers.map((slot) => {
      const placement = placementByTargetId.get(slot.targetId);
      const offsetMs = placement ? placement.startMs - sequence.startMs : undefined;
      return {
        layerId: layerIdBySceneTarget.get(sceneTargetKey(scene.id, slot.targetId)) ?? slot.targetId,
        ...(offsetMs !== undefined ? { offsetMs } : {}),
        ...(slot.zIndex !== undefined ? { zIndex: slot.zIndex } : {}),
        ...(slot.role ? { role: slot.role } : {}),
      };
    }),
  };
}

export function assembleComposition(
  composition: MotionCompositionDefV2,
): MotionCompositionDef {
  const targetById = new Map<string, MotionTargetDef>(
    composition.targets.map((target) => [target.id, target]),
  );
  const targetUsageCounts = buildCountMap(
    composition.scenes.flatMap((scene) => scene.layers.map((placement) => placement.targetId)),
  );
  const sequenceIdCounts = buildCountMap(
    composition.scenes.flatMap((scene) => scene.sequences.map((sequence) => sequence.id)),
  );
  const captionIdCounts = buildCountMap(
    composition.scenes.flatMap((scene) => scene.captions.map((caption) => caption.id)),
  );

  const usedLayerIds = new Set<string>();
  const usedSequenceIds = new Set<string>();
  const usedCaptionIds = new Set<string>();
  const layerIdBySceneTarget = new Map<string, string>();
  const sequenceIdBySceneSequence = new Map<string, string>();
  const captionIdBySceneCaption = new Map<string, string>();
  const sequenceIdByOriginalId = new Map<string, string>();

  const layers: MotionLayerDef[] = [];

  for (const scene of composition.scenes) {
    for (const placement of scene.layers) {
      const target = targetById.get(placement.targetId);
      if (!target) continue;

      const explicitLayerId = readOptionalString(placement, "layerId");
      const candidateLayerId = explicitLayerId
        ?? ((targetUsageCounts.get(placement.targetId) ?? 0) === 1
          ? placement.targetId
          : `${scene.id}-${placement.targetId}`);
      const layerId = createUniqueId(candidateLayerId, usedLayerIds);
      const key = sceneTargetKey(scene.id, placement.targetId);
      if (!layerIdBySceneTarget.has(key)) {
        layerIdBySceneTarget.set(key, layerId);
      }

      layers.push({
        id: layerId,
        label: readOptionalString(placement, "label")
          ?? readOptionalString(target, "label")
          ?? placement.targetId,
        target: target.target,
        ...(target.content ? { content: target.content } : {}),
        startMs: scene.startMs + placement.startMs,
        durationMs: placement.durationMs,
        enter: placement.enter,
        ...(placement.exit ? { exit: placement.exit } : {}),
      });
    }
  }

  const captions: MotionCaptionCue[] = [];

  for (const scene of composition.scenes) {
    for (const caption of scene.captions) {
      const candidateCaptionId = (captionIdCounts.get(caption.id) ?? 0) === 1
        ? caption.id
        : `${scene.id}-${caption.id}`;
      const captionId = createUniqueId(candidateCaptionId, usedCaptionIds);
      captionIdBySceneCaption.set(sceneTargetKey(scene.id, caption.id), captionId);
      captions.push({
        id: captionId,
        text: caption.text,
        startMs: scene.startMs + caption.startMs,
        durationMs: caption.durationMs,
        ...(caption.tone ? { tone: caption.tone } : {}),
      });
    }
  }

  const sequences = composition.scenes.flatMap((scene) =>
    scene.sequences.map((sequence) => {
      const candidateSequenceId = (sequenceIdCounts.get(sequence.id) ?? 0) === 1
        ? sequence.id
        : `${scene.id}-${sequence.id}`;
      const sequenceId = createUniqueId(candidateSequenceId, usedSequenceIds);
      const compositeKey = sceneTargetKey(scene.id, sequence.id);
      sequenceIdBySceneSequence.set(compositeKey, sequenceId);
      if ((sequenceIdCounts.get(sequence.id) ?? 0) === 1) {
        sequenceIdByOriginalId.set(sequence.id, sequenceId);
      }

      const layerIds = sequence.targetIds.map((targetId) =>
        layerIdBySceneTarget.get(sceneTargetKey(scene.id, targetId)) ?? targetId
      );
      const sequenceLayers = buildSequenceLayers(scene, sequence, layerIdBySceneTarget);

      return {
        id: sequenceId,
        title: sequence.title,
        startMs: scene.startMs + sequence.startMs,
        durationMs: sequence.durationMs,
        layerIds,
        ...(sequenceLayers.layers ? { layers: sequenceLayers.layers } : {}),
        ...(sequenceLayers.stagger ? { stagger: sequenceLayers.stagger } : {}),
        ...(sequence.captionIds
          ? {
            captionIds: sequence.captionIds.map((captionId) =>
              captionIdBySceneCaption.get(sceneTargetKey(scene.id, captionId)) ?? captionId
            ),
          }
          : {}),
      };
    }),
  );

  const transitions = readTransitions(composition).map((transition) => ({
    ...transition,
    fromSequenceId: sequenceIdByOriginalId.get(transition.fromSequenceId)
      ?? sequenceIdBySceneSequence.get(sceneTargetKey("main", transition.fromSequenceId))
      ?? transition.fromSequenceId,
    toSequenceId: sequenceIdByOriginalId.get(transition.toSequenceId)
      ?? sequenceIdBySceneSequence.get(sceneTargetKey("main", transition.toSequenceId))
      ?? transition.toSequenceId,
  }));

  const durationMs = Math.max(
    composition.durationMs,
    ...composition.scenes.map((scene) => endMs(scene)),
    ...layers.map((layer) => endMs(layer)),
    ...sequences.map((sequence) => endMs(sequence)),
    ...captions.map((caption) => endMs(caption)),
  );

  return {
    id: composition.id,
    title: composition.title,
    description: composition.description,
    durationMs,
    parameters: composition.parameters,
    ...(composition.cuePresets ? { cuePresets: composition.cuePresets } : {}),
    assets: composition.assets,
    layers,
    sequences,
    captions,
    transitions,
  };
}
