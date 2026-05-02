import {
  findCaptionById,
  findLayerById,
  findSequenceById,
  findTransitionById,
  getSequenceLayerSlots,
  resolveMotionTransitionWindow,
  type MotionEditorCommand,
  type MotionEditorState,
  type MotionSetCompositionCommand,
  type MotionCompositionSchema,
  type ResolvedMotionCompositionSchema,
  type MotionRuntimeSnapshot,
  type MotionTransportState,
} from "./editor.js";
import {
  resolveMotionComposition,
  resolveMotionCompositionV2,
  isCuePresetRef,
  type MotionCompositionDef,
  type MotionCompositionDefV2,
  type MotionCueKind,
  type MotionCueRef,
  type MotionLayerContent,
  type MotionLayerContentType,
  type MotionParameterValues,
  type MotionSceneDef,
  type MotionSceneSequenceDef,
  type MotionSequenceDef,
  type MotionTransitionParams,
  type MotionTransitionStyle,
  type ResolvedMotionComposition,
  type ResolvedMotionCompositionV2,
  type SequenceLayerSlot,
  type SequenceLayerSlotRole,
} from "./model.js";
import { clamp, normalizePlaybackRate, MIN_TIMELINE_WINDOW_MS } from "./utils.js";

const FALLBACK_LAYER_ENTER_CUE = { kind: "fade", durationMs: 420 } as const;

function createTransport(durationMs: number): MotionTransportState {
  return {
    playing: false,
    currentTimeMs: 0,
    durationMs,
    loop: false,
    playbackRate: 1,
  };
}

function createDefaultEnterCue(
  composition: { readonly cuePresets?: readonly { readonly id: string }[] },
): MotionCueRef {
  const defaultPresetId = composition.cuePresets?.find((preset) => preset.id === "slide-up-default")?.id
    ?? composition.cuePresets?.[0]?.id;
  if (defaultPresetId) {
    return { preset: defaultPresetId };
  }
  return { ...FALLBACK_LAYER_ENTER_CUE };
}

function clampTimelineWindow(
  startMs: number,
  durationMs: number,
  compositionDurationMs: number,
): { readonly startMs: number; readonly durationMs: number } {
  const totalDurationMs = Math.max(0, compositionDurationMs);
  const minimumDurationMs = Math.min(MIN_TIMELINE_WINDOW_MS, totalDurationMs);
  const nextStartMs = clamp(
    Math.round(startMs),
    0,
    Math.max(0, totalDurationMs - minimumDurationMs),
  );
  const maxDurationMs = Math.max(minimumDurationMs, totalDurationMs - nextStartMs);
  return {
    startMs: nextStartMs,
    durationMs: clamp(Math.round(durationMs), minimumDurationMs, maxDurationMs),
  };
}

function normalizeMotionCompositionTimeline(
  composition: MotionCompositionDef,
): MotionCompositionDef {
  // 1. sequence 정규화 + layerIds를 layers에서 파생 + offsetMs clamp
  const sequences = composition.sequences.map((sequence) => {
    const clamped = clampTimelineWindow(sequence.startMs, sequence.durationMs, composition.durationMs);
    if (!sequence.layers || sequence.layers.length === 0) {
      return { ...sequence, ...clamped };
    }
    const normalizedSlots = sequence.layers.map((slot) => {
      if (slot.offsetMs === undefined) return slot;
      const layer = composition.layers.find((l) => l.id === slot.layerId);
      if (!layer) return slot;
      const maxOffset = Math.max(0, composition.durationMs - clamped.startMs - MIN_TIMELINE_WINDOW_MS);
      return { ...slot, offsetMs: clamp(Math.round(slot.offsetMs), 0, maxOffset) };
    });
    // layers가 있으면 layerIds를 파생 — 이중 데이터 제거
    return {
      ...sequence,
      ...clamped,
      layers: normalizedSlots,
      layerIds: normalizedSlots.map((s) => s.layerId),
    };
  });

  // 2. 상대좌표 layer의 startMs를 resolved 값으로 동기화 (dead data 제거)
  const resolvedStartByLayerId = new Map<string, number>();
  for (const seq of sequences) {
    for (const slot of getSequenceLayerSlots(seq)) {
      if (slot.offsetMs !== undefined) {
        resolvedStartByLayerId.set(slot.layerId, seq.startMs + slot.offsetMs);
      }
    }
  }

  const layers = composition.layers.map((layer) => {
    const resolvedStart = resolvedStartByLayerId.get(layer.id);
    if (resolvedStart !== undefined) {
      // 상대좌표: layer.startMs를 resolved 값으로 동기화
      return { ...layer, startMs: resolvedStart };
    }
    // 절대좌표: 기존 clamp
    return { ...layer, ...clampTimelineWindow(layer.startMs, layer.durationMs, composition.durationMs) };
  });

  const captions = composition.captions.map((caption) => ({
    ...caption,
    ...clampTimelineWindow(caption.startMs, caption.durationMs, composition.durationMs),
  }));
  const draft = { ...composition, layers, sequences, captions };
  const transitions = draft.transitions.map((transition) => ({
    ...transition,
    durationMs: resolveMotionTransitionWindow(draft, transition).durationMs,
  }));
  return { ...draft, transitions };
}

function isMotionCompositionV2(
  composition: MotionCompositionSchema | ResolvedMotionCompositionSchema,
): composition is MotionCompositionDefV2 | ResolvedMotionCompositionV2 {
  return "targets" in composition && "scenes" in composition;
}

