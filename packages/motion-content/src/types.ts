import type {
  MotionCaptionCue,
  MotionCompositionDef,
  MotionCueKind,
  MotionItemKind,
  MotionLayerContentType,
  MotionParameterValues,
  MotionStageTargetV1,
  ResolvedMotionComposition,
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
  readonly composition: ResolvedMotionComposition;
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
  | { readonly type: "set-composition"; readonly composition: MotionCompositionDef; readonly values?: Partial<MotionParameterValues> }
  | { readonly type: "set-parameter"; readonly parameterId: string; readonly value: string | number }
  | { readonly type: "set-current-time"; readonly timeMs: number }
  | { readonly type: "set-loop"; readonly loop: boolean }
  | { readonly type: "set-playback-rate"; readonly playbackRate: number }
  | { readonly type: "play" }
  | { readonly type: "pause" }
  | { readonly type: "restart" }
  | { readonly type: "update-item-timing"; readonly itemKind: MotionItemKind; readonly itemId: string; readonly startMs: number; readonly durationMs: number }
  | { readonly type: "update-transition-duration"; readonly transitionId: string; readonly durationMs: number };

export interface MotionResolvedAssetSnapshot {
  readonly id: string;
  readonly type: "text" | "style";
  readonly target: MotionStageTargetV1;
  readonly property?: "background" | "color" | "borderColor";
  readonly template: string;
  readonly value: string;
  readonly defaultValue: string;
  readonly changed: boolean;
  readonly targetFound: boolean;
}

export interface MotionActiveSequenceSnapshot {
  readonly id: string;
  readonly title: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly remainingMs: number;
  readonly layerIds: readonly string[];
  readonly captionIds: readonly string[];
}

export type MotionActiveLayerPhase = "enter" | "hold" | "exit";

export interface MotionActiveLayerSnapshot {
  readonly id: string;
  readonly label: string;
  readonly contentType: MotionLayerContentType;
  readonly target: MotionStageTargetV1;
  readonly startMs: number;
  readonly endMs: number;
  readonly remainingMs: number;
  readonly phase: MotionActiveLayerPhase;
  readonly enterKind: MotionCueKind;
  readonly exitKind: MotionCueKind | null;
}

export interface MotionActiveCaptionSnapshot {
  readonly id: string;
  readonly text: string;
  readonly tone: MotionCaptionCue["tone"];
  readonly startMs: number;
  readonly endMs: number;
  readonly remainingMs: number;
}

export interface MotionTimingDiagnosticsSnapshot {
  readonly activeTransitionIds: readonly string[];
  readonly nextCueChangeMs: number | null;
  readonly nextCueLabel: string | null;
  readonly timeToNextCueMs: number | null;
}

export interface MotionActiveCueSnapshot {
  readonly sequences: readonly MotionActiveSequenceSnapshot[];
  readonly layers: readonly MotionActiveLayerSnapshot[];
  readonly caption: MotionActiveCaptionSnapshot | null;
}

export interface MotionDebugSnapshot {
  readonly timeMs: number;
  readonly activeSequenceIds: readonly string[];
  readonly activeLayerIds: readonly string[];
  readonly activeCaptionId: string | null;
  readonly captionText: string;
  readonly active: MotionActiveCueSnapshot;
  readonly timing: MotionTimingDiagnosticsSnapshot;
  readonly resolvedAssets: readonly MotionResolvedAssetSnapshot[];
}

export interface MotionRuntimeSnapshot extends MotionDebugSnapshot {
  readonly transport: MotionTransportState;
}

export interface MotionTransitionWindow {
  readonly boundaryMs: number;
  readonly startMs: number;
  readonly durationMs: number;
  readonly maxDurationMs: number;
}
