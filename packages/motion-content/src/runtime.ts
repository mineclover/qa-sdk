import gsap from "gsap";
import {
  type CrossfadeParams,
  type FlashParams,
  type LiftParams,
  type MotionCaptionCue,
  type MotionCueDef,
  type MotionCuePreset,
  type MotionLayerDef,
  type MotionStageTargetV1,
  type ResolvedMotionComposition,
  resolveCue,
} from "./model.js";
import type {
  MotionRuntimeSnapshot,
  MotionResolvedAssetSnapshot,
  MotionTransportState,
} from "./editor.js";
import {
  buildResolvedLayerStartMap,
  createMotionDebugSnapshot as buildMotionDebugSnapshot,
  resolveMotionAssetSnapshots,
} from "./editor.js";
import { endMs, normalizePlaybackRate } from "./utils.js";

export interface MotionStageAdapter {
  readonly stageRoot: HTMLElement;
  readonly captionElement: HTMLElement;
  resolveAssetTarget(target: MotionStageTargetV1): HTMLElement | null;
  resolveLayerTarget(target: MotionStageTargetV1): HTMLElement | null;
  managedElements(): readonly HTMLElement[];
}

export interface MotionDomStageAdapterOptions {
  readonly stageRoot: HTMLElement;
  readonly captionElement: HTMLElement;
  readonly targetAttribute?: string;
}

export function createMotionDomStageAdapter(
  options: MotionDomStageAdapterOptions,
): MotionStageAdapter {
  const targetAttribute = options.targetAttribute ?? "data-motion-id";
  const targetMap = new Map<string, HTMLElement>();
  const elements = Array.from(
    options.stageRoot.querySelectorAll<HTMLElement>(`[${targetAttribute}]`),
  );

  for (const element of elements) {
    const nodeId = element.getAttribute(targetAttribute);
    if (!nodeId || targetMap.has(nodeId)) continue;
    targetMap.set(nodeId, element);
  }

  const managed = [options.stageRoot, ...targetMap.values()];

  return {
    stageRoot: options.stageRoot,
    captionElement: options.captionElement,
    resolveAssetTarget(target) {
      return targetMap.get(target.nodeId) ?? null;
    },
    resolveLayerTarget(target) {
      return targetMap.get(target.nodeId) ?? null;
    },
    managedElements() {
      return managed;
    },
  };
}

export interface MotionTransportApi {
  play(): void;
  pause(): void;
  restart(): void;
  seek(ms: number): void;
  setPlaybackRate(rate: number): void;
  setLoop(loop: boolean): void;
  getTransportState(): MotionTransportState;
}

export interface MotionPlayerOptions {
  /** 매 프레임 재생 시각이 갱신될 때 호출된다 (GSAP onUpdate 연동) */
  onTimeUpdate?(timeMs: number): void;
  /** 비루프 재생이 끝까지 도달했을 때 호출된다 */
  onComplete?(): void;
}

export interface MotionPlayer extends MotionTransportApi {
  /** player가 파괴되었는지. destroy() 호출 후 true */
  readonly destroyed: boolean;
  progress(): number;
  currentTimeMs(): number;
  durationMs(): number;
  snapshot(): MotionRuntimeSnapshot;
  destroy(): void;
}

function clampTimeMs(timeMs: number, durationMs: number): number {
  return Math.max(0, Math.min(timeMs, durationMs));
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
  adapter: MotionStageAdapter,
  composition: ResolvedMotionComposition,
): MotionResolvedAssetSnapshot[] {
  const targetByAssetId = new Map<string, HTMLElement | null>();
  for (const asset of composition.assets) {
    targetByAssetId.set(asset.id, adapter.resolveAssetTarget(asset.target));
  }
  const resolved = resolveMotionAssetSnapshots(
    composition,
    Object.fromEntries(
      composition.assets.map((asset) => [asset.id, targetByAssetId.get(asset.id) !== null]),
    ),
  );
  for (const asset of composition.assets) {
    const target = targetByAssetId.get(asset.id);
    if (!target) continue;
    const entry = resolved.find((item) => item.id === asset.id);
    if (!entry) continue;
    if (asset.type === "text") target.textContent = entry.value;
    else target.style[asset.property] = entry.value;
  }
  return resolved;
}

function activeCaptionAt(
  captions: readonly MotionCaptionCue[],
  timeMs: number,
): MotionCaptionCue | undefined {
  return captions.find((caption) => timeMs >= caption.startMs && timeMs <= endMs(caption));
}

