import gsap from "gsap";
import {
  applyMotionTemplate,
  type MotionCaptionCue,
  type MotionCueDef,
  type MotionLayerDef,
  type ResolvedMotionComposition,
} from "./model.js";
import type {
  MotionDebugSnapshot,
  MotionResolvedAssetSnapshot,
} from "./editor.js";

export interface MotionPlayer {
  play(): void;
  pause(): void;
  restart(): void;
  seek(ms: number): void;
  setPlaybackRate(rate: number): void;
  setLoop(loop: boolean): void;
  progress(): number;
  currentTimeMs(): number;
  durationMs(): number;
  snapshot(): MotionDebugSnapshot;
  destroy(): void;
}

function getCueVars(cue: MotionCueDef): {
  from: gsap.TweenVars;
  to: gsap.TweenVars;
} {
  const amount = cue.amount ?? 48;
  const opacity = cue.opacity ?? 0;
  const duration = cue.durationMs / 1000;
  const ease = cue.ease ?? "power2.out";

  switch (cue.kind) {
    case "fade":
      return {
        from: { autoAlpha: opacity },
        to: { autoAlpha: 1, duration, ease },
      };
    case "slide-left":
      return {
        from: { autoAlpha: opacity, x: amount },
        to: { autoAlpha: 1, x: 0, duration, ease },
      };
    case "slide-right":
      return {
        from: { autoAlpha: opacity, x: -amount },
        to: { autoAlpha: 1, x: 0, duration, ease },
      };
    case "scale-pop":
      return {
        from: { autoAlpha: opacity, scale: 0.84, y: amount * 0.2 },
        to: { autoAlpha: 1, scale: 1, y: 0, duration, ease },
      };
    case "slide-up":
    default:
      return {
        from: { autoAlpha: opacity, y: amount },
        to: { autoAlpha: 1, y: 0, duration, ease },
      };
  }
}

function applyAssets(
  root: HTMLElement,
  composition: ResolvedMotionComposition,
): MotionResolvedAssetSnapshot[] {
  const resolved: MotionResolvedAssetSnapshot[] = [];
  for (const asset of composition.assets) {
    const target = root.querySelector<HTMLElement>(asset.target);
    if (!target) continue;
    const rendered = applyMotionTemplate(asset.template, composition.values);
    if (asset.type === "text") {
      target.textContent = rendered;
      resolved.push({ id: asset.id, type: "text", target: asset.target, value: rendered });
    } else {
      target.style[asset.property] = rendered;
      resolved.push({ id: asset.id, type: "style", target: asset.target, value: rendered });
    }
  }
  return resolved;
}

function activeCaptionAt(
  captions: readonly MotionCaptionCue[],
  timeMs: number,
): MotionCaptionCue | undefined {
  return captions.find((caption) => timeMs >= caption.startMs && timeMs <= caption.endMs);
}

function addLayerTimeline(
  timeline: gsap.core.Timeline,
  root: HTMLElement,
  layer: MotionLayerDef,
): void {
  const element = root.querySelector<HTMLElement>(layer.selector);
  if (!element) return;

  const startAt = layer.startMs / 1000;
  const enter = getCueVars(layer.enter);
  gsap.set(element, { clearProps: "all" });
  timeline.set(element, { autoAlpha: 0 }, 0);
  timeline.fromTo(element, enter.from, enter.to, startAt);

  if (!layer.exit) return;
  const exitAt = Math.max(
    startAt + (layer.durationMs - layer.exit.durationMs - (layer.exit.overlapMs ?? 0)) / 1000,
    startAt,
  );
  const exit = getCueVars(layer.exit);
  timeline.to(
    element,
    { ...exit.from, duration: layer.exit.durationMs / 1000, ease: layer.exit.ease ?? "power2.in" },
    exitAt,
  );
}

function addTransitionTimeline(
  timeline: gsap.core.Timeline,
  root: HTMLElement,
  composition: ResolvedMotionComposition,
): void {
  const sequenceById = new Map(composition.sequences.map((sequence) => [sequence.id, sequence]));
  for (const transition of composition.transitions) {
    const toSequence = sequenceById.get(transition.toSequenceId);
    if (!toSequence) continue;
    const startAt = Math.max((toSequence.startMs - transition.durationMs) / 1000, 0);
    if (transition.style === "crossfade") {
      timeline.fromTo(root, { filter: "brightness(0.86)" }, { filter: "brightness(1)", duration: transition.durationMs / 1000, ease: "sine.out" }, startAt);
      continue;
    }
    if (transition.style === "flash") {
      timeline.fromTo(root, { boxShadow: "0 0 0 rgba(0,0,0,0)" }, { boxShadow: "0 0 120px rgba(240,143,32,0.24)", duration: transition.durationMs / 2000, yoyo: true, repeat: 1 }, startAt);
      continue;
    }
    timeline.fromTo(root, { y: 18 }, { y: 0, duration: transition.durationMs / 1000, ease: "power2.out" }, startAt);
  }
}

export function createMotionPlayer(
  root: HTMLElement,
  composition: ResolvedMotionComposition,
  captionEl: HTMLElement,
): MotionPlayer {
  const resolvedAssets = applyAssets(root, composition);
  let loop = false;

  const timeline = gsap.timeline({
    paused: true,
    defaults: { ease: "power2.out" },
    repeat: 0,
    onUpdate: () => {
      const timeMs = timeline.time() * 1000;
      const active = activeCaptionAt(composition.captions, timeMs);
      captionEl.textContent = active?.text ?? "";
      captionEl.dataset["tone"] = active?.tone ?? "neutral";
    },
  });

  for (const layer of composition.layers) {
    addLayerTimeline(timeline, root, layer);
  }
  addTransitionTimeline(timeline, root, composition);

  return {
    play() {
      timeline.play();
    },
    pause() {
      timeline.pause();
    },
    restart() {
      timeline.restart();
    },
    seek(ms: number) {
      timeline.time(Math.max(0, Math.min(ms, composition.durationMs)) / 1000, false);
    },
    setPlaybackRate(rate: number) {
      timeline.timeScale(rate);
    },
    setLoop(nextLoop: boolean) {
      loop = nextLoop;
      timeline.repeat(loop ? -1 : 0);
    },
    progress() {
      return timeline.progress();
    },
    currentTimeMs() {
      return timeline.time() * 1000;
    },
    durationMs() {
      return composition.durationMs;
    },
    snapshot() {
      const timeMs = timeline.time() * 1000;
      const activeCaption = activeCaptionAt(composition.captions, timeMs);
      const activeLayerIds = composition.layers
        .filter((layer) => timeMs >= layer.startMs && timeMs <= (layer.startMs + layer.durationMs))
        .map((layer) => layer.id);
      const activeSequenceIds = composition.sequences
        .filter((sequence) => timeMs >= sequence.startMs && timeMs <= (sequence.startMs + sequence.durationMs))
        .map((sequence) => sequence.id);
      return {
        timeMs,
        activeSequenceIds,
        activeLayerIds,
        activeCaptionId: activeCaption?.id ?? null,
        captionText: activeCaption?.text ?? "",
        resolvedAssets,
      };
    },
    destroy() {
      timeline.kill();
      gsap.set(root.querySelectorAll("[data-motion-id]"), { clearProps: "all" });
      captionEl.textContent = "";
    },
  };
}
