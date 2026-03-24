import type {
  MotionCaptionCue,
  MotionCompositionDef,
  MotionLayerDef,
  MotionParameterValues,
  MotionSequenceDef,
  MotionTransitionDef,
} from "./model.js";

export type MotionEditorSelection =
  | { readonly kind: "composition"; readonly id: string }
  | { readonly kind: "layer"; readonly id: string }
  | { readonly kind: "sequence"; readonly id: string }
  | { readonly kind: "caption"; readonly id: string }
  | { readonly kind: "transition"; readonly id: string };

export interface MotionTransportState {
  readonly playing: boolean;
  readonly currentTimeMs: number;
  readonly durationMs: number;
  readonly loop: boolean;
  readonly playbackRate: number;
}

export interface MotionEditorViewport {
  readonly zoom: number;
  readonly scrollLeftMs: number;
  readonly visibleDurationMs: number;
}

export interface MotionEditorState {
  readonly composition: MotionCompositionDef;
  readonly values: MotionParameterValues;
  readonly selection: MotionEditorSelection | null;
  readonly transport: MotionTransportState;
  readonly viewport: MotionEditorViewport;
  readonly activeSequenceIds: readonly string[];
  readonly activeLayerIds: readonly string[];
  readonly activeCaptionId: string | null;
}

export type MotionEditorCommand =
  | { readonly type: "select"; readonly selection: MotionEditorSelection | null }
  | { readonly type: "set-parameter"; readonly parameterId: string; readonly value: string | number }
  | { readonly type: "set-current-time"; readonly timeMs: number }
  | { readonly type: "set-loop"; readonly loop: boolean }
  | { readonly type: "set-playback-rate"; readonly playbackRate: number }
  | { readonly type: "play" }
  | { readonly type: "pause" }
  | { readonly type: "restart" }
  | { readonly type: "update-layer-timing"; readonly layerId: string; readonly startMs: number; readonly durationMs: number }
  | { readonly type: "update-sequence-window"; readonly sequenceId: string; readonly startMs: number; readonly durationMs: number }
  | { readonly type: "update-caption-window"; readonly captionId: string; readonly startMs: number; readonly endMs: number }
  | { readonly type: "update-transition-duration"; readonly transitionId: string; readonly durationMs: number };

export interface MotionResolvedAssetSnapshot {
  readonly id: string;
  readonly type: "text" | "style";
  readonly target: string;
  readonly value: string;
}

export interface MotionDebugSnapshot {
  readonly timeMs: number;
  readonly activeSequenceIds: readonly string[];
  readonly activeLayerIds: readonly string[];
  readonly activeCaptionId: string | null;
  readonly captionText: string;
  readonly resolvedAssets: readonly MotionResolvedAssetSnapshot[];
}

export function findSequenceById(
  composition: MotionCompositionDef,
  sequenceId: string,
): MotionSequenceDef | undefined {
  return composition.sequences.find((sequence) => sequence.id === sequenceId);
}

export function findLayerById(
  composition: MotionCompositionDef,
  layerId: string,
): MotionLayerDef | undefined {
  return composition.layers.find((layer) => layer.id === layerId);
}

export function findCaptionById(
  composition: MotionCompositionDef,
  captionId: string,
): MotionCaptionCue | undefined {
  return composition.captions.find((caption) => caption.id === captionId);
}

export function findTransitionById(
  composition: MotionCompositionDef,
  transitionId: string,
): MotionTransitionDef | undefined {
  return composition.transitions.find((transition) => transition.id === transitionId);
}

