import type {
  MotionCaptionCue,
  MotionCompositionDef,
  MotionEditorCommand,
  MotionEditorSelection,
  MotionEditorState,
  MotionItemKind,
  MotionTransitionDef,
} from "motion-content";
import { clamp, endMs, findTimeSpanById, resolveMotionTransitionWindow } from "motion-content";

/** 드래그 대상의 참조 */
interface TimelineItemRef {
  readonly kind: MotionItemKind;
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
  readonly selection: MotionEditorSelection;
  readonly dragState: MotionTimelineDragState | null;
}

type ResizableKind = Exclude<MotionEditorSelection["kind"], "composition">;

interface MotionTimelineBarOptions {
  readonly moveable: boolean;
  readonly resizeStart: boolean;
  readonly resizeEnd: boolean;
}

function timelineBar(
  id: string,
  label: string,
  startMs: number,
  durationMs: number,
  totalDurationMs: number,
  kind: ResizableKind,
  active: boolean,
  detail: string,
  options: MotionTimelineBarOptions,
): string {
  const start = (startMs / totalDurationMs) * 100;
  const width = (durationMs / totalDurationMs) * 100;
  return `
    <div class="mce-lane">
      <div class="mce-lane-label">${label}</div>
      <div class="mce-track">
        <div class="mce-bar ${active ? "is-active" : ""}" data-bar-kind="${kind}" data-bar-id="${id}" data-bar-moveable="${options.moveable ? "true" : "false"}" style="left:${start}%;width:${Math.max(width, 3)}%">
          ${options.resizeStart ? `<span class="mce-bar-handle" data-resize-start="${kind}:${id}">⋮</span>` : ""}
          <strong>${detail}</strong>
          ${options.resizeEnd ? `<span class="mce-bar-handle" data-resize-end="${kind}:${id}">⋮</span>` : ""}
        </div>
      </div>
    </div>
  `;
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
  kind: MotionItemKind,
  id: string,
  startMs: number,
  durationMs: number,
): MotionEditorCommand {
  return { type: "update-item-timing", itemKind: kind, itemId: id, startMs, durationMs };
}

export function renderMotionTimeline(state: MotionEditorState): string {
  return [
    ...state.composition.sequences.map((sequence) =>
      timelineBar(
        sequence.id,
        sequence.title,
        sequence.startMs,
        sequence.durationMs,
        state.transport.durationMs,
        "sequence",
        state.selection?.kind === "sequence" && state.selection.id === sequence.id,
        `${sequence.startMs} / ${sequence.durationMs}`,
        { moveable: true, resizeStart: true, resizeEnd: true },
      ),
    ),
    ...state.composition.transitions.map((transition) => {
      const window = resolveTransitionWindow(state.composition, transition);
      return timelineBar(
        transition.id,
        window.label,
        window.startMs,
        window.durationMs,
        state.transport.durationMs,
        "transition",
        state.selection?.kind === "transition" && state.selection.id === transition.id,
        window.detail,
        { moveable: false, resizeStart: true, resizeEnd: false },
      );
    }),
    ...state.composition.layers.map((layer) =>
      timelineBar(
        layer.id,
        layer.label,
        layer.startMs,
        layer.durationMs,
        state.transport.durationMs,
        "layer",
        state.selection?.kind === "layer" && state.selection.id === layer.id,
        `${layer.startMs} / ${layer.durationMs}`,
        { moveable: true, resizeStart: true, resizeEnd: true },
      ),
    ),
    ...state.composition.captions.map((caption: MotionCaptionCue) =>
      timelineBar(
        caption.id,
        "Caption",
        caption.startMs,
        caption.durationMs,
        state.transport.durationMs,
        "caption",
        state.selection?.kind === "caption" && state.selection.id === caption.id,
        `${caption.startMs} / ${caption.durationMs}`,
        { moveable: true, resizeStart: true, resizeEnd: true },
      ),
    ),
  ].join("");
}

export function beginMotionTimelineDrag(
  state: MotionEditorState,
  target: HTMLElement,
  clientX: number,
): MotionTimelineStartResult | null {
  const bar = target.closest<HTMLElement>("[data-bar-id]");
  if (!bar) return null;

  const kind = bar.dataset["barKind"] as ResizableKind | undefined;
  const id = bar.dataset["barId"];
  if (!kind || !id) return null;

  const track = bar.closest<HTMLElement>(".mce-track");
  if (!track) return null;

  const rect = track.getBoundingClientRect();
  const anchorMs = timeFromPointer(clientX, rect.left, rect.width, state.transport.durationMs);
  const resizeStart = target.closest<HTMLElement>("[data-resize-start]");
  const resizeEnd = target.closest<HTMLElement>("[data-resize-end]");
  const moveable = bar.dataset["barMoveable"] === "true";
  const selection: MotionEditorSelection = { kind, id };

  // transition은 별도 처리 (move 불가, resize-start만 가능)
  if (kind === "transition") {
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
