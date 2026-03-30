import type {
  MotionCaptionCue,
  MotionCompositionDef,
  MotionCompositionDefV2,
  MotionEditorCommand,
  MotionEditorSelectionV2,
  MotionEditorState,
  MotionItemKind,
  MotionSceneDef,
  MotionTransitionDef,
  ResolvedMotionCompositionSchema,
  ResolvedMotionCompositionV2,
} from "motion-content";
import { clamp, endMs, findTimeSpanById, resolveMotionTransitionWindow } from "motion-content";
import {
  renderScenePresenceBadges,
  type MotionEditorScenePresenceEntry,
} from "./scene-presence.js";

/** 드래그 대상의 참조 */
interface TimelineItemRef {
  readonly kind: MotionItemKind | "scene";
  readonly id: string;
}

export type MotionTimelineDragState =
  | {
      readonly operation: "move";
      readonly target: TimelineItemRef;
      readonly anchorMs: number;
      readonly originalStartMs: number;
      readonly spanMs: number;
      readonly trackLeft: number;
      readonly trackWidth: number;
      readonly totalDurationMs: number;
    }
  | {
      readonly operation: "resize-start" | "resize-end";
      readonly target: TimelineItemRef;
      readonly anchorMs: number;
      readonly originalStartMs: number;
      readonly originalEndMs: number;
      readonly minDurationMs: number;
      readonly trackLeft: number;
      readonly trackWidth: number;
      readonly totalDurationMs: number;
    }
  | {
      readonly operation: "resize-transition";
      readonly id: string;
      readonly anchorMs: number;
      readonly originalDurationMs: number;
      readonly minDurationMs: number;
      readonly maxDurationMs: number;
      readonly trackLeft: number;
      readonly trackWidth: number;
      readonly totalDurationMs: number;
    };

interface MotionTimelineStartResult {
  readonly selection: MotionEditorSelectionV2;
  readonly dragState: MotionTimelineDragState | null;
}

type TimelineBarKind = MotionItemKind | "scene" | "transition";
type _ResizableKind = Exclude<TimelineBarKind, "transition">;

interface MotionTimelineBarOptions {
  readonly moveable: boolean;
  readonly resizeStart: boolean;
  readonly resizeEnd: boolean;
  readonly sceneLane?: number;
  readonly stackedScene?: boolean;
  readonly locked?: boolean;
  readonly presenceHtml?: string;
}

interface MotionTimelineRenderOptions {
  readonly scenePresence?: ReadonlyMap<string, MotionEditorScenePresenceEntry>;
}

function timeFromPointer(
  clientX: number,
  trackLeft: number,
  trackWidth: number,
  durationMs: number,
): number {
  const ratio = Math.max(0, Math.min(1, (clientX - trackLeft) / trackWidth));
  return Math.round(ratio * durationMs);
}

function resolveTransitionWindow(
  composition: MotionCompositionDef,
  transition: MotionTransitionDef,
): { readonly label: string; readonly startMs: number; readonly durationMs: number; readonly detail: string; readonly maxDurationMs: number } {
  const fromSequence = composition.sequences.find((sequence) => sequence.id === transition.fromSequenceId);
  const toSequence = composition.sequences.find((sequence) => sequence.id === transition.toSequenceId);
  const window = resolveMotionTransitionWindow(composition, transition);
  return {
    label: `${fromSequence?.title ?? transition.fromSequenceId}→${toSequence?.title ?? transition.toSequenceId}`,
    startMs: window.startMs,
    durationMs: window.durationMs,
    detail: `${transition.style} / ${window.durationMs}`,
    maxDurationMs: window.maxDurationMs,
  };
}

function isSceneComposition(
  composition: MotionCompositionDef | MotionCompositionDefV2 | ResolvedMotionCompositionSchema,
): composition is MotionCompositionDefV2 | ResolvedMotionCompositionV2 {
  return "targets" in composition && "scenes" in composition;
}

function clampWindowStart(
  originalEndMs: number,
  nextStartMs: number,
  minDurationMs: number,
): number {
  return clamp(nextStartMs, 0, Math.max(0, originalEndMs - minDurationMs));
}

function clampWindowEnd(
  originalStartMs: number,
  nextEndMs: number,
  minDurationMs: number,
  durationMs: number,
): number {
  return clamp(nextEndMs, originalStartMs + minDurationMs, durationMs);
}

