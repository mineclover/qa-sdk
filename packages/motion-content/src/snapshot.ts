// @def.boundary motion-content-system
import type {
  MotionAssetDef,
  MotionCompositionDef,
  MotionCuePreset,
  MotionLayerDef,
  MotionParameterValues,
  ResolvedMotionComposition,
} from './model.js';
import { applyMotionTemplate, resolveCue } from './model.js';
import type {
  MotionActiveLayerPhase,
  MotionDebugSnapshot,
  MotionResolvedAssetSnapshot,
} from './types.js';
import { buildResolvedLayerStartMap, resolveMotionTransitionWindow } from './query.js';
import { endMs } from './utils.js';

function buildDefaultParameterValues(composition: MotionCompositionDef): MotionParameterValues {
  const values: MotionParameterValues = {};
  for (const parameter of composition.parameters) {
    values[parameter.id] = parameter.defaultValue;
  }
  return values;
}

export function resolveMotionAssetSnapshots(
  composition: ResolvedMotionComposition,
  targetPresence: Partial<Record<string, boolean>> = {},
): MotionResolvedAssetSnapshot[] {
  const defaultValues = buildDefaultParameterValues(composition);
  return composition.assets.map((asset: MotionAssetDef) => {
    const value = applyMotionTemplate(asset.template, composition.values);
    const defaultValue = applyMotionTemplate(asset.template, defaultValues);
    return {
      id: asset.id,
      type: asset.type,
      target: asset.target,
      property: asset.type === 'style' ? asset.property : undefined,
      template: asset.template,
      value,
      defaultValue,
      changed: value !== defaultValue,
      targetFound: targetPresence[asset.id] ?? true,
    };
  });
}

function isWithinWindow(timeMs: number, startMs: number, windowEndMs: number): boolean {
  return timeMs >= startMs && timeMs <= windowEndMs;
}

function remainingMs(timeMs: number, windowEndMs: number): number {
  return Math.max(0, windowEndMs - timeMs);
}

function resolveMotionLayerPhase(
  layer: MotionLayerDef,
  timeMs: number,
  presets: readonly MotionCuePreset[],
): MotionActiveLayerPhase {
  const enterCue = resolveCue(layer.enter, presets);
  if (!enterCue) return 'hold';
  const enterEndMs = layer.startMs + enterCue.durationMs;
  if (timeMs <= enterEndMs) return 'enter';
  if (!layer.exit) return 'hold';
  const exitCue = resolveCue(layer.exit, presets);
  if (!exitCue) return 'hold';
  const exitStartMs = Math.max(
    layer.startMs,
    endMs(layer) - exitCue.durationMs - (exitCue.overlapMs ?? 0),
  );
  if (timeMs >= exitStartMs) return 'exit';
  return 'hold';
}

interface MotionCueBoundary {
  readonly atMs: number;
  readonly label: string;
}

function nextCueBoundary(
  boundaries: readonly MotionCueBoundary[],
  timeMs: number,
): MotionCueBoundary | null {
  let next: MotionCueBoundary | null = null;
  for (const boundary of boundaries) {
    if (boundary.atMs <= timeMs) continue;
    if (!next || boundary.atMs < next.atMs) {
      next = boundary;
    }
  }
  return next;
}

export function createMotionDebugSnapshot(
  composition: ResolvedMotionComposition,
  timeMs: number,
  resolvedAssets: readonly MotionResolvedAssetSnapshot[],
): MotionDebugSnapshot {
  const layerStartMap = buildResolvedLayerStartMap(composition);
  const presets = composition.cuePresets ?? [];

  const activeSequences = composition.sequences
    .filter((sequence) => isWithinWindow(timeMs, sequence.startMs, endMs(sequence)))
    .map((sequence) => ({
      id: sequence.id,
      title: sequence.title,
      startMs: sequence.startMs,
      endMs: endMs(sequence),
      remainingMs: remainingMs(timeMs, endMs(sequence)),
      layerIds: sequence.layerIds,
      captionIds: sequence.captionIds ?? [],
    }));
  const activeLayers = composition.layers
    .filter((layer) => {
      const start = layerStartMap.get(layer.id) ?? layer.startMs;
      return isWithinWindow(timeMs, start, start + layer.durationMs);
    })
    .map((layer) => {
      const start = layerStartMap.get(layer.id) ?? layer.startMs;
      const resolvedLayer = { ...layer, startMs: start };
      return {
        id: layer.id,
        label: layer.label,
        contentType: layer.content?.type ?? 'dom',
        target: layer.target,
        startMs: start,
        endMs: start + layer.durationMs,
        remainingMs: remainingMs(timeMs, start + layer.durationMs),
        phase: resolveMotionLayerPhase(resolvedLayer, timeMs, presets),
        enterKind: resolveCue(layer.enter, presets)?.kind ?? 'fade',
        exitKind: layer.exit ? (resolveCue(layer.exit, presets)?.kind ?? null) : null,
      };
    });
  const activeCaption = composition.captions.find((caption) =>
    isWithinWindow(timeMs, caption.startMs, endMs(caption)),
  );
  const activeTransitionIds = composition.transitions
    .filter((transition) => {
      const window = resolveMotionTransitionWindow(composition, transition);
      return isWithinWindow(timeMs, window.startMs, window.boundaryMs);
    })
    .map((transition) => transition.id);

  const boundaries: MotionCueBoundary[] = [
    ...composition.sequences.flatMap((sequence) => [
      { atMs: sequence.startMs, label: `sequence:${sequence.id}:start` },
      { atMs: endMs(sequence), label: `sequence:${sequence.id}:end` },
    ]),
    ...composition.layers.flatMap((layer) => {
      const start = layerStartMap.get(layer.id) ?? layer.startMs;
      return [
        { atMs: start, label: `layer:${layer.id}:start` },
        { atMs: start + layer.durationMs, label: `layer:${layer.id}:end` },
      ];
    }),
    ...composition.captions.flatMap((caption) => [
      { atMs: caption.startMs, label: `caption:${caption.id}:start` },
      { atMs: endMs(caption), label: `caption:${caption.id}:end` },
    ]),
    ...composition.transitions.flatMap((transition) => {
      const window = resolveMotionTransitionWindow(composition, transition);
      return [
        { atMs: window.startMs, label: `transition:${transition.id}:start` },
        { atMs: window.boundaryMs, label: `transition:${transition.id}:end` },
      ];
    }),
  ];
  const nextBoundary = nextCueBoundary(boundaries, timeMs);

  return {
    timeMs,
    activeSequenceIds: activeSequences.map((sequence) => sequence.id),
    activeLayerIds: activeLayers.map((layer) => layer.id),
    activeCaptionId: activeCaption?.id ?? null,
    captionText: activeCaption?.text ?? '',
    active: {
      sequences: activeSequences,
      layers: activeLayers,
      caption: activeCaption
        ? {
            id: activeCaption.id,
            text: activeCaption.text,
            tone: activeCaption.tone,
            startMs: activeCaption.startMs,
            endMs: endMs(activeCaption),
            remainingMs: remainingMs(timeMs, endMs(activeCaption)),
          }
        : null,
    },
    timing: {
      activeTransitionIds,
      nextCueChangeMs: nextBoundary?.atMs ?? null,
      nextCueLabel: nextBoundary?.label ?? null,
      timeToNextCueMs: nextBoundary ? nextBoundary.atMs - timeMs : null,
    },
    resolvedAssets,
  };
}