function normalizeSceneTimeline(
  scene: MotionSceneDef,
  compositionDurationMs: number,
): MotionSceneDef {
  const clampedScene = clampTimelineWindow(scene.startMs, scene.durationMs, compositionDurationMs);
  return {
    ...scene,
    ...clampedScene,
    layers: scene.layers.map((placement) => ({
      ...placement,
      ...clampTimelineWindow(placement.startMs, placement.durationMs, clampedScene.durationMs),
    })),
    sequences: scene.sequences.map((sequence) => {
      const clamped = clampTimelineWindow(sequence.startMs, sequence.durationMs, clampedScene.durationMs);
      if (!sequence.layers || sequence.layers.length === 0) {
        return { ...sequence, ...clamped };
      }
      return {
        ...sequence,
        ...clamped,
        targetIds: sequence.layers.map((slot) => slot.targetId),
      };
    }),
    captions: scene.captions.map((caption) => ({
      ...caption,
      ...clampTimelineWindow(caption.startMs, caption.durationMs, clampedScene.durationMs),
    })),
  };
}

function normalizeMotionCompositionTimelineV2(
  composition: MotionCompositionDefV2,
): MotionCompositionDefV2 {
  return {
    ...composition,
    scenes: composition.scenes.map((scene) =>
      normalizeSceneTimeline(scene, composition.durationMs)
    ),
  };
}

function resolveMotionCompositionSchema(
  composition: MotionCompositionSchema | ResolvedMotionCompositionSchema,
  overrides: Partial<MotionParameterValues> = {},
): ResolvedMotionCompositionSchema {
  return isMotionCompositionV2(composition)
    ? resolveMotionCompositionV2(normalizeMotionCompositionTimelineV2(composition), overrides)
    : resolveMotionComposition(normalizeMotionCompositionTimeline(composition), overrides);
}

function removeLayerReferencesFromSequence(
  sequence: MotionSequenceDef,
  layerId: string,
): MotionSequenceDef {
  const nextLayerIds = sequence.layerIds.filter((entry) => entry !== layerId);
  const nextLayers = sequence.layers?.filter((slot) => slot.layerId !== layerId);
  const changed = nextLayerIds.length !== sequence.layerIds.length
    || (sequence.layers !== undefined && nextLayers !== undefined && nextLayers.length !== sequence.layers.length);
  if (!changed) {
    return sequence;
  }
  return {
    ...sequence,
    layerIds: nextLayerIds,
    layers: nextLayers,
  };
}

function removeCaptionReferencesFromSequence(
  sequence: MotionSequenceDef,
  captionId: string,
): MotionSequenceDef {
  const nextCaptionIds = sequence.captionIds?.filter((entry) => entry !== captionId);
  const changed = (sequence.captionIds?.length ?? 0) !== (nextCaptionIds?.length ?? 0);
  if (!changed) {
    return sequence;
  }
  return {
    ...sequence,
    captionIds: nextCaptionIds ?? [],
  };
}

function removeLayerFromComposition(
  composition: MotionCompositionDef,
  layerId: string,
): MotionCompositionDef {
  const nextLayers = composition.layers.filter((layer) => layer.id !== layerId);
  if (nextLayers.length === composition.layers.length) {
    return composition;
  }
  return {
    ...composition,
    layers: nextLayers,
    sequences: composition.sequences.map((sequence) =>
      removeLayerReferencesFromSequence(sequence, layerId)
    ),
  };
}

function removeCaptionFromComposition(
  composition: MotionCompositionDef,
  captionId: string,
): MotionCompositionDef {
  const nextCaptions = composition.captions.filter((caption) => caption.id !== captionId);
  if (nextCaptions.length === composition.captions.length) {
    return composition;
  }
  return {
    ...composition,
    captions: nextCaptions,
    sequences: composition.sequences.map((sequence) =>
      removeCaptionReferencesFromSequence(sequence, captionId)
    ),
  };
}

function removeSequenceFromComposition(
  composition: MotionCompositionDef,
  sequenceId: string,
): MotionCompositionDef {
  const nextSequences = composition.sequences.filter((sequence) => sequence.id !== sequenceId);
  if (nextSequences.length === composition.sequences.length) {
    return composition;
  }
  return {
    ...composition,
    sequences: nextSequences,
    transitions: composition.transitions.filter((transition) =>
      transition.fromSequenceId !== sequenceId && transition.toSequenceId !== sequenceId
    ),
  };
}

function removeTransitionFromComposition(
  composition: MotionCompositionDef,
  transitionId: string,
): MotionCompositionDef {
  const nextTransitions = composition.transitions.filter((transition) => transition.id !== transitionId);
  if (nextTransitions.length === composition.transitions.length) {
    return composition;
  }
  return {
    ...composition,
    transitions: nextTransitions,
  };
}

function findSceneById(
  composition: MotionCompositionDefV2,
  sceneId: string,
): MotionSceneDef | undefined {
  return composition.scenes.find((scene) => scene.id === sceneId);
}

function removeSceneFromComposition(
  composition: MotionCompositionDefV2,
  sceneId: string,
): MotionCompositionDefV2 {
  const nextScenes = composition.scenes.filter((scene) => scene.id !== sceneId);
  if (nextScenes.length === composition.scenes.length) {
    return composition;
  }
  return {
    ...composition,
    scenes: nextScenes,
  };
}

