import {
  findCaptionById,
  findLayerById,
  findSequenceById,
  findTransitionById,
  getSequenceLayerSlots,
  resolveMotionTransitionWindow,
  type MotionEditorCommand,
  type MotionEditorState,
  type MotionRuntimeSnapshot,
  type MotionTransportState,
} from "./editor.js";
import {
  resolveMotionComposition,
  isCuePresetRef,
  type MotionCompositionDef,
  type MotionCueKind,
  type MotionCueRef,
  type MotionLayerContent,
  type MotionLayerContentType,
  type MotionParameterValues,
  type MotionSequenceDef,
  type MotionTransitionParams,
  type MotionTransitionStyle,
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

function createDefaultLayerEnterCue(
  composition: MotionCompositionDef,
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

function removeLayerReferencesFromSequence(
  sequence: MotionSequenceDef,
  layerId: string,
): MotionSequenceDef {
  const nextLayerIds = sequence.layerIds.filter((entry) => entry !== layerId);
  const nextLayers = sequence.layers?.filter((slot) => slot.layerId !== layerId);
  const changed = nextLayerIds.length !== sequence.layerIds.length
    || (sequence.layers ? nextLayers!.length !== sequence.layers.length : false);
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
    return { ...slot, [field]: nextValue };
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
      : { ...slot, role: nextRole };
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
  overrides: Partial<MotionParameterValues> = {},
): MotionEditorState {
  const resolved = resolveMotionComposition(
    normalizeMotionCompositionTimeline(composition),
    overrides,
  );
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

export function syncMotionEditorState(
  state: MotionEditorState,
  snapshot: MotionRuntimeSnapshot,
): MotionEditorState {
  return {
    ...state,
    transport: snapshot.transport,
    activeSequenceIds: snapshot.activeSequenceIds,
    activeLayerIds: snapshot.activeLayerIds,
    activeCaptionId: snapshot.activeCaptionId,
  };
}

function withResolvedComposition(
  state: MotionEditorState,
  composition: MotionCompositionDef,
  values: MotionParameterValues = state.values,
): MotionEditorState {
  const resolved = resolveMotionComposition(
    normalizeMotionCompositionTimeline(composition),
    values,
  );
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

export function applyMotionEditorCommand(
  state: MotionEditorState,
  command: MotionEditorCommand,
): MotionEditorState {
  switch (command.type) {
    case "select":
      return { ...state, selection: command.selection };
    case "set-composition":
      return createMotionEditorState(command.composition, command.values ?? state.values);
    case "set-parameter": {
      const nextValues = { ...state.values, [command.parameterId]: command.value };
      const composition = resolveMotionComposition(state.composition, nextValues);
      return withResolvedComposition(state, composition, nextValues);
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
    case "add-layer": {
      if (state.composition.layers.some((layer) => layer.id === command.id)) {
        return state;
      }
      return withResolvedComposition(state, {
        ...state.composition,
        layers: [
          ...state.composition.layers,
          {
            id: command.id,
            label: command.label,
            target: command.target,
            content: command.content,
            startMs: 0,
            durationMs: command.durationMs,
            enter: command.enter ?? createDefaultLayerEnterCue(state.composition),
          },
        ],
      });
    }
    case "remove-layer": {
      const composition = removeLayerFromComposition(state.composition, command.layerId);
      if (composition === state.composition) {
        return state;
      }
      const next = withResolvedComposition(state, composition);
      return {
        ...next,
        selection: state.selection?.kind === "layer" && state.selection.id === command.layerId
          ? null
          : next.selection,
        activeLayerIds: next.activeLayerIds.filter((layerId) => layerId !== command.layerId),
      };
    }
    case "add-sequence": {
      if (state.composition.sequences.some((sequence) => sequence.id === command.id)) {
        return state;
      }
      return withResolvedComposition(state, {
        ...state.composition,
        sequences: [
          ...state.composition.sequences,
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
      const removedTransitionIds = new Set(
        state.composition.transitions
          .filter((transition) =>
            transition.fromSequenceId === command.sequenceId
            || transition.toSequenceId === command.sequenceId
          )
          .map((transition) => transition.id),
      );
      const composition = removeSequenceFromComposition(state.composition, command.sequenceId);
      if (composition === state.composition) {
        return state;
      }
      const next = withResolvedComposition(state, composition);
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
      if (state.composition.captions.some((caption) => caption.id === command.id)) {
        return state;
      }
      return withResolvedComposition(state, {
        ...state.composition,
        captions: [
          ...state.composition.captions,
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
      const composition = removeCaptionFromComposition(state.composition, command.captionId);
      if (composition === state.composition) {
        return state;
      }
      const next = withResolvedComposition(state, composition);
      return {
        ...next,
        selection: state.selection?.kind === "caption" && state.selection.id === command.captionId
          ? null
          : next.selection,
        activeCaptionId: next.activeCaptionId === command.captionId ? null : next.activeCaptionId,
      };
    }
    case "add-transition": {
      if (state.composition.transitions.some((transition) => transition.id === command.id)) {
        return state;
      }
      return withResolvedComposition(state, {
        ...state.composition,
        transitions: [
          ...state.composition.transitions,
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
      const composition = removeTransitionFromComposition(state.composition, command.transitionId);
      if (composition === state.composition) {
        return state;
      }
      const next = withResolvedComposition(state, composition);
      return {
        ...next,
        selection: state.selection?.kind === "transition" && state.selection.id === command.transitionId
          ? null
          : next.selection,
      };
    }
    case "update-item-string": {
      const nextValue = normalizeInlineStringValue(command.value);
      if (!nextValue) {
        return state;
      }

      if (command.itemKind === "layer") {
        let changed = false;
        const layers = state.composition.layers.map((layer) => {
          if (layer.id !== command.itemId || layer.label === nextValue) {
            return layer;
          }
          changed = true;
          return { ...layer, label: nextValue };
        });
        return changed
          ? withResolvedComposition(state, { ...state.composition, layers })
          : state;
      }

      if (command.itemKind === "sequence") {
        let changed = false;
        const sequences = state.composition.sequences.map((sequence) => {
          if (sequence.id !== command.itemId || sequence.title === nextValue) {
            return sequence;
          }
          changed = true;
          return { ...sequence, title: nextValue };
        });
        return changed
          ? withResolvedComposition(state, { ...state.composition, sequences })
          : state;
      }

      let changed = false;
      const captions = state.composition.captions.map((caption) => {
        if (caption.id !== command.itemId || caption.text === nextValue) {
          return caption;
        }
        changed = true;
        return { ...caption, text: nextValue };
      });
      return changed
        ? withResolvedComposition(state, { ...state.composition, captions })
        : state;
    }
    case "update-item-timing": {
      const { itemKind, itemId, startMs, durationMs } = command;
      const update = <T extends { readonly id: string }>(items: readonly T[]) =>
        items.map((item) =>
          item.id === itemId ? { ...item, startMs, durationMs } : item,
        );
      switch (itemKind) {
        case "layer":
          return withResolvedComposition(state, { ...state.composition, layers: update(state.composition.layers) });
        case "sequence":
          return withResolvedComposition(state, { ...state.composition, sequences: update(state.composition.sequences) });
        case "caption":
          return withResolvedComposition(state, { ...state.composition, captions: update(state.composition.captions) });
      }
      break;
    }
    case "update-sequence-stagger": {
      const sequences = state.composition.sequences.map((sequence) => {
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
      return withResolvedComposition(state, { ...state.composition, sequences });
    }
    case "update-sequence-layer-slot": {
      const sequences = state.composition.sequences.map((sequence) =>
        sequence.id === command.sequenceId
          ? updateSequenceSlot(sequence, command.layerId, command.field, command.value)
          : sequence,
      );
      return withResolvedComposition(state, { ...state.composition, sequences });
    }
    case "update-sequence-layer-role": {
      const sequences = state.composition.sequences.map((sequence) =>
        sequence.id === command.sequenceId
          ? updateSequenceSlotRole(sequence, command.layerId, command.role)
          : sequence,
      );
      return withResolvedComposition(state, { ...state.composition, sequences });
    }
    case "update-layer-cue-kind":
      return withResolvedComposition(
        state,
        updateLayerCueKind(state.composition, command.layerId, command.cue, command.kind),
      );
    case "update-layer-cue-preset":
      return withResolvedComposition(
        state,
        updateLayerCuePreset(state.composition, command.layerId, command.cue, command.presetId),
      );
    case "update-layer-content-type": {
      const layers = state.composition.layers.map((layer) =>
        layer.id === command.layerId
          ? { ...layer, content: createLayerContentForType(command.contentType, layer.content) }
          : layer,
      );
      return withResolvedComposition(state, { ...state.composition, layers });
    }
    case "update-transition-style": {
      const transitions = state.composition.transitions.map((transition) =>
        transition.id === command.transitionId
          ? {
            ...transition,
            style: command.style,
            params: createDefaultTransitionParams(command.style, transition.params),
          }
          : transition,
      );
      return withResolvedComposition(state, { ...state.composition, transitions });
    }
    case "update-transition-duration": {
      const transitions = state.composition.transitions.map((transition) =>
        transition.id === command.transitionId
          ? { ...transition, durationMs: command.durationMs }
          : transition,
      );
      return withResolvedComposition(state, { ...state.composition, transitions });
    }
    case "update-transition-param": {
      const transitions = state.composition.transitions.map((transition) =>
        transition.id === command.transitionId
          ? {
            ...transition,
            params: {
              ...(transition.params ?? {}),
              [command.param]: command.value,
            },
          }
          : transition,
      );
      return withResolvedComposition(state, { ...state.composition, transitions });
    }
  }
}

export function describeMotionSelection(state: MotionEditorState): string {
  const selection = state.selection;
  if (!selection) return "Nothing selected";
  if (selection.kind === "composition") return `${state.composition.title}`;
  if (selection.kind === "layer") return findLayerById(state.composition, selection.id)?.label ?? selection.id;
  if (selection.kind === "sequence") return findSequenceById(state.composition, selection.id)?.title ?? selection.id;
  if (selection.kind === "caption") return findCaptionById(state.composition, selection.id)?.text ?? selection.id;
  if (selection.kind === "cue-preset") {
    return state.composition.cuePresets?.find((preset) => preset.id === selection.id)?.label ?? selection.id;
  }
  return findTransitionById(state.composition, selection.id)?.id ?? selection.id;
}
