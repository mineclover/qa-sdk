import { serializeMotionComposition } from "./io.js";
import type {
  MotionCompositionDef,
  MotionParameterDef,
  MotionTransitionStyle,
} from "./model.js";
import { createPromoGridComposition } from "./presets.js";

export interface MotionCompositionExampleDocument {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly document: string;
}

interface PromoGridExampleOptions {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly headline: string;
  readonly subline: string;
  readonly accent: string;
  readonly transitionStyle: MotionTransitionStyle;
}

function overrideParameterDefaults(
  parameters: readonly MotionParameterDef[],
  overrides: Record<string, string | number>,
): readonly MotionParameterDef[] {
  return parameters.map((parameter) =>
    Object.prototype.hasOwnProperty.call(overrides, parameter.id)
      ? {
          ...parameter,
          defaultValue: overrides[parameter.id] ?? parameter.defaultValue,
        }
      : parameter,
  );
}

function createPromoGridExample(
  options: PromoGridExampleOptions,
): MotionCompositionDef {
  const base = createPromoGridComposition(options.transitionStyle);
  return {
    ...base,
    id: options.id,
    title: options.label,
    description: options.description,
    parameters: overrideParameterDefaults(base.parameters, {
      headline: options.headline,
      subline: options.subline,
      accent: options.accent,
      transitionStyle: options.transitionStyle,
    }),
  };
}

export const MOTION_COMPOSITION_PRESET_DOCUMENTS: readonly MotionCompositionExampleDocument[] = [
  {
    id: "launch-crossfade",
    label: "런치 크로스페이드",
    description: "런치 티저형 preset. 부드러운 crossfade와 따뜻한 accent를 쓴다.",
    document: serializeMotionComposition(
      createPromoGridExample({
        id: "launch-crossfade",
        label: "런치 크로스페이드",
        description: "런치 티저형 preset. 부드러운 crossfade와 따뜻한 accent를 쓴다.",
        headline: "Launch The Story",
        subline: "런치 티저 · 크로스페이드 · 웜 톤",
        accent: "#f08f20",
        transitionStyle: "crossfade",
      }),
    ),
  },
  {
    id: "sale-flash",
    label: "세일 플래시",
    description: "짧고 강한 flash 전환으로 긴급 프로모션을 검증하는 preset.",
    document: serializeMotionComposition(
      createPromoGridExample({
        id: "sale-flash",
        label: "세일 플래시",
        description: "짧고 강한 flash 전환으로 긴급 프로모션을 검증하는 preset.",
        headline: "72H Flash Offer",
        subline: "플래시 세일 · 빠른 전환 · 하이 컨트라스트",
        accent: "#ff5d5d",
        transitionStyle: "flash",
      }),
    ),
  },
  {
    id: "brand-lift",
    label: "브랜드 리프트",
    description: "lift 전환과 차가운 accent로 브랜드 소개 흐름을 보는 preset.",
    document: serializeMotionComposition(
      createPromoGridExample({
        id: "brand-lift",
        label: "브랜드 리프트",
        description: "lift 전환과 차가운 accent로 브랜드 소개 흐름을 보는 preset.",
        headline: "Design Moves Signal",
        subline: "브랜드 리프트 · 선명한 계층 · 쿨 톤",
        accent: "#4bb7ff",
        transitionStyle: "lift",
      }),
    ),
  },
] as const;

export const PROMO_GRID_COMPOSITION_V1_JSON = serializeMotionComposition(
  createPromoGridComposition("crossfade"),
);