function removeTargetReferencesFromSceneSequence(
  sequence: MotionSceneSequenceDef,
  targetId: string,
): MotionSceneSequenceDef {
  const nextTargetIds = sequence.targetIds.filter((entry) => entry !== targetId);
  const nextLayers = sequence.layers?.filter((slot) => slot.targetId !== targetId);
  const changed = nextTargetIds.length !== sequence.targetIds.length
    || (sequence.layers !== undefined && nextLayers !== undefined && nextLayers.length !== sequence.layers.length);
  if (!changed) {
    return sequence;
  }
  return {
    ...sequence,
    targetIds: nextTargetIds,
    layers: nextLayers,
  };
}

function removePlacementFromScene(
  scene: MotionSceneDef,
  targetId: string,
): MotionSceneDef {
  const nextLayers = scene.layers.filter((placement) => placement.targetId !== targetId);
  if (nextLayers.length === scene.layers.length) {
    return scene;
  }
  return {
    ...scene,
    layers: nextLayers,
    sequences: scene.sequences.map((sequence) =>
      removeTargetReferencesFromSceneSequence(sequence, targetId)
    ),
  };
}

function cueRefsEqual(
  left: MotionCueRef | undefined,
  right: MotionCueRef | undefined,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function createEditableSequenceLayers(
  sequence: MotionSequenceDef,
): readonly SequenceLayerSlot[] {
  const storedLayers = sequence.layers ?? [];
  const storedById = new Map(storedLayers.map((slot) => [slot.layerId, slot] as const));
  const orderedLayerIds = [
    ...(storedLayers.length > 0
    ? storedLayers.map((slot) => slot.layerId)
    : sequence.layerIds),
  ];

  for (const layerId of sequence.layerIds) {
    if (!orderedLayerIds.includes(layerId)) {
      orderedLayerIds.push(layerId);
    }
  }

  return orderedLayerIds.map((layerId) => storedById.get(layerId) ?? { layerId });
}

function updateSequenceSlot(
  sequence: MotionSequenceDef,
  layerId: string,
  field: "offsetMs" | "zIndex",
  value: number,
): MotionSequenceDef {
  const nextValue = field === "offsetMs"
    ? Math.max(0, Math.round(value))
    : Math.round(value);
  const layers = createEditableSequenceLayers(sequence);
  let changed = false;
  let found = false;
  const nextLayers = layers.map((slot) => {
    if (slot.layerId !== layerId) {
      return slot;
    }
    found = true;
    if (slot[field] === nextValue) {
      return slot;
    }
    changed = true;
    return Object.assign({}, slot, { [field]: nextValue });
  });
  if (!found || !changed) {
    return sequence;
  }
  return {
    ...sequence,
    layers: nextLayers,
  };
}

function updateSequenceSlotRole(
  sequence: MotionSequenceDef,
  layerId: string,
  role: SequenceLayerSlotRole | null,
): MotionSequenceDef {
  const nextRole = role ?? undefined;
  const layers = createEditableSequenceLayers(sequence);
  let changed = false;
  let found = false;
  const nextLayers = layers.map((slot) => {
    if (slot.layerId !== layerId) {
      return slot;
    }
    found = true;
    if (slot.role === nextRole) {
      return slot;
    }
    changed = true;
    return nextRole === undefined
      ? { layerId: slot.layerId, offsetMs: slot.offsetMs, zIndex: slot.zIndex }
      : Object.assign({}, slot, { role: nextRole });
  });
  if (!found || !changed) {
    return sequence;
  }
  return {
    ...sequence,
    layers: nextLayers,
  };
}

function createLayerContentForType(
  contentType: MotionLayerContentType,
  current: MotionLayerContent | undefined,
): MotionLayerContent {
  if (current?.type === contentType) {
    return current;
  }

  switch (contentType) {
    case "dom":
      return { type: "dom" };
    case "image":
      return {
        type: "image",
        src: current && "src" in current ? current.src : "",
      };
    case "video":
      return {
        type: "video",
        src: current && "src" in current ? current.src : "",
      };
    case "svg":
      return {
        type: "svg",
        viewBox: current?.type === "svg" ? current.viewBox : undefined,
      };
    case "canvas":
      return {
        type: "canvas",
        width: current?.type === "canvas" ? current.width : undefined,
        height: current?.type === "canvas" ? current.height : undefined,
      };
  }
}

function updateLayerCueKind(
  composition: MotionCompositionDef,
  layerId: string,
  cue: "enter" | "exit",
  kind: MotionCueKind,
): MotionCompositionDef {
  const nextLayers = composition.layers.map((layer) => {
    if (layer.id !== layerId) {
      return layer;
    }
    const ref = cue === "enter" ? layer.enter : layer.exit;
    if (!ref || isCuePresetRef(ref) || ref.kind === kind) {
      return layer;
    }
    const nextRef = { ...ref, kind };
    return cue === "enter"
      ? { ...layer, enter: nextRef }
      : { ...layer, exit: nextRef };
  });
  return nextLayers === composition.layers ? composition : { ...composition, layers: nextLayers };
}

function updateLayerCuePreset(
  composition: MotionCompositionDef,
  layerId: string,
  cue: "enter" | "exit",
  presetId: string,
): MotionCompositionDef {
  if (!composition.cuePresets?.some((preset) => preset.id === presetId)) {
    return composition;
  }

  const nextLayers = composition.layers.map((layer) => {
    if (layer.id !== layerId) {
      return layer;
    }
    const ref = cue === "enter" ? layer.enter : layer.exit;
    if (!ref || (isCuePresetRef(ref) && ref.preset === presetId)) {
      return layer;
    }
    const nextRef = { preset: presetId } satisfies MotionCueRef;
    return cue === "enter"
      ? { ...layer, enter: nextRef }
      : { ...layer, exit: nextRef };
  });
  return nextLayers === composition.layers ? composition : { ...composition, layers: nextLayers };
}

function createDefaultTransitionParams(
  style: MotionTransitionStyle,
  current: MotionTransitionParams | undefined,
): MotionTransitionParams {
  if (style === "crossfade") {
    return {
      brightness: typeof current === "object" && current && "brightness" in current && typeof current.brightness === "number"
        ? current.brightness
        : 0.86,
    };
  }
  if (style === "flash") {
    return {
      glowColor: typeof current === "object" && current && "glowColor" in current && typeof current.glowColor === "string"
        ? current.glowColor
        : "rgba(240,143,32,0.24)",
      glowSize: typeof current === "object" && current && "glowSize" in current && typeof current.glowSize === "number"
        ? current.glowSize
        : 120,
    };
  }
  return {
    liftY: typeof current === "object" && current && "liftY" in current && typeof current.liftY === "number"
      ? current.liftY
      : 18,
  };
}

function normalizeInlineStringValue(
  value: string,
): string | null {
  const nextValue = value.trim();
  return nextValue.length > 0 ? nextValue : null;
}

export function createMotionEditorState(
  composition: MotionCompositionDef,
  overrides?: Partial<MotionParameterValues>,
): MotionEditorState<ResolvedMotionComposition>;
export function createMotionEditorState(
  composition: MotionCompositionDefV2,
  overrides?: Partial<MotionParameterValues>,
): MotionEditorState<ResolvedMotionCompositionV2>;
export function createMotionEditorState(
  composition: MotionCompositionSchema,
  overrides?: Partial<MotionParameterValues>,
): MotionEditorState<ResolvedMotionCompositionSchema>;
export function createMotionEditorState(
  composition: MotionCompositionSchema,
  overrides: Partial<MotionParameterValues> = {},
): MotionEditorState<ResolvedMotionCompositionSchema> {
  const resolved = resolveMotionCompositionSchema(composition, overrides);
  return {
    composition: resolved,
    values: resolved.values,
    selection: null,
    transport: createTransport(resolved.durationMs),
    viewport: {
      zoom: 1,
      scrollLeftMs: 0,
      visibleDurationMs: Math.min(4000, resolved.durationMs),
    },
    activeSequenceIds: [],
    activeLayerIds: [],
    activeCaptionId: null,
  };
}

export function syncMotionEditorState<TComposition extends ResolvedMotionCompositionSchema>(
  state: MotionEditorState<TComposition>,
  snapshot: MotionRuntimeSnapshot,
): MotionEditorState<TComposition> {
  return {
    ...state,
    transport: snapshot.transport,
    activeSequenceIds: snapshot.activeSequenceIds,
    activeLayerIds: snapshot.activeLayerIds,
    activeCaptionId: snapshot.activeCaptionId,
  };
}

function withResolvedComposition(
  state: MotionEditorState<ResolvedMotionComposition>,
  composition: MotionCompositionDef | ResolvedMotionComposition,
  values?: MotionParameterValues,
): MotionEditorState<ResolvedMotionComposition>;
function withResolvedComposition(
  state: MotionEditorState<ResolvedMotionCompositionV2>,
  composition: MotionCompositionDefV2 | ResolvedMotionCompositionV2,
  values?: MotionParameterValues,
): MotionEditorState<ResolvedMotionCompositionV2>;
function withResolvedComposition(
  state: MotionEditorState<ResolvedMotionCompositionSchema>,
  composition: MotionCompositionSchema | ResolvedMotionCompositionSchema,
  values?: MotionParameterValues,
): MotionEditorState<ResolvedMotionCompositionSchema>;
function withResolvedComposition(
  state: MotionEditorState<ResolvedMotionCompositionSchema>,
  composition: MotionCompositionSchema | ResolvedMotionCompositionSchema,
  values: MotionParameterValues = state.values,
): MotionEditorState<ResolvedMotionCompositionSchema> {
  const resolved = resolveMotionCompositionSchema(composition, values);
  return {
    ...state,
    composition: resolved,
    values: resolved.values,
    transport: {
      ...state.transport,
      durationMs: resolved.durationMs,
      currentTimeMs: Math.min(state.transport.currentTimeMs, resolved.durationMs),
    },
  };
}

type MotionEditorCommandWithoutSetComposition = Exclude<MotionEditorCommand, MotionSetCompositionCommand>;

export function applyMotionEditorCommand(
  state: MotionEditorState<ResolvedMotionCompositionSchema>,
  command: MotionSetCompositionCommand & { readonly composition: MotionCompositionDef },
): MotionEditorState<ResolvedMotionComposition>;
export function applyMotionEditorCommand(
  state: MotionEditorState<ResolvedMotionCompositionSchema>,
  command: MotionSetCompositionCommand & { readonly composition: MotionCompositionDefV2 },
): MotionEditorState<ResolvedMotionCompositionV2>;
export function applyMotionEditorCommand(
  state: MotionEditorState<ResolvedMotionComposition>,
  command: MotionEditorCommandWithoutSetComposition,
): MotionEditorState<ResolvedMotionComposition>;
export function applyMotionEditorCommand(
  state: MotionEditorState<ResolvedMotionCompositionV2>,
  command: MotionEditorCommandWithoutSetComposition,
): MotionEditorState<ResolvedMotionCompositionV2>;
export function applyMotionEditorCommand(
  state: MotionEditorState<ResolvedMotionCompositionSchema>,
  command: MotionEditorCommand,
): MotionEditorState<ResolvedMotionCompositionSchema>;
export function applyMotionEditorCommand(
  state: MotionEditorState<ResolvedMotionCompositionSchema>,
  command: MotionEditorCommand,
): MotionEditorState<ResolvedMotionCompositionSchema> {
  switch (command.type) {
    case "select":
      return { ...state, selection: command.selection };
    case "set-composition":
      return createMotionEditorState(command.composition, command.values ?? state.values);
    case "set-parameter": {
      const nextValues = { ...state.values, [command.parameterId]: command.value };
      return withResolvedComposition(state, state.composition, nextValues);
    }
    case "set-current-time":
      return {
        ...state,
        transport: {
          ...state.transport,
          currentTimeMs: Math.max(0, Math.min(command.timeMs, state.transport.durationMs)),
        },
      };
    case "set-loop":
      return { ...state, transport: { ...state.transport, loop: command.loop } };
    case "set-playback-rate":
      return {
        ...state,
        transport: {
          ...state.transport,
          playbackRate: normalizePlaybackRate(command.playbackRate),
        },
      };
    case "play":
      return { ...state, transport: { ...state.transport, playing: true } };
    case "pause":
      return { ...state, transport: { ...state.transport, playing: false } };
    case "restart":
      return {
        ...state,
        transport: { ...state.transport, playing: true, currentTimeMs: 0 },
      };
    case "add-scene": {
      if (!isMotionCompositionV2(state.composition) || state.composition.scenes.some((scene) => scene.id === command.id)) {
        return state;
      }
      const nextTitle = normalizeInlineStringValue(command.title);
      if (!nextTitle) {
        return state;
      }
      const v2State = state as MotionEditorState<ResolvedMotionCompositionV2>;
      return withResolvedComposition(v2State, {
        ...v2State.composition,
        scenes: [
          ...v2State.composition.scenes,
          {
            id: command.id,
            title: nextTitle,
            startMs: command.startMs,
            durationMs: command.durationMs,
            layers: command.layers ?? [],
            sequences: command.sequences ?? [],
            captions: command.captions ?? [],
          },
        ],
      });
    }
    case "remove-scene": {
      if (!isMotionCompositionV2(state.composition)) {
        return state;
      }
      const v2State = state as MotionEditorState<ResolvedMotionCompositionV2>;
      const composition = removeSceneFromComposition(v2State.composition, command.sceneId);
      if (composition === v2State.composition) {
        return state;
      }
      const next = withResolvedComposition(v2State, composition);
      const shouldClearSelection = (
        state.selection?.kind === "scene" && state.selection.id === command.sceneId
      ) || (
        state.selection?.kind === "scene-layer" && state.selection.sceneId === command.sceneId
      );
      return {
        ...next,
        selection: shouldClearSelection ? null : next.selection,
      };
    }
    case "rename-scene": {
      if (!isMotionCompositionV2(state.composition)) {
        return state;
      }
      const nextTitle = normalizeInlineStringValue(command.title);
      if (!nextTitle) {
        return state;
      }
      let changed = false;
      const v2State = state as MotionEditorState<ResolvedMotionCompositionV2>;
      const scenes = v2State.composition.scenes.map((scene) => {
        if (scene.id !== command.sceneId || scene.title === nextTitle) {
          return scene;
        }
        changed = true;
        return { ...scene, title: nextTitle };
      });
      return changed
        ? withResolvedComposition(v2State, { ...v2State.composition, scenes })
        : state;
    }
    case "update-scene-timing": {
      if (!isMotionCompositionV2(state.composition)) {
        return state;
      }
      let changed = false;
      const v2State = state as MotionEditorState<ResolvedMotionCompositionV2>;
      const scenes = v2State.composition.scenes.map((scene) => {
        if (scene.id !== command.sceneId) {
          return scene;
        }
        if (scene.startMs === command.startMs && scene.durationMs === command.durationMs) {
          return scene;
        }
        changed = true;
        return {
          ...scene,
          startMs: command.startMs,
          durationMs: command.durationMs,
        };
      });
      return changed
        ? withResolvedComposition(v2State, { ...v2State.composition, scenes })
        : state;
    }
    case "add-scene-placement": {
      if (!isMotionCompositionV2(state.composition)) {
        return state;
      }
      const v2State = state as MotionEditorState<ResolvedMotionCompositionV2>;
      const scene = findSceneById(v2State.composition, command.sceneId);
      if (
        !scene
        || scene.layers.some((placement) => placement.targetId === command.targetId)
        || !v2State.composition.targets.some((target) => target.id === command.targetId)
      ) {
        return state;
      }

      const scenes = v2State.composition.scenes.map((entry) => {
        if (entry.id !== command.sceneId) {
          return entry;
        }
        return {
          ...entry,
          layers: [
            ...entry.layers,
            {
              targetId: command.targetId,
              startMs: command.startMs ?? 0,
              durationMs: command.durationMs ?? entry.durationMs,
              enter: command.enter ?? createDefaultEnterCue(v2State.composition),
              ...(command.exit ? { exit: command.exit } : {}),
            },
          ],
        };
      });

      const next = withResolvedComposition(v2State, { ...v2State.composition, scenes });
      const shouldSelectPlacement = (
        state.selection?.kind === "target"
        && state.selection.id === command.targetId
      );
      return {
        ...next,
        selection: shouldSelectPlacement
          ? { kind: "scene-layer", sceneId: command.sceneId, targetId: command.targetId }
          : next.selection,
      };
    }
    case "remove-scene-placement": {
      if (!isMotionCompositionV2(state.composition)) {
        return state;
      }
      let changed = false;
      const v2State = state as MotionEditorState<ResolvedMotionCompositionV2>;
      const scenes = v2State.composition.scenes.map((scene) => {
        if (scene.id !== command.sceneId) {
          return scene;
        }
        const nextScene = removePlacementFromScene(scene, command.targetId);
        if (nextScene !== scene) {
          changed = true;
        }
        return nextScene;
      });
      if (!changed) {
        return state;
      }
      const next = withResolvedComposition(v2State, { ...v2State.composition, scenes });
      const shouldClearSelection = (
        state.selection?.kind === "scene-layer"
        && state.selection.sceneId === command.sceneId
        && state.selection.targetId === command.targetId
      );
      return {
        ...next,
        selection: shouldClearSelection ? null : next.selection,
      };
    }
    case "update-scene-placement-timing": {
      if (!isMotionCompositionV2(state.composition)) {
        return state;
      }
      let changed = false;
      const v2State = state as MotionEditorState<ResolvedMotionCompositionV2>;
      const scenes = v2State.composition.scenes.map((scene) => {
        if (scene.id !== command.sceneId) {
          return scene;
        }
        const layers = scene.layers.map((placement) => {
          if (placement.targetId !== command.targetId) {
            return placement;
          }
          if (
            placement.startMs === command.startMs
            && placement.durationMs === command.durationMs
          ) {
            return placement;
          }
          changed = true;
          return {
            ...placement,
            startMs: command.startMs,
            durationMs: command.durationMs,
          };
        });
        return changed ? { ...scene, layers } : scene;
      });
      return changed
        ? withResolvedComposition(v2State, { ...v2State.composition, scenes })
        : state;
    }
    case "update-scene-placement-cue": {
      if (!isMotionCompositionV2(state.composition)) {
        return state;
      }
      if (command.cue === "enter" && command.cueRef === null) {
        return state;
      }
      let changed = false;
      const v2State = state as MotionEditorState<ResolvedMotionCompositionV2>;
      const scenes = v2State.composition.scenes.map((scene) => {
        if (scene.id !== command.sceneId) {
          return scene;
        }
        const layers = scene.layers.map((placement) => {
          if (placement.targetId !== command.targetId) {
            return placement;
          }
          if (command.cue === "enter") {
            if (cueRefsEqual(placement.enter, command.cueRef ?? undefined)) {
              return placement;
            }
            changed = true;
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- cue="enter" → cueRef 존재 보장 (null은 exit 삭제 경로)
            return { ...placement, enter: command.cueRef! };
          }
          if (command.cueRef === null) {
            if (placement.exit === undefined) {
              return placement;
            }
            changed = true;
            const { exit: _exit, ...nextPlacement } = placement;
            return nextPlacement;
          }
          if (cueRefsEqual(placement.exit, command.cueRef)) {
            return placement;
          }
          changed = true;
          return { ...placement, exit: command.cueRef };
        });
        return changed ? { ...scene, layers } : scene;
      });
      return changed
        ? withResolvedComposition(v2State, { ...v2State.composition, scenes })
        : state;
    }
    case "add-layer": {
      if (isMotionCompositionV2(state.composition)) {
        return state;
      }
      const v1State = state as MotionEditorState<ResolvedMotionComposition>;
      if (v1State.composition.layers.some((layer) => layer.id === command.id)) {
        return state;
      }
      return withResolvedComposition(v1State, {
        ...v1State.composition,
        layers: [
          ...v1State.composition.layers,
          {
            id: command.id,
            label: command.label,
            target: command.target,
            content: command.content,
            startMs: 0,
            durationMs: command.durationMs,
            enter: command.enter ?? createDefaultEnterCue(v1State.composition),
          },
        ],
      });
    }
    case "remove-layer": {
      if (isMotionCompositionV2(state.composition)) {
        return state;
      }
      const v1State = state as MotionEditorState<ResolvedMotionComposition>;
      const composition = removeLayerFromComposition(v1State.composition, command.layerId);
      if (composition === v1State.composition) {
        return state;
      }
      const next = withResolvedComposition(v1State, composition);
      return {
        ...next,
        selection: state.selection?.kind === "layer" && state.selection.id === command.layerId
          ? null
          : next.selection,
        activeLayerIds: next.activeLayerIds.filter((layerId) => layerId !== command.layerId),
      };
    }
    case "add-sequence": {
      if (isMotionCompositionV2(state.composition)) {
        return state;
      }
      const v1State = state as MotionEditorState<ResolvedMotionComposition>;
      if (v1State.composition.sequences.some((sequence) => sequence.id === command.id)) {
        return state;
      }
      return withResolvedComposition(v1State, {
        ...v1State.composition,
        sequences: [
          ...v1State.composition.sequences,
          {
            id: command.id,
            title: command.title,
            startMs: command.startMs,
            durationMs: command.durationMs,
            layerIds: command.layerIds,
            layers: command.layers,
            stagger: command.stagger,
            captionIds: command.captionIds,
          },
        ],
      });
    }
    case "remove-sequence": {
      if (isMotionCompositionV2(state.composition)) {
        return state;
      }
      const v1State = state as MotionEditorState<ResolvedMotionComposition>;
      const removedTransitionIds = new Set(
        v1State.composition.transitions
          .filter((transition) =>
            transition.fromSequenceId === command.sequenceId
            || transition.toSequenceId === command.sequenceId
          )
          .map((transition) => transition.id),
      );
      const composition = removeSequenceFromComposition(v1State.composition, command.sequenceId);
      if (composition === v1State.composition) {
        return state;
      }
      const next = withResolvedComposition(v1State, composition);
      const shouldClearSelection = (
        state.selection?.kind === "sequence" && state.selection.id === command.sequenceId
      ) || (
        state.selection?.kind === "transition" && removedTransitionIds.has(state.selection.id)
      );
      return {
        ...next,
        selection: shouldClearSelection ? null : next.selection,
        activeSequenceIds: next.activeSequenceIds.filter((sequenceId) => sequenceId !== command.sequenceId),
      };
    }
    case "add-caption": {
      if (isMotionCompositionV2(state.composition)) {
        return state;
      }
      const v1State = state as MotionEditorState<ResolvedMotionComposition>;
      if (v1State.composition.captions.some((caption) => caption.id === command.id)) {
        return state;
      }
      return withResolvedComposition(v1State, {
        ...v1State.composition,
        captions: [
          ...v1State.composition.captions,
          {
            id: command.id,
            text: command.text,
            startMs: command.startMs,
            durationMs: command.durationMs,
            tone: command.tone,
          },
        ],
      });
    }
    case "remove-caption": {
      if (isMotionCompositionV2(state.composition)) {
        return state;
      }
      const v1State = state as MotionEditorState<ResolvedMotionComposition>;
      const composition = removeCaptionFromComposition(v1State.composition, command.captionId);
      if (composition === v1State.composition) {
        return state;
      }
      const next = withResolvedComposition(v1State, composition);
      return {
        ...next,
        selection: state.selection?.kind === "caption" && state.selection.id === command.captionId
          ? null
          : next.selection,
        activeCaptionId: next.activeCaptionId === command.captionId ? null : next.activeCaptionId,
      };
    }
    case "add-transition": {
      if (isMotionCompositionV2(state.composition)) {
        return state;
      }
      const v1State = state as MotionEditorState<ResolvedMotionComposition>;
      if (v1State.composition.transitions.some((transition) => transition.id === command.id)) {
        return state;
      }
      return withResolvedComposition(v1State, {
        ...v1State.composition,
        transitions: [
          ...v1State.composition.transitions,
          {
            id: command.id,
            fromSequenceId: command.fromSequenceId,
            toSequenceId: command.toSequenceId,
            style: command.style,
            durationMs: command.durationMs,
            params: command.params,
          },
        ],
      });
    }
    case "remove-transition": {
      if (isMotionCompositionV2(state.composition)) {
        return state;
      }
      const v1State = state as MotionEditorState<ResolvedMotionComposition>;
      const composition = removeTransitionFromComposition(v1State.composition, command.transitionId);
      if (composition === v1State.composition) {
        return state;
      }
      const next = withResolvedComposition(v1State, composition);
      return {
        ...next,
        selection: state.selection?.kind === "transition" && state.selection.id === command.transitionId
          ? null
          : next.selection,
      };
    }
    case "update-item-string": {
      if (isMotionCompositionV2(state.composition)) {
        return state;
      }
      const nextValue = normalizeInlineStringValue(command.value);
      if (!nextValue) {
        return state;
      }
      const v1State = state as MotionEditorState<ResolvedMotionComposition>;

      if (command.itemKind === "layer") {
        let changed = false;
        const layers = v1State.composition.layers.map((layer) => {
          if (layer.id !== command.itemId || layer.label === nextValue) {
            return layer;
          }
          changed = true;
          return { ...layer, label: nextValue };
        });
        return changed
          ? withResolvedComposition(v1State, { ...v1State.composition, layers })
          : state;
      }

      if (command.itemKind === "sequence") {
        let changed = false;
        const sequences = v1State.composition.sequences.map((sequence) => {
          if (sequence.id !== command.itemId || sequence.title === nextValue) {
            return sequence;
          }
          changed = true;
          return { ...sequence, title: nextValue };
        });
        return changed
          ? withResolvedComposition(v1State, { ...v1State.composition, sequences })
          : state;
      }

      let changed = false;
      const captions = v1State.composition.captions.map((caption) => {
        if (caption.id !== command.itemId || caption.text === nextValue) {
          return caption;
        }
        changed = true;
        return { ...caption, text: nextValue };
      });
      return changed
        ? withResolvedComposition(v1State, { ...v1State.composition, captions })
        : state;
    }
    case "update-item-timing": {
      if (isMotionCompositionV2(state.composition)) {
        return state;
      }
      const { itemKind, itemId, startMs, durationMs } = command;
      const v1State = state as MotionEditorState<ResolvedMotionComposition>;
      const update = <T extends { readonly id: string }>(items: readonly T[]) =>
        items.map((item) =>
          item.id === itemId ? { ...item, startMs, durationMs } : item,
        );
      switch (itemKind) {
        case "layer":
          return withResolvedComposition(v1State, { ...v1State.composition, layers: update(v1State.composition.layers) });
        case "sequence":
          return withResolvedComposition(v1State, { ...v1State.composition, sequences: update(v1State.composition.sequences) });
        case "caption":
          return withResolvedComposition(v1State, { ...v1State.composition, captions: update(v1State.composition.captions) });
      }
      break;
    }
    case "update-sequence-stagger": {
      if (isMotionCompositionV2(state.composition)) {
        return state;
      }
      const v1State = state as MotionEditorState<ResolvedMotionComposition>;
      const sequences = v1State.composition.sequences.map((sequence) => {
        if (sequence.id !== command.sequenceId || !sequence.stagger) {
          return sequence;
        }
        const nextValue = Math.max(0, Math.round(command.value));
        if (sequence.stagger[command.field] === nextValue) {
          return sequence;
        }
        return {
          ...sequence,
          stagger: {
            ...sequence.stagger,
            [command.field]: nextValue,
          },
        };
      });
      return withResolvedComposition(v1State, { ...v1State.composition, sequences });
    }
    case "update-sequence-layer-slot": {
      if (isMotionCompositionV2(state.composition)) {
        return state;
      }
      const v1State = state as MotionEditorState<ResolvedMotionComposition>;
      const sequences = v1State.composition.sequences.map((sequence) =>
        sequence.id === command.sequenceId
          ? updateSequenceSlot(sequence, command.layerId, command.field, command.value)
          : sequence,
      );
      return withResolvedComposition(v1State, { ...v1State.composition, sequences });
    }
    case "update-sequence-layer-role": {
      if (isMotionCompositionV2(state.composition)) {
        return state;
      }
      const v1State = state as MotionEditorState<ResolvedMotionComposition>;
      const sequences = v1State.composition.sequences.map((sequence) =>
        sequence.id === command.sequenceId
          ? updateSequenceSlotRole(sequence, command.layerId, command.role)
          : sequence,
      );
      return withResolvedComposition(v1State, { ...v1State.composition, sequences });
    }
    case "update-layer-cue-kind":
      if (isMotionCompositionV2(state.composition)) {
        return state;
      }
      return withResolvedComposition(
        state as MotionEditorState<ResolvedMotionComposition>,
        updateLayerCueKind(
          (state as MotionEditorState<ResolvedMotionComposition>).composition,
          command.layerId,
          command.cue,
          command.kind,
        ),
      );
    case "update-layer-cue-preset":
      if (isMotionCompositionV2(state.composition)) {
        return state;
      }
      return withResolvedComposition(
        state as MotionEditorState<ResolvedMotionComposition>,
        updateLayerCuePreset(
          (state as MotionEditorState<ResolvedMotionComposition>).composition,
          command.layerId,
          command.cue,
          command.presetId,
        ),
      );
    case "update-layer-content-type": {
      if (isMotionCompositionV2(state.composition)) {
        return state;
      }
      const v1State = state as MotionEditorState<ResolvedMotionComposition>;
      const layers = v1State.composition.layers.map((layer) =>
        layer.id === command.layerId
          ? { ...layer, content: createLayerContentForType(command.contentType, layer.content) }
          : layer,
      );
      return withResolvedComposition(v1State, { ...v1State.composition, layers });
    }
    case "update-transition-style": {
      if (isMotionCompositionV2(state.composition)) {
        return state;
      }
      const v1State = state as MotionEditorState<ResolvedMotionComposition>;
      const transitions = v1State.composition.transitions.map((transition) =>
        transition.id === command.transitionId
          ? {
            ...transition,
            style: command.style,
            params: createDefaultTransitionParams(command.style, transition.params),
          }
          : transition,
      );
      return withResolvedComposition(v1State, { ...v1State.composition, transitions });
    }
    case "update-transition-duration": {
      if (isMotionCompositionV2(state.composition)) {
        return state;
      }
      const v1State = state as MotionEditorState<ResolvedMotionComposition>;
      const transitions = v1State.composition.transitions.map((transition) =>
        transition.id === command.transitionId
          ? { ...transition, durationMs: command.durationMs }
          : transition,
      );
      return withResolvedComposition(v1State, { ...v1State.composition, transitions });
    }
    case "update-transition-param": {
      if (isMotionCompositionV2(state.composition)) {
        return state;
      }
      const v1State = state as MotionEditorState<ResolvedMotionComposition>;
      const transitions = v1State.composition.transitions.map((transition) =>
        transition.id === command.transitionId
          ? {
            ...transition,
            params: {
              ...transition.params,
              [command.param]: command.value,
            },
          }
          : transition,
      );
      return withResolvedComposition(v1State, { ...v1State.composition, transitions });
    }
  }
}

export function describeMotionSelection(
  state: MotionEditorState<ResolvedMotionCompositionSchema>,
): string {
  const selection = state.selection;
  if (!selection) return "Nothing selected";
  if (selection.kind === "composition") return `${state.composition.title}`;
  if (selection.kind === "cue-preset") {
    return state.composition.cuePresets?.find((preset) => preset.id === selection.id)?.label ?? selection.id;
  }
  if (selection.kind === "scene" && isMotionCompositionV2(state.composition)) {
    return findSceneById(state.composition, selection.id)?.title ?? selection.id;
  }
  if (selection.kind === "scene-layer" && isMotionCompositionV2(state.composition)) {
    const scene = findSceneById(state.composition, selection.sceneId);
    return scene?.layers.find((layer) => layer.targetId === selection.targetId)?.targetId ?? selection.targetId;
  }
  if (selection.kind === "target" && isMotionCompositionV2(state.composition)) {
    return state.composition.targets.find((target) => target.id === selection.id)?.id ?? selection.id;
  }
  if (!isMotionCompositionV2(state.composition)) {
    if (selection.kind === "layer") return findLayerById(state.composition, selection.id)?.label ?? selection.id;
    if (selection.kind === "sequence") return findSequenceById(state.composition, selection.id)?.title ?? selection.id;
    if (selection.kind === "caption") return findCaptionById(state.composition, selection.id)?.text ?? selection.id;
    if (selection.kind === "transition") return findTransitionById(state.composition, selection.id)?.id ?? selection.id;
  }
  return "id" in selection ? selection.id : selection.targetId;
}