function addLayerTimeline(
  timeline: gsap.core.Timeline,
  adapter: MotionStageAdapter,
  layer: MotionLayerDef,
  resolvedStartMs: number,
  presets: readonly MotionCuePreset[],
): void {
  const element = adapter.resolveLayerTarget(layer.target);
  if (!element) return;

  const enterCue = resolveCue(layer.enter, presets);
  if (!enterCue) return; // preset 미발견 시 스킵

  const startAt = resolvedStartMs / 1000;
  const enter = getCueVars(enterCue);
  gsap.set(element, { clearProps: "all" });
  timeline.set(element, { autoAlpha: 0 }, 0);
  timeline.fromTo(element, enter.from, enter.to, startAt);

  if (!layer.exit) return;
  const exitCue = resolveCue(layer.exit, presets);
  if (!exitCue) return;

  const resolvedEndMs = resolvedStartMs + layer.durationMs;
  const exitAt = Math.max(
    (resolvedEndMs - exitCue.durationMs - (exitCue.overlapMs ?? 0)) / 1000,
    startAt,
  );
  const exit = getCueVars(exitCue);
  timeline.to(
    element,
    { ...exit.from, duration: exitCue.durationMs / 1000, ease: exitCue.ease ?? "power2.in" },
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
    const params = transition.params ?? {};
    if (transition.style === "crossfade") {
      const brightness = (params as CrossfadeParams).brightness ?? 0.86;
      timeline.fromTo(root, { filter: `brightness(${brightness})` }, { filter: "brightness(1)", duration: transition.durationMs / 1000, ease: "sine.out" }, startAt);
      continue;
    }
    if (transition.style === "flash") {
      const glowColor = (params as FlashParams).glowColor ?? "rgba(240,143,32,0.24)";
      const glowSize = (params as FlashParams).glowSize ?? 120;
      timeline.fromTo(root, { boxShadow: "0 0 0 rgba(0,0,0,0)" }, { boxShadow: `0 0 ${glowSize}px ${glowColor}`, duration: transition.durationMs / 2000, yoyo: true, repeat: 1 }, startAt);
      continue;
    }
    const liftY = (params as LiftParams).liftY ?? 18;
    timeline.fromTo(root, { y: liftY }, { y: 0, duration: transition.durationMs / 1000, ease: "power2.out" }, startAt);
  }
}

export function createMotionPlayer(
  adapter: MotionStageAdapter,
  composition: ResolvedMotionComposition,
  options?: MotionPlayerOptions,
): MotionPlayer {
  let loop = false;
  let playbackRate = 1;
  let isDestroyed = false;

  const getTransportState = (): MotionTransportState => {
    const currentTimeMs = clampTimeMs(timeline.time() * 1000, composition.durationMs);
    return {
      playing: !timeline.paused() && (loop || currentTimeMs < composition.durationMs),
      currentTimeMs,
      durationMs: composition.durationMs,
      loop,
      playbackRate,
    };
  };

  const timeline = gsap.timeline({
    paused: true,
    defaults: { ease: "power2.out" },
    repeat: 0,
    onUpdate: () => {
      const timeMs = timeline.time() * 1000;
      const active = activeCaptionAt(composition.captions, timeMs);
      adapter.captionElement.textContent = active?.text ?? "";
      adapter.captionElement.dataset["tone"] = active?.tone ?? "neutral";
      options?.onTimeUpdate?.(timeMs);
    },
    onComplete: () => {
      if (!loop) options?.onComplete?.();
    },
  });

  const layerStartMap = buildResolvedLayerStartMap(composition);
  const presets = composition.cuePresets ?? [];
  for (const layer of composition.layers) {
    addLayerTimeline(timeline, adapter, layer, layerStartMap.get(layer.id) ?? layer.startMs, presets);
  }
  addTransitionTimeline(timeline, adapter.stageRoot, composition);
  const resolvedAssets = applyAssets(adapter, composition);

  const player: MotionPlayer = {
    get destroyed() {
      return isDestroyed;
    },
    play() {
      if (isDestroyed) return;
      timeline.play();
    },
    pause() {
      if (isDestroyed) return;
      timeline.pause();
    },
    restart() {
      if (isDestroyed) return;
      timeline.restart();
    },
    seek(ms: number) {
      if (isDestroyed) return;
      timeline.time(clampTimeMs(ms, composition.durationMs) / 1000, false);
    },
    setPlaybackRate(rate: number) {
      if (isDestroyed) return;
      playbackRate = normalizePlaybackRate(rate);
      timeline.timeScale(playbackRate);
    },
    setLoop(nextLoop: boolean) {
      if (isDestroyed) return;
      loop = nextLoop;
      timeline.repeat(loop ? -1 : 0);
    },
    getTransportState() {
      return getTransportState();
    },
    progress() {
      return timeline.progress();
    },
    currentTimeMs() {
      return getTransportState().currentTimeMs;
    },
    durationMs() {
      return composition.durationMs;
    },
    snapshot() {
      const transport = getTransportState();
      return {
        transport,
        ...buildMotionDebugSnapshot(composition, transport.currentTimeMs, resolvedAssets),
      };
    },
    destroy() {
      if (isDestroyed) return;
      isDestroyed = true;
      timeline.kill();
      gsap.set(adapter.managedElements(), { clearProps: "all" });
      adapter.captionElement.textContent = "";
    },
  };

  return player;
}
