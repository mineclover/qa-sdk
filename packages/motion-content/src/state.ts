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
  type MotionCompositionDef,
  type MotionParameterValues,
} from "./model.js";
import { clamp, normalizePlaybackRate, MIN_TIMELINE_WINDOW_MS } from "./utils.js";

function createTransport(durationMs: number): MotionTransportState {
  return {
    playing: false,
    currentTimeMs: 0,
    durationMs,
    loop: false,
    playbackRate: 1,
  };
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
    case "update-transition-duration": {
      const transitions = state.composition.transitions.map((transition) =>
        transition.id === command.transitionId
          ? { ...transition, durationMs: command.durationMs }
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
  return findTransitionById(state.composition, selection.id)?.id ?? selection.id;
}
