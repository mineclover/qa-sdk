// @def.boundary motion-content-system
import {
  createMotionStageNodeTarget,
  type MotionCompositionDef,
  type MotionCuePreset,
  type MotionParameterDef,
  type MotionTransitionStyle,
  type SequenceLayerSlot,
} from "./model.js";

/** layers 슬롯에서 layerIds를 파생한다 */
function layerIdsFrom(slots: readonly SequenceLayerSlot[]): readonly string[] {
  return slots.map((s) => s.layerId);
}

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
    cuePresets: [
      { id: "slide-up-default", label: "기본 슬라이드업", kind: "slide-up", durationMs: 420 },
      { id: "fade-out-quick", label: "빠른 페이드아웃", kind: "fade", durationMs: 260 },
      { id: "fade-out-mid", label: "중간 페이드아웃", kind: "fade", durationMs: 280 },
      { id: "pop-in", label: "팝 등장", kind: "scale-pop", durationMs: 520 },
    ] satisfies MotionCuePreset[],
    assets: [
      { id: "headline", type: "text", target: createMotionStageNodeTarget("headline"), template: "{{headline}}" },
      { id: "subline", type: "text", target: createMotionStageNodeTarget("subline"), template: "{{subline}}" },
      { id: "accent-border", type: "style", target: createMotionStageNodeTarget("hero"), property: "borderColor", template: "{{accent}}" },
      { id: "accent-chip", type: "style", target: createMotionStageNodeTarget("chip"), property: "background", template: "{{accent}}" },
    ],
    layers: [
      // 인라인 cue — chip만 고유한 slide-right 사용
      { id: "chip", label: "Chip", target: createMotionStageNodeTarget("chip"), content: { type: "dom" }, startMs: 0, durationMs: 1800, enter: { kind: "slide-right", durationMs: 420 }, exit: { preset: "fade-out-mid" } },
      // 인라인 + preset 혼합
      { id: "headline", label: "Headline", target: createMotionStageNodeTarget("headline"), content: { type: "dom" }, startMs: 120, durationMs: 2400, enter: { kind: "slide-up", durationMs: 640 }, exit: { kind: "fade", durationMs: 320 } },
      { id: "subline", label: "Subline", target: createMotionStageNodeTarget("subline"), content: { type: "dom" }, startMs: 360, durationMs: 2500, enter: { kind: "slide-up", durationMs: 540, amount: 24 }, exit: { preset: "fade-out-quick" } },
      // preset 참조
      { id: "card-a", label: "Card A", target: createMotionStageNodeTarget("card-a"), content: { type: "image", src: "/assets/card-a.png", alt: "Scene A", objectFit: "cover" }, startMs: 1850, durationMs: 2200, enter: { preset: "pop-in" }, exit: { preset: "fade-out-quick" } },
      { id: "card-b", label: "Card B", target: createMotionStageNodeTarget("card-b"), content: { type: "svg", viewBox: "0 0 240 160" }, startMs: 2120, durationMs: 2200, enter: { kind: "slide-left", durationMs: 500 }, exit: { preset: "fade-out-quick" } },
      { id: "card-c", label: "Card C", target: createMotionStageNodeTarget("card-c"), content: { type: "dom" }, startMs: 2390, durationMs: 2200, enter: { kind: "slide-up", durationMs: 480, amount: 32 }, exit: { kind: "fade", durationMs: 240 } },
      { id: "outro", label: "Outro", target: createMotionStageNodeTarget("outro"), content: { type: "dom" }, startMs: 4620, durationMs: 1600, enter: { preset: "slide-up-default" }, exit: { kind: "fade", durationMs: 240 } },
    ],
    sequences: (() => {
      const introLayers: SequenceLayerSlot[] = [
        { layerId: "chip", offsetMs: 0, zIndex: 0, role: "accent" },
        { layerId: "headline", offsetMs: 120, zIndex: 1, role: "content" },
        { layerId: "subline", offsetMs: 360, zIndex: 2, role: "content" },
      ];
      // stagger 패턴: startOffsetMs=150, intervalMs=270 → offsetMs 자동 파생
      const cardsLayers: SequenceLayerSlot[] = [
        { layerId: "card-a", zIndex: 0, role: "content" },
        { layerId: "card-b", zIndex: 1, role: "content" },
        { layerId: "card-c", zIndex: 2, role: "content" },
      ];
      const outroLayers: SequenceLayerSlot[] = [
        { layerId: "outro", offsetMs: 120, zIndex: 0, role: "content" },
      ];
      return [
        { id: "intro", title: "Intro", startMs: 0, durationMs: 1700, layers: introLayers, layerIds: layerIdsFrom(introLayers), captionIds: ["cap-1"] },
        { id: "cards", title: "Cards", startMs: 1700, durationMs: 2800, layers: cardsLayers, stagger: { startOffsetMs: 150, intervalMs: 270 }, layerIds: layerIdsFrom(cardsLayers), captionIds: ["cap-2", "cap-3"] },
        { id: "outro", title: "Outro", startMs: 4500, durationMs: 1500, layers: outroLayers, layerIds: layerIdsFrom(outroLayers), captionIds: ["cap-4"] },
      ];
    })(),
    captions: [
      { id: "cap-1", text: "Composition이 시작되고 hero sequence가 열린다.", startMs: 60, durationMs: 1460, tone: "neutral" },
      { id: "cap-2", text: "card-a를 먼저 띄워 anchor를 만들고, 뒤를 staggered로 잇는다.", startMs: 1820, durationMs: 1040, tone: "accent" },
      { id: "cap-3", text: "시퀀스 내부는 layer별 absolute timing으로 제어한다.", startMs: 2860, durationMs: 1440, tone: "neutral" },
      { id: "cap-4", text: "Transition 이후 CTA를 outro sequence로 분리한다.", startMs: 4700, durationMs: 1500, tone: "warning" },
    ],
    transitions: [
      { id: "intro-cards", fromSequenceId: "intro", toSequenceId: "cards", style: transitionStyle, durationMs: 360, params: transitionStyle === "crossfade" ? { brightness: 0.82 } : transitionStyle === "flash" ? { glowColor: "rgba(240,143,32,0.3)", glowSize: 100 } : { liftY: 24 } },
      { id: "cards-outro", fromSequenceId: "cards", toSequenceId: "outro", style: transitionStyle, durationMs: 320 },
    ],
  };
}
