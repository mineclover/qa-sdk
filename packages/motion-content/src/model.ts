// @def.boundary motion-content-system
/** 시간축 위의 구간을 가진 아이템의 공용 인터페이스 */
export interface MotionTimeSpan {
  readonly id: string;
  readonly startMs: number;
  readonly durationMs: number;
}

/** 타임라인 아이템의 종류 (transition 제외 — 별도 처리) */
export type MotionItemKind = "layer" | "sequence" | "caption";

export type MotionParameterType = "text" | "color" | "number" | "select";

export interface MotionParameterDef {
  readonly id: string;
  readonly label: string;
  readonly type: MotionParameterType;
  readonly defaultValue: string | number;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly options?: readonly { readonly value: string; readonly label: string }[];
}

export interface MotionCaptionCue extends MotionTimeSpan {
  readonly text: string;
  readonly tone?: "neutral" | "accent" | "warning";
}

export type MotionCueKind =
  | "fade"
  | "slide-up"
  | "slide-left"
  | "slide-right"
  | "scale-pop";

export interface MotionCueDef {
  readonly kind: MotionCueKind;
  readonly durationMs: number;
  readonly ease?: string;
  readonly amount?: number;
  readonly opacity?: number;
  readonly overlapMs?: number;
}

/** 재사용 가능한 cue 프리셋 */
export interface MotionCuePreset extends MotionCueDef {
  readonly id: string;
  readonly label: string;
}

/** Cue 참조 — preset id 또는 인라인 정의 */
export type MotionCueRef =
  | MotionCueDef
  | { readonly preset: string };

/** CueRef가 preset 참조인지 판별한다 */
export function isCuePresetRef(ref: MotionCueRef): ref is { readonly preset: string } {
  return "preset" in ref && !("kind" in ref);
}

export interface MotionStageTargetV1 {
  readonly kind: "stage-node";
  readonly nodeId: string;
}

export function createMotionStageNodeTarget(
  nodeId: string,
): MotionStageTargetV1 {
  return { kind: "stage-node", nodeId };
}

/** Layer가 감싸는 콘텐츠의 종류 */
export type MotionLayerContentType = "dom" | "image" | "video" | "svg" | "canvas";

export interface MotionDomContent {
  readonly type: "dom";
}

export interface MotionImageContent {
  readonly type: "image";
  readonly src: string;
  readonly alt?: string;
  readonly objectFit?: "cover" | "contain" | "fill" | "none";
}

export interface MotionVideoContent {
  readonly type: "video";
  readonly src: string;
  readonly poster?: string;
  readonly muted?: boolean;
  readonly loop?: boolean;
}

export interface MotionSvgContent {
  readonly type: "svg";
  readonly viewBox?: string;
}

export interface MotionCanvasContent {
  readonly type: "canvas";
  readonly width?: number;
  readonly height?: number;
}

/** Layer 콘텐츠 유니온. 생략하면 "dom" 기본 */
export type MotionLayerContent =
  | MotionDomContent
  | MotionImageContent
  | MotionVideoContent
  | MotionSvgContent
  | MotionCanvasContent;

/** V2 target — 식별자와 콘텐츠만 소유한다. 타이밍/애니메이션은 scene placement로 이동한다. */
export interface MotionTargetDef {
  readonly id: string;
  readonly target: MotionStageTargetV1;
  /** 콘텐츠 타입. 생략하면 "dom" (범용 DOM 요소) */
  readonly content?: MotionLayerContent;
}

export interface MotionLayerDef extends MotionTimeSpan {
  readonly label: string;
  readonly target: MotionStageTargetV1;
  /** 콘텐츠 타입. 생략하면 "dom" (범용 DOM 요소) */
  readonly content?: MotionLayerContent;
  /** 진입 애니메이션. 인라인 MotionCueDef 또는 { preset: "id" } */
  readonly enter: MotionCueRef;
  /** 퇴장 애니메이션. 생략 가능 */
  readonly exit?: MotionCueRef;
}

/** Sequence 안에서 Layer의 시간 좌표계와 역할을 지정하는 슬롯 */
export interface SequenceLayerSlot {
  readonly layerId: string;
  /** sequence.startMs 기준 상대 오프셋 (ms).
   *  지정하면 상대 좌표: 실효 startMs = sequence.startMs + offsetMs.
   *  생략하면 절대 좌표: 실효 startMs = layer.startMs. */
  readonly offsetMs?: number;
  /** 시각적 쌓기 순서. 높을수록 위. 기본 = 배열 인덱스 */
  readonly zIndex?: number;
  /** 의미적 역할 */
  readonly role?: "background" | "content" | "overlay" | "accent";
}

export type SequenceLayerSlotRole = SequenceLayerSlot["role"];

/** Stagger 패턴 — slot 배열 순서대로 일정 간격으로 offsetMs를 자동 파생 */
export interface SequenceStaggerPattern {
  /** 첫 layer의 시작 오프셋 (ms) */
  readonly startOffsetMs: number;
  /** layer 간 간격 (ms) */
  readonly intervalMs: number;
}

export interface MotionSequenceDef extends MotionTimeSpan {
  readonly title: string;
  /** 슬롯 기반 layer 구성 (우선).
   *  layers가 있으면 이것이 유일한 진실 원천 — layerIds는 자동 파생.
   *  layers가 없으면 layerIds가 진실 원천 (절대좌표 전용). */
  readonly layers?: readonly SequenceLayerSlot[];
  /** Stagger 패턴. 지정하면 slot.offsetMs를 자동 파생한다.
   *  개별 slot에 offsetMs가 명시되어 있으면 해당 slot은 stagger 대신 명시값을 사용. */
  readonly stagger?: SequenceStaggerPattern;
  /** layer id 목록. layers가 있으면 정규화 시 자동 파생되므로 직접 지정하지 않는다. */
  readonly layerIds: readonly string[];
  readonly captionIds?: readonly string[];
}

