// @def.boundary motion-content-system
import type {
  MotionCaptionCue,
  MotionCueRef,
  MotionCompositionDef,
  MotionCompositionDefV2,
  MotionCueKind,
  MotionItemKind,
  MotionLayerContent,
  MotionLayerContentType,
  MotionSceneDef,
  MotionParameterValues,
  ResolvedMotionCompositionV2,
  SceneLayerPlacement,
  MotionSequenceDef,
  MotionStageTargetV1,
  MotionTransitionDef,
  MotionTransitionStyle,
  ResolvedMotionComposition,
  SequenceLayerSlotRole,
} from "./model.js";

export type MotionEditorSelection =
  | { readonly kind: "composition"; readonly id: string }
  | { readonly kind: "layer"; readonly id: string }
  | { readonly kind: "sequence"; readonly id: string }
  | { readonly kind: "caption"; readonly id: string }
  | { readonly kind: "cue-preset"; readonly id: string }
  | { readonly kind: "transition"; readonly id: string };

export type MotionCompositionSchema = MotionCompositionDef | MotionCompositionDefV2;

export type ResolvedMotionCompositionSchema =
  | ResolvedMotionComposition
  | ResolvedMotionCompositionV2;

/** V2 탐색/편집 확장용 선택 타입. 기존 MotionEditorSelection은 V1 surface로 유지한다. */
export type MotionEditorSelectionV2 =
  | MotionEditorSelection
  | { readonly kind: "target"; readonly id: string }
  | { readonly kind: "scene"; readonly id: MotionSceneDef["id"] }
  | {
    readonly kind: "scene-layer";
    readonly sceneId: MotionSceneDef["id"];
    readonly targetId: SceneLayerPlacement["targetId"];
  };

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

export interface MotionEditorState<
  TComposition extends ResolvedMotionCompositionSchema = ResolvedMotionComposition,
> {
  readonly composition: TComposition;
  readonly values: MotionParameterValues;
  readonly selection: MotionEditorSelectionV2 | null;
  readonly transport: MotionTransportState;
  readonly viewport: MotionEditorViewport;
  readonly activeSequenceIds: readonly string[];
  readonly activeLayerIds: readonly string[];
  readonly activeCaptionId: string | null;
}

export type MotionSetCompositionCommand =
  | {
    readonly type: "set-composition";
    readonly composition: MotionCompositionDef;
    readonly values?: Partial<MotionParameterValues>;
  }
  | {
    readonly type: "set-composition";
    readonly composition: MotionCompositionDefV2;
    readonly values?: Partial<MotionParameterValues>;
  };