function clampWindowMove(
  originalStartMs: number,
  deltaMs: number,
  spanMs: number,
  durationMs: number,
): number {
  return clamp(originalStartMs + deltaMs, 0, Math.max(0, durationMs - spanMs));
}

/** kind + id → 통합 타임라인 커맨드 */
function makeTimingCommand(
  kind: MotionItemKind | "scene",
  id: string,
  startMs: number,
  durationMs: number,
): MotionEditorCommand {
  return kind === "scene"
    ? { type: "update-scene-timing", sceneId: id, startMs, durationMs }
    : { type: "update-item-timing", itemKind: kind, itemId: id, startMs, durationMs };
}

interface MotionTimelineTick {
  readonly timeMs: number;
  readonly edge: "start" | "middle" | "end";
  readonly major: boolean;
}

function formatTimelineTickLabel(timeMs: number): string {
  const totalSeconds = timeMs / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    const wholeSeconds = Math.floor(seconds);
    const tenths = Math.round((seconds - wholeSeconds) * 10);
    return tenths === 0
      ? `${minutes}:${String(wholeSeconds).padStart(2, "0")}`
      : `${minutes}:${String(wholeSeconds).padStart(2, "0")}.${tenths}`;
  }

  const rounded = Number.isInteger(totalSeconds)
    ? totalSeconds.toFixed(0)
    : totalSeconds.toFixed(totalSeconds >= 10 ? 1 : 2).replace(/0+$/, "").replace(/\.$/, "");
  return `${rounded}s`;
}