/** Scene 안에서 target의 상대 시간/애니메이션을 정의한다. */
export interface SceneLayerPlacement {
  readonly targetId: string;
  /** scene.startMs 기준 상대 오프셋 (ms) */
  readonly startMs: number;
  /** scene 내부 지속 시간 (ms) */
  readonly durationMs: number;
  readonly enter: MotionCueRef;
  readonly exit?: MotionCueRef;
}

/** Scene sequence 안에서 target 배치의 상대 순서와 역할을 지정한다. */
export interface SceneSequenceTargetSlot {
  readonly targetId: string;
  readonly offsetMs?: number;
  readonly zIndex?: number;
  readonly role?: SequenceLayerSlotRole;
}

/** V2 scene 내부 sequence — scene.startMs 기준 상대 좌표계를 쓴다. */
export interface MotionSceneSequenceDef extends MotionTimeSpan {
  readonly title: string;
  readonly layers?: readonly SceneSequenceTargetSlot[];
  readonly stagger?: SequenceStaggerPattern;
  readonly targetIds: readonly string[];
  readonly captionIds?: readonly string[];
}

/** V2 scene — 글로벌 타임라인 위에 자유롭게 배치되며 서로 겹칠 수 있다. */
export interface MotionSceneDef extends MotionTimeSpan {
  readonly title: string;
  readonly layers: readonly SceneLayerPlacement[];
  readonly sequences: readonly MotionSceneSequenceDef[];
  readonly captions: readonly MotionCaptionCue[];
}

export type MotionTransitionStyle = "crossfade" | "flash" | "lift";

export interface CrossfadeParams {
  /** brightness 최저값 (기본 0.86) */
  readonly brightness?: number;
}

export interface FlashParams {
  /** 글로우 색상 (기본 "rgba(240,143,32,0.24)") */
  readonly glowColor?: string;
  /** 글로우 크기 px (기본 120) */
  readonly glowSize?: number;
}

export interface LiftParams {
  /** Y축 이동량 px (기본 18) */
  readonly liftY?: number;
}

export type MotionTransitionParams = CrossfadeParams | FlashParams | LiftParams;

export interface MotionTransitionDef {
  readonly id: string;
  readonly fromSequenceId: string;
  readonly toSequenceId: string;
  readonly style: MotionTransitionStyle;
  readonly durationMs: number;
  /** 스타일별 파라미터. 생략하면 기본값 사용 */
  readonly params?: MotionTransitionParams;
}

export interface MotionTextAsset {
  readonly id: string;
  readonly type: "text";
  readonly target: MotionStageTargetV1;
  readonly template: string;
}

export interface MotionStyleAsset {
  readonly id: string;
  readonly type: "style";
  readonly target: MotionStageTargetV1;
  readonly property: "background" | "color" | "borderColor";
  readonly template: string;
}

export type MotionAssetDef = MotionTextAsset | MotionStyleAsset;

export interface MotionCompositionDef {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly durationMs: number;
  readonly parameters: readonly MotionParameterDef[];
  /** 재사용 가능한 cue 프리셋 라이브러리 */
  readonly cuePresets?: readonly MotionCuePreset[];
  readonly assets: readonly MotionAssetDef[];
  readonly layers: readonly MotionLayerDef[];
  readonly sequences: readonly MotionSequenceDef[];
  readonly captions: readonly MotionCaptionCue[];
  readonly transitions: readonly MotionTransitionDef[];
}

export interface MotionCompositionDefV2 {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly durationMs: number;
  readonly parameters: readonly MotionParameterDef[];
  /** 재사용 가능한 cue 프리셋 라이브러리 */
  readonly cuePresets?: readonly MotionCuePreset[];
  readonly assets: readonly MotionAssetDef[];
  readonly targets: readonly MotionTargetDef[];
  readonly scenes: readonly MotionSceneDef[];
}

export type MotionParameterValues = Record<string, string | number>;

export interface ResolvedMotionComposition extends MotionCompositionDef {
  readonly values: MotionParameterValues;
}

export interface ResolvedMotionCompositionV2 extends MotionCompositionDefV2 {
  readonly values: MotionParameterValues;
}

function resolveMotionParameterValues(
  parameters: readonly MotionParameterDef[],
  overrides: Partial<MotionParameterValues> = {},
): MotionParameterValues {
  const values: MotionParameterValues = {};
  for (const param of parameters) {
    values[param.id] = overrides[param.id] ?? param.defaultValue;
  }
  return values;
}

export function resolveMotionComposition(
  composition: MotionCompositionDef,
  overrides: Partial<MotionParameterValues> = {},
): ResolvedMotionComposition {
  return {
    ...composition,
    values: resolveMotionParameterValues(composition.parameters, overrides),
  };
}

export function resolveMotionCompositionV2(
  composition: MotionCompositionDefV2,
  overrides: Partial<MotionParameterValues> = {},
): ResolvedMotionCompositionV2 {
  return {
    ...composition,
    values: resolveMotionParameterValues(composition.parameters, overrides),
  };
}

/** CueRef를 실제 MotionCueDef로 해석한다. preset 참조 시 composition.cuePresets에서 조회 */
export function resolveCue(
  ref: MotionCueRef,
  presets: readonly MotionCuePreset[] = [],
): MotionCueDef | null {
  if (!isCuePresetRef(ref)) return ref;
  const preset = presets.find((p) => p.id === ref.preset);
  if (!preset) return null;
  const { id: _id, label: _label, ...cue } = preset;
  return cue;
}

export function applyMotionTemplate(
  template: string,
  values: MotionParameterValues,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => String(values[key] ?? ""));
}
