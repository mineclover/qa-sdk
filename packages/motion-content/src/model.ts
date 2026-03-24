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

export interface MotionCaptionCue {
  readonly id: string;
  readonly text: string;
  readonly startMs: number;
  readonly endMs: number;
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

export interface MotionLayerDef {
  readonly id: string;
  readonly label: string;
  readonly selector: string;
  readonly startMs: number;
  readonly durationMs: number;
  readonly enter: MotionCueDef;
  readonly exit?: MotionCueDef;
}

export interface MotionSequenceDef {
  readonly id: string;
  readonly title: string;
  readonly startMs: number;
  readonly durationMs: number;
  readonly layerIds: readonly string[];
  readonly captionIds?: readonly string[];
}

export type MotionTransitionStyle = "crossfade" | "flash" | "lift";

export interface MotionTransitionDef {
  readonly id: string;
  readonly fromSequenceId: string;
  readonly toSequenceId: string;
  readonly style: MotionTransitionStyle;
  readonly durationMs: number;
}

export interface MotionTextAsset {
  readonly id: string;
  readonly type: "text";
  readonly target: string;
  readonly template: string;
}

export interface MotionStyleAsset {
  readonly id: string;
  readonly type: "style";
  readonly target: string;
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
  readonly assets: readonly MotionAssetDef[];
  readonly layers: readonly MotionLayerDef[];
  readonly sequences: readonly MotionSequenceDef[];
  readonly captions: readonly MotionCaptionCue[];
  readonly transitions: readonly MotionTransitionDef[];
}

export type MotionParameterValues = Record<string, string | number>;

export interface ResolvedMotionComposition extends MotionCompositionDef {
  readonly values: MotionParameterValues;
}

export function resolveMotionComposition(
  composition: MotionCompositionDef,
  overrides: Partial<MotionParameterValues> = {},
): ResolvedMotionComposition {
  const values: MotionParameterValues = {};
  for (const param of composition.parameters) {
    values[param.id] = overrides[param.id] ?? param.defaultValue;
  }
  return { ...composition, values };
}

export function applyMotionTemplate(
  template: string,
  values: MotionParameterValues,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => String(values[key] ?? ""));
}

