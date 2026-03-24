import type { MotionCompositionDef, MotionParameterDef, MotionTransitionStyle } from "./model.js";

const BASE_PARAMETERS: readonly MotionParameterDef[] = [
  { id: "headline", label: "Headline", type: "text", defaultValue: "GSAP Motion Canvas" },
  { id: "subline", label: "Subline", type: "text", defaultValue: "Scene · Sequence · Caption · Transition" },
  { id: "accent", label: "Accent", type: "color", defaultValue: "#f08f20" },
  {
    id: "transitionStyle",
    label: "Transition",
    type: "select",
    defaultValue: "crossfade",
    options: [
      { value: "crossfade", label: "Crossfade" },
      { value: "flash", label: "Flash" },
      { value: "lift", label: "Lift" },
    ],
  },
];

export function createPromoGridComposition(
  transitionStyle: MotionTransitionStyle = "crossfade",
): MotionCompositionDef {
  return {
    id: "promo-grid",
    title: "Promo Grid",
    description: "Remotion식 composition/sequence/transition/caption 개념을 GSAP으로 재구성한 예제",
    durationMs: 6600,
    parameters: BASE_PARAMETERS,
    assets: [
      { id: "headline", type: "text", target: "[data-motion-id='headline']", template: "{{headline}}" },
      { id: "subline", type: "text", target: "[data-motion-id='subline']", template: "{{subline}}" },
      { id: "accent-border", type: "style", target: "[data-motion-id='hero']", property: "borderColor", template: "{{accent}}" },
      { id: "accent-chip", type: "style", target: "[data-motion-id='chip']", property: "background", template: "{{accent}}" },
    ],
    layers: [
      { id: "chip", label: "Chip", selector: "[data-motion-id='chip']", startMs: 0, durationMs: 1800, enter: { kind: "slide-right", durationMs: 420 }, exit: { kind: "fade", durationMs: 280 } },
      { id: "headline", label: "Headline", selector: "[data-motion-id='headline']", startMs: 120, durationMs: 2400, enter: { kind: "slide-up", durationMs: 640 }, exit: { kind: "fade", durationMs: 320 } },
      { id: "subline", label: "Subline", selector: "[data-motion-id='subline']", startMs: 360, durationMs: 2500, enter: { kind: "slide-up", durationMs: 540, amount: 24 }, exit: { kind: "fade", durationMs: 260 } },
      { id: "card-a", label: "Card A", selector: "[data-motion-id='card-a']", startMs: 1850, durationMs: 2200, enter: { kind: "scale-pop", durationMs: 520 }, exit: { kind: "fade", durationMs: 260 } },
      { id: "card-b", label: "Card B", selector: "[data-motion-id='card-b']", startMs: 2120, durationMs: 2200, enter: { kind: "slide-left", durationMs: 500 }, exit: { kind: "fade", durationMs: 260 } },
      { id: "card-c", label: "Card C", selector: "[data-motion-id='card-c']", startMs: 2390, durationMs: 2200, enter: { kind: "slide-up", durationMs: 480, amount: 32 }, exit: { kind: "fade", durationMs: 240 } },
      { id: "outro", label: "Outro", selector: "[data-motion-id='outro']", startMs: 4620, durationMs: 1600, enter: { kind: "slide-up", durationMs: 420 }, exit: { kind: "fade", durationMs: 240 } },
    ],
    sequences: [
      { id: "intro", title: "Intro", startMs: 0, durationMs: 1700, layerIds: ["chip", "headline", "subline"], captionIds: ["cap-1"] },
      { id: "cards", title: "Cards", startMs: 1700, durationMs: 2800, layerIds: ["card-a", "card-b", "card-c"], captionIds: ["cap-2", "cap-3"] },
      { id: "outro", title: "Outro", startMs: 4500, durationMs: 1500, layerIds: ["outro"], captionIds: ["cap-4"] },
    ],
    captions: [
      { id: "cap-1", text: "Composition이 시작되고 hero sequence가 열린다.", startMs: 60, endMs: 1520, tone: "neutral" },
      { id: "cap-2", text: "card-a를 먼저 띄워 anchor를 만들고, 뒤를 staggered로 잇는다.", startMs: 1820, endMs: 2860, tone: "accent" },
      { id: "cap-3", text: "시퀀스 내부는 layer별 absolute timing으로 제어한다.", startMs: 2860, endMs: 4300, tone: "neutral" },
      { id: "cap-4", text: "Transition 이후 CTA를 outro sequence로 분리한다.", startMs: 4700, endMs: 6200, tone: "warning" },
    ],
    transitions: [
      { id: "intro-cards", fromSequenceId: "intro", toSequenceId: "cards", style: transitionStyle, durationMs: 360 },
      { id: "cards-outro", fromSequenceId: "cards", toSequenceId: "outro", style: transitionStyle, durationMs: 320 },
    ],
  };
}