export type MotionEditorCommand =
  | { readonly type: "select"; readonly selection: MotionEditorSelectionV2 | null }
  | MotionSetCompositionCommand
  | { readonly type: "set-parameter"; readonly parameterId: string; readonly value: string | number }
  | { readonly type: "set-current-time"; readonly timeMs: number }
  | { readonly type: "set-loop"; readonly loop: boolean }
  | { readonly type: "set-playback-rate"; readonly playbackRate: number }
  | { readonly type: "play" }
  | { readonly type: "pause" }
  | { readonly type: "restart" }
  | {
    readonly type: "add-layer";
    readonly id: string;
    readonly label: string;
    readonly target: MotionStageTargetV1;
    readonly content: MotionLayerContent;
    readonly enter?: MotionCueRef;
    readonly durationMs: number;
  }
  | { readonly type: "remove-layer"; readonly layerId: string }
  | {
    readonly type: "add-sequence";
    readonly id: string;
    readonly title: string;
    readonly startMs: number;
    readonly durationMs: number;
    readonly layerIds: readonly string[];
    readonly layers?: MotionSequenceDef["layers"];
    readonly stagger?: MotionSequenceDef["stagger"];
    readonly captionIds?: MotionSequenceDef["captionIds"];
  }
  | { readonly type: "remove-sequence"; readonly sequenceId: string }
  | {
    readonly type: "add-caption";
    readonly id: string;
    readonly text: string;
    readonly startMs: number;
    readonly durationMs: number;
    readonly tone?: MotionCaptionCue["tone"];
  }
  | { readonly type: "remove-caption"; readonly captionId: string }
  | {
    readonly type: "add-transition";
    readonly id: string;
    readonly fromSequenceId: string;
    readonly toSequenceId: string;
    readonly style: MotionTransitionDef["style"];
    readonly durationMs: number;
    readonly params?: MotionTransitionDef["params"];
  }
  | { readonly type: "remove-transition"; readonly transitionId: string }
  | {
    readonly type: "add-scene";
    readonly id: MotionSceneDef["id"];
    readonly title: string;
    readonly startMs: number;
    readonly durationMs: number;
    readonly layers?: MotionSceneDef["layers"];
    readonly sequences?: MotionSceneDef["sequences"];
    readonly captions?: MotionSceneDef["captions"];
  }
  | { readonly type: "remove-scene"; readonly sceneId: MotionSceneDef["id"] }
  | {
    readonly type: "rename-scene";
    readonly sceneId: MotionSceneDef["id"];
    readonly title: string;
  }
  | {
    readonly type: "update-scene-timing";
    readonly sceneId: MotionSceneDef["id"];
    readonly startMs: number;
    readonly durationMs: number;
  }
  | {
    readonly type: "add-scene-placement";
    readonly sceneId: MotionSceneDef["id"];
    readonly targetId: SceneLayerPlacement["targetId"];
    readonly startMs?: number;
    readonly durationMs?: number;
    readonly enter?: SceneLayerPlacement["enter"];
    readonly exit?: SceneLayerPlacement["exit"];
  }
  | {
    readonly type: "remove-scene-placement";
    readonly sceneId: MotionSceneDef["id"];
    readonly targetId: SceneLayerPlacement["targetId"];
  }
  | {
    readonly type: "update-scene-placement-timing";
    readonly sceneId: MotionSceneDef["id"];
    readonly targetId: SceneLayerPlacement["targetId"];
    readonly startMs: number;
    readonly durationMs: number;
  }
  | {
    readonly type: "update-scene-placement-cue";
    readonly sceneId: MotionSceneDef["id"];
    readonly targetId: SceneLayerPlacement["targetId"];
    readonly cue: "enter" | "exit";
    readonly cueRef: MotionCueRef | null;
  }
  | { readonly type: "update-item-string"; readonly itemKind: MotionItemKind; readonly itemId: string; readonly value: string }
  | { readonly type: "update-item-timing"; readonly itemKind: MotionItemKind; readonly itemId: string; readonly startMs: number; readonly durationMs: number }
  | {
    readonly type: "update-sequence-stagger";
    readonly sequenceId: string;
    readonly field: "startOffsetMs" | "intervalMs";
    readonly value: number;
  }
  | {
    readonly type: "update-sequence-layer-slot";
    readonly sequenceId: string;
    readonly layerId: string;
    readonly field: "offsetMs" | "zIndex";
    readonly value: number;
  }
  | {
    readonly type: "update-sequence-layer-role";
    readonly sequenceId: string;
    readonly layerId: string;
    readonly role: SequenceLayerSlotRole | null;
  }
  | {
    readonly type: "update-layer-cue-kind";
    readonly layerId: string;
    readonly cue: "enter" | "exit";
    readonly kind: MotionCueKind;
  }
  | {
    readonly type: "update-layer-cue-preset";
    readonly layerId: string;
    readonly cue: "enter" | "exit";
    readonly presetId: string;
  }
  | {
    readonly type: "update-layer-content-type";
    readonly layerId: string;
    readonly contentType: MotionLayerContentType;
  }
  | { readonly type: "update-transition-style"; readonly transitionId: string; readonly style: MotionTransitionStyle }
  | { readonly type: "update-transition-duration"; readonly transitionId: string; readonly durationMs: number }
  | {
    readonly type: "update-transition-param";
    readonly transitionId: string;
    readonly param: "brightness" | "glowColor" | "glowSize" | "liftY";
    readonly value: string | number;
  };

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