function chooseTimelineTickStep(totalDurationMs: number): number {
  const candidates = [250, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000];
  for (const candidate of candidates) {
    if (totalDurationMs / candidate <= 10) {
      return candidate;
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- candidates 배열이 비어있지 않음
  return candidates[candidates.length - 1]!;
}

function buildTimelineTicks(totalDurationMs: number): MotionTimelineTick[] {
  const clampedDurationMs = Math.max(totalDurationMs, 1);
  const step = chooseTimelineTickStep(clampedDurationMs);
  const ticks: MotionTimelineTick[] = [];

  for (let timeMs = 0; timeMs <= clampedDurationMs; timeMs += step) {
    ticks.push({
      timeMs,
      edge: timeMs === 0 ? "start" : "middle",
      major: timeMs === 0 || timeMs % (step * 2) === 0,
    });
  }

  if (ticks[ticks.length - 1]?.timeMs !== clampedDurationMs) {
    ticks.push({
      timeMs: clampedDurationMs,
      edge: "end",
      major: true,
    });
  } else if (ticks.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- ticks.length > 0 검사 직후
    const lastTick = ticks[ticks.length - 1]!;
    ticks[ticks.length - 1] = {
      ...lastTick,
      edge: lastTick.timeMs === 0 ? "start" : "end",
      major: true,
    };
  }

  return ticks;
}

function renderTimelineRuler(totalDurationMs: number): string {
  const safeDurationMs = Math.max(totalDurationMs, 1);
  return `
    <div class="mce-timeline-ruler" data-timeline-ruler="true" aria-hidden="true">
      ${buildTimelineTicks(safeDurationMs)
        .map((tick) => {
          const left = (tick.timeMs / safeDurationMs) * 100;
          return `
            <div
              class="mce-ruler-tick"
              data-ruler-tick="${tick.major ? "major" : "minor"}"
              data-ruler-edge="${tick.edge}"
              style="left:${left}%"
            >
              <span class="mce-ruler-tick-label">${formatTimelineTickLabel(tick.timeMs)}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderTimelineBar(
  id: string,
  startMs: number,
  durationMs: number,
  totalDurationMs: number,
  kind: TimelineBarKind,
  active: boolean,
  detail: string,
  options: MotionTimelineBarOptions,
): string {
  const safeDurationMs = Math.max(totalDurationMs, 1);
  const start = (startMs / safeDurationMs) * 100;
  const width = (durationMs / safeDurationMs) * 100;

  return `
    <div
      class="mce-bar ${active ? "is-active" : ""}"
      data-bar-kind="${kind}"
      data-bar-id="${id}"
      data-bar-moveable="${options.moveable ? "true" : "false"}"
      data-scene-lane="${options.sceneLane ?? 0}"
      data-scene-stacked="${options.stackedScene ? "true" : "false"}"
      data-scene-locked="${options.locked ? "true" : "false"}"
      style="left:${start}%;width:${Math.max(width, 3)}%"
    >
      ${options.resizeStart ? `<span class="mce-bar-handle" data-resize-start="${kind}:${id}">⋮</span>` : ""}
      <strong>${detail}</strong>
      ${options.presenceHtml ? `<span class="mce-bar-presence">${options.presenceHtml}</span>` : ""}
      ${options.resizeEnd ? `<span class="mce-bar-handle" data-resize-end="${kind}:${id}">⋮</span>` : ""}
    </div>
  `;
}

function renderTimelineTrack(
  label: string,
  kind: TimelineBarKind,
  bars: string,
): string {
  return `
    <div class="mce-lane-label" data-lane-kind="${kind}">${label}</div>
    <div class="mce-track" data-track-kind="${kind}">
      ${bars}
    </div>
  `;
}

function packSceneTracks(
  scenes: readonly MotionSceneDef[],
): readonly (readonly MotionSceneDef[])[] {
  const lanes: MotionSceneDef[][] = [];
  const laneEndMs: number[] = [];
  const orderedScenes = [...scenes].toSorted((left, right) =>
    left.startMs - right.startMs
    || right.durationMs - left.durationMs
    || left.id.localeCompare(right.id)
  );

  for (const scene of orderedScenes) {
    const sceneStartMs = scene.startMs;
    const laneIndex = laneEndMs.findIndex((laneEnd) => laneEnd <= sceneStartMs);
    if (laneIndex === -1) {
      lanes.push([scene]);
      laneEndMs.push(endMs(scene));
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- findIndex 결과 유효 인덱스
    lanes[laneIndex]!.push(scene);
    laneEndMs[laneIndex] = endMs(scene);
  }

  return lanes;
}

function renderSceneTracks(
  state: MotionEditorState<ResolvedMotionCompositionSchema>,
  totalDurationMs: number,
  scenePresence: ReadonlyMap<string, MotionEditorScenePresenceEntry>,
): string {
  if (!isSceneComposition(state.composition)) {
    return "";
  }

  const lanes = packSceneTracks(state.composition.scenes);
  return lanes
    .map((lane, laneIndex) =>
      renderTimelineTrack(
        laneIndex === 0 ? "Scenes" : "",
        "scene",
        lane.map((scene) =>
          renderTimelineBar(
            scene.id,
            scene.startMs,
            scene.durationMs,
            totalDurationMs,
            "scene",
            state.selection?.kind === "scene" && state.selection.id === scene.id,
            `${scene.title} · ${scene.startMs} / ${scene.durationMs}`,
            {
              moveable: true,
              resizeStart: true,
              resizeEnd: true,
              sceneLane: laneIndex,
              stackedScene: lanes.length > 1,
              locked: scenePresence.get(scene.id)?.locked,
              presenceHtml: renderScenePresenceBadges(scenePresence.get(scene.id), { compact: true }),
            },
          )
        ).join(""),
      ))
    .join("");
}

export function renderMotionTimeline(
  state: MotionEditorState<ResolvedMotionCompositionSchema>,
  options: MotionTimelineRenderOptions = {},
): string {
  const totalDurationMs = Math.max(state.transport.durationMs, 1);
  const playheadRatio = Math.max(0, Math.min(1, state.transport.currentTimeMs / totalDurationMs));
  const scenePresence = options.scenePresence ?? new Map<string, MotionEditorScenePresenceEntry>();
  const rows = [
    renderSceneTracks(state, totalDurationMs, scenePresence),
    ...(!isSceneComposition(state.composition)
      ? (() => {
          const composition = state.composition as MotionCompositionDef;
          return [
          ...composition.sequences.map((sequence) =>
            renderTimelineTrack(
              sequence.title,
              "sequence",
              renderTimelineBar(
                sequence.id,
                sequence.startMs,
                sequence.durationMs,
                totalDurationMs,
                "sequence",
                state.selection?.kind === "sequence" && state.selection.id === sequence.id,
                `${sequence.startMs} / ${sequence.durationMs}`,
                { moveable: true, resizeStart: true, resizeEnd: true },
              ),
            ),
          ),
          ...composition.transitions.map((transition) => {
            const window = resolveTransitionWindow(composition, transition);
            return renderTimelineTrack(
              window.label,
              "transition",
              renderTimelineBar(
                transition.id,
                window.startMs,
                window.durationMs,
                totalDurationMs,
                "transition",
                state.selection?.kind === "transition" && state.selection.id === transition.id,
                window.detail,
                { moveable: false, resizeStart: true, resizeEnd: false },
              ),
            );
          }),
          ...composition.layers.map((layer) =>
            renderTimelineTrack(
              layer.label,
              "layer",
              renderTimelineBar(
                layer.id,
                layer.startMs,
                layer.durationMs,
                totalDurationMs,
                "layer",
                state.selection?.kind === "layer" && state.selection.id === layer.id,
                `${layer.startMs} / ${layer.durationMs}`,
                { moveable: true, resizeStart: true, resizeEnd: true },
              ),
            ),
          ),
          ...composition.captions.map((caption: MotionCaptionCue) =>
            renderTimelineTrack(
              "Caption",
              "caption",
              renderTimelineBar(
                caption.id,
                caption.startMs,
                caption.durationMs,
                totalDurationMs,
                "caption",
                state.selection?.kind === "caption" && state.selection.id === caption.id,
                `${caption.startMs} / ${caption.durationMs}`,
                { moveable: true, resizeStart: true, resizeEnd: true },
              ),
            ),
          ),
        ];
      })()
      : []),
  ].join("");

  return `
    <div class="mce-timeline-surface" style="--mce-timeline-playhead-ratio:${playheadRatio}" data-timeline-surface="true">
      <div class="mce-timeline-grid">
        <div class="mce-timeline-ruler-label">Time</div>
        ${renderTimelineRuler(totalDurationMs)}
        ${rows}
      </div>
      <div class="mce-timeline-playhead" data-timeline-playhead="true" style="left:calc(var(--mce-timeline-label-width) + var(--mce-timeline-grid-gap) + ((100% - var(--mce-timeline-label-width) - var(--mce-timeline-grid-gap)) * var(--mce-timeline-playhead-ratio)))">
        <span class="mce-timeline-playhead__head"></span>
      </div>
    </div>
  `;
}

export function beginMotionTimelineDrag(
  state: MotionEditorState<ResolvedMotionCompositionSchema>,
  target: HTMLElement,
  clientX: number,
): MotionTimelineStartResult | null {
  const bar = target.closest<HTMLElement>("[data-bar-id]");
  if (!bar) return null;

  const kind = bar.dataset["barKind"] as TimelineBarKind | undefined;
  const id = bar.dataset["barId"];
  if (!kind || !id) return null;

  const track = bar.closest<HTMLElement>(".mce-track");
  if (!track) return null;

  const rect = track.getBoundingClientRect();
  const anchorMs = timeFromPointer(clientX, rect.left, rect.width, state.transport.durationMs);
  const resizeStart = target.closest<HTMLElement>("[data-resize-start]");
  const resizeEnd = target.closest<HTMLElement>("[data-resize-end]");
  const moveable = bar.dataset["barMoveable"] === "true";
  const selection: MotionEditorSelectionV2 = { kind, id } as MotionEditorSelectionV2;

  if (kind === "scene") {
    if (!isSceneComposition(state.composition)) return null;
    const scene = state.composition.scenes.find((entry) => entry.id === id);
    if (!scene) return null;

    const dragState: MotionTimelineDragState | null = resizeStart
      ? {
          operation: "resize-start",
          target: { kind: "scene", id },
          anchorMs,
          originalStartMs: scene.startMs,
          originalEndMs: endMs(scene),
          minDurationMs: 120,
          trackLeft: rect.left,
          trackWidth: rect.width,
          totalDurationMs: state.transport.durationMs,
        }
      : resizeEnd
        ? {
            operation: "resize-end",
            target: { kind: "scene", id },
            anchorMs,
            originalStartMs: scene.startMs,
            originalEndMs: endMs(scene),
            minDurationMs: 120,
            trackLeft: rect.left,
            trackWidth: rect.width,
            totalDurationMs: state.transport.durationMs,
          }
        : moveable
          ? {
              operation: "move",
              target: { kind: "scene", id },
              anchorMs,
              originalStartMs: scene.startMs,
              spanMs: scene.durationMs,
              trackLeft: rect.left,
              trackWidth: rect.width,
              totalDurationMs: state.transport.durationMs,
            }
          : null;

    return { selection, dragState };
  }

  // transition은 별도 처리 (move 불가, resize-start만 가능)
  if (kind === "transition") {
    if (isSceneComposition(state.composition)) {
      return null;
    }
    const transition = state.composition.transitions.find((entry) => entry.id === id);
    if (!transition) return null;
    const window = resolveTransitionWindow(state.composition, transition);
    return {
      selection,
      dragState: resizeStart
        ? {
            operation: "resize-transition",
            id,
            anchorMs,
            originalDurationMs: transition.durationMs,
            minDurationMs: 60,
            maxDurationMs: window.maxDurationMs,
            trackLeft: rect.left,
            trackWidth: rect.width,
            totalDurationMs: state.transport.durationMs,
          }
        : null,
    };
  }

  // layer / sequence / caption — 통합 경로
  if (isSceneComposition(state.composition)) {
    return null;
  }
  const itemKind = kind as MotionItemKind;
  const timing = findTimeSpanById(state.composition, itemKind, id);
  if (!timing) return null;

  const ref: TimelineItemRef = { kind: itemKind, id };
  const itemEndMs = endMs(timing);

  const dragState: MotionTimelineDragState | null = resizeStart
    ? {
        operation: "resize-start",
        target: ref,
        anchorMs,
        originalStartMs: timing.startMs,
        originalEndMs: itemEndMs,
        minDurationMs: 120,
        trackLeft: rect.left,
        trackWidth: rect.width,
        totalDurationMs: state.transport.durationMs,
      }
    : resizeEnd
      ? {
          operation: "resize-end",
          target: ref,
          anchorMs,
          originalStartMs: timing.startMs,
          originalEndMs: itemEndMs,
          minDurationMs: 120,
          trackLeft: rect.left,
          trackWidth: rect.width,
          totalDurationMs: state.transport.durationMs,
        }
      : moveable
        ? {
            operation: "move",
            target: ref,
            anchorMs,
            originalStartMs: timing.startMs,
            spanMs: timing.durationMs,
            trackLeft: rect.left,
            trackWidth: rect.width,
            totalDurationMs: state.transport.durationMs,
          }
        : null;

  return { selection, dragState };
}

export function updateMotionTimelineDrag(
  dragState: MotionTimelineDragState,
  clientX: number,
): MotionEditorCommand {
  const timeMs = timeFromPointer(
    clientX,
    dragState.trackLeft,
    dragState.trackWidth,
    dragState.totalDurationMs,
  );
  const deltaMs = timeMs - dragState.anchorMs;

  if (dragState.operation === "move") {
    const startMs = clampWindowMove(
      dragState.originalStartMs,
      deltaMs,
      dragState.spanMs,
      dragState.totalDurationMs,
    );
    return makeTimingCommand(dragState.target.kind, dragState.target.id, startMs, dragState.spanMs);
  }

  if (dragState.operation === "resize-start") {
    const nextStartMs = clampWindowStart(
      dragState.originalEndMs,
      dragState.originalStartMs + deltaMs,
      dragState.minDurationMs,
    );
    return makeTimingCommand(
      dragState.target.kind,
      dragState.target.id,
      nextStartMs,
      dragState.originalEndMs - nextStartMs,
    );
  }

  if (dragState.operation === "resize-end") {
    const nextEndMs = clampWindowEnd(
      dragState.originalStartMs,
      dragState.originalEndMs + deltaMs,
      dragState.minDurationMs,
      dragState.totalDurationMs,
    );
    return makeTimingCommand(
      dragState.target.kind,
      dragState.target.id,
      dragState.originalStartMs,
      nextEndMs - dragState.originalStartMs,
    );
  }

  if (dragState.operation === "resize-transition") {
    return {
      type: "update-transition-duration",
      transitionId: dragState.id,
      durationMs: clamp(
        dragState.originalDurationMs - deltaMs,
        dragState.minDurationMs,
        dragState.maxDurationMs,
      ),
    };
  }

  throw new Error(`Unknown motion timeline drag state: ${JSON.stringify(dragState)}`);
}
