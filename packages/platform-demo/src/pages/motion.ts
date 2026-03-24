import {
  resolveMotionComposition,
  type MotionCompositionDef,
  type MotionParameterDef,
  type MotionParameterValues,
  type MotionTransitionStyle,
} from "../motion/model.js";
import { createMotionPlayer } from "../motion/runtime.js";

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

function createComposition(transitionStyle: MotionTransitionStyle): MotionCompositionDef {
  return {
    id: "promo-grid",
    title: "Promo Grid",
    description: "Remotion식 composition/sequence/transition/caption 개념을 GSAP으로 재구성한 데모",
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

function parameterInput(param: MotionParameterDef, values: MotionParameterValues): string {
  const value = String(values[param.id] ?? param.defaultValue);
  if (param.type === "select") {
    return `<select data-param="${param.id}">${(param.options ?? []).map((option) => `<option value="${option.value}" ${option.value === value ? "selected" : ""}>${option.label}</option>`).join("")}</select>`;
  }
  if (param.type === "number") {
    return `<input data-param="${param.id}" type="number" value="${value}" min="${param.min ?? 0}" max="${param.max ?? 999}" step="${param.step ?? 1}" />`;
  }
  return `<input data-param="${param.id}" type="${param.type}" value="${value}" />`;
}

export function renderMotionPage(container: HTMLElement): void {
  container.innerHTML = "";
  const values: MotionParameterValues = {
    headline: "GSAP Motion Canvas",
    subline: "Scene · Sequence · Caption · Transition",
    accent: "#f08f20",
    transitionStyle: "crossfade",
  };

  let composition = resolveMotionComposition(createComposition(values.transitionStyle as MotionTransitionStyle), values);
  let player: ReturnType<typeof createMotionPlayer> | null = null;

  const wrap = document.createElement("div");
  wrap.className = "mc-wrap";
  wrap.innerHTML = `
    <div class="mc-sidebar">
      <div class="mc-panel">
        <div class="mc-kicker">GSAP Runtime</div>
        <h2 class="mc-title">모션 콘텐츠 조작</h2>
        <p class="mc-copy">
          Remotion식 개념인 composition, scene sequence, transition, caption track를
          GSAP 타임라인으로 재구성한 데모입니다.
        </p>
      </div>
      <div class="mc-panel">
        <div class="mc-panel-title">Parameters</div>
        <div class="mc-controls">
          ${composition.parameters.map((param) => `
            <label class="mc-control">
              <span>${param.label}</span>
              ${parameterInput(param, values)}
            </label>
          `).join("")}
        </div>
      </div>
      <div class="mc-panel">
        <div class="mc-panel-title">Caption Track</div>
        <pre class="mc-code">${composition.captions.map((caption) => `${caption.startMs.toString().padStart(4, " ")}-${caption.endMs.toString().padStart(4, " ")}  ${caption.text}`).join("\n")}</pre>
      </div>
      <div class="mc-panel">
        <div class="mc-panel-title">Sequence Map</div>
        <ul class="mc-seq-list">
          ${composition.sequences.map((sequence) => `<li><strong>${sequence.title}</strong><span>${sequence.startMs}ms / ${sequence.durationMs}ms</span></li>`).join("")}
        </ul>
      </div>
    </div>
    <div class="mc-stage-area">
      <div class="mc-toolbar">
        <button data-motion-action="play">Play</button>
        <button data-motion-action="pause">Pause</button>
        <button data-motion-action="restart">Restart</button>
        <input data-motion-scrub type="range" min="0" max="${composition.durationMs}" value="0" />
      </div>
      <div class="mc-stage" data-motion-stage>
        <div class="mc-hero" data-motion-id="hero">
          <div class="mc-chip" data-motion-id="chip">GSAP only</div>
          <h1 data-motion-id="headline"></h1>
          <p data-motion-id="subline"></p>
        </div>
        <div class="mc-card-grid">
          <article class="mc-card" data-motion-id="card-a">
            <span>Scene A</span>
            <strong>composition</strong>
            <p>장면과 레이어를 선언한다.</p>
          </article>
          <article class="mc-card" data-motion-id="card-b">
            <span>Scene B</span>
            <strong>sequence</strong>
            <p>시작 시점과 지속 시간을 가진다.</p>
          </article>
          <article class="mc-card" data-motion-id="card-c">
            <span>Scene C</span>
            <strong>transition</strong>
            <p>시퀀스 사이의 감정 곡선을 만든다.</p>
          </article>
        </div>
        <div class="mc-outro" data-motion-id="outro">GSAP timeline drives every scene change.</div>
        <div class="mc-caption" data-motion-caption data-tone="neutral"></div>
      </div>
    </div>
  `;
  container.appendChild(wrap);

  const stage = wrap.querySelector<HTMLElement>("[data-motion-stage]")!;
  const caption = wrap.querySelector<HTMLElement>("[data-motion-caption]")!;
  const scrub = wrap.querySelector<HTMLInputElement>("[data-motion-scrub]")!;

  const mount = () => {
    player?.destroy();
    composition = resolveMotionComposition(
      createComposition(values.transitionStyle as MotionTransitionStyle),
      values,
    );
    scrub.max = String(composition.durationMs);
    player = createMotionPlayer(stage, composition, caption);
  };

  const controls = wrap.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-param]");
  for (const input of controls) {
    input.addEventListener("input", () => {
      const key = input.dataset["param"]!;
      values[key] = input.type === "number" ? Number(input.value) : input.value;
      mount();
    });
  }

  wrap.querySelector<HTMLElement>("[data-motion-action='play']")!.addEventListener("click", () => player?.play());
  wrap.querySelector<HTMLElement>("[data-motion-action='pause']")!.addEventListener("click", () => player?.pause());
  wrap.querySelector<HTMLElement>("[data-motion-action='restart']")!.addEventListener("click", () => {
    player?.restart();
    scrub.value = "0";
  });
  scrub.addEventListener("input", () => player?.seek(Number(scrub.value)));

  mount();
}

