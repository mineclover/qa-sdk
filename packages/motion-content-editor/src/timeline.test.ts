import { describe, expect, it } from "vitest";
import {
  createMotionEditorSession,
  createPromoGridComposition,
  migrateCompositionV1toV2,
  type MotionItemKind,
} from "motion-content";
import {
  beginMotionTimelineDrag,
  renderMotionTimeline,
  type MotionTimelineDragState,
  updateMotionTimelineDrag,
} from "./timeline.js";

// 공통 트랙 파라미터: 0~1000px 범위, totalDuration 6600ms
const TRACK = { trackLeft: 0, trackWidth: 1000, totalDurationMs: 6600 } as const;

function moveDrag(kind: MotionItemKind, originalStartMs: number, spanMs: number): MotionTimelineDragState {
  return {
    operation: "move",
    target: { kind, id: `${kind}-1` },
    anchorMs: originalStartMs,
    originalStartMs,
    spanMs,
    ...TRACK,
  };
}

function resizeStartDrag(kind: MotionItemKind, originalStartMs: number, originalEndMs: number): MotionTimelineDragState {
  return {
    operation: "resize-start",
    target: { kind, id: `${kind}-1` },
    anchorMs: originalStartMs,
    originalStartMs,
    originalEndMs,
    minDurationMs: 120,
    ...TRACK,
  };
}

function resizeEndDrag(kind: MotionItemKind, originalStartMs: number, originalEndMs: number): MotionTimelineDragState {
  return {
    operation: "resize-end",
    target: { kind, id: `${kind}-1` },
    anchorMs: originalEndMs,
    originalStartMs,
    originalEndMs,
    minDurationMs: 120,
    ...TRACK,
  };
}

function clientXForMs(ms: number): number {
  return (ms / TRACK.totalDurationMs) * TRACK.trackWidth + TRACK.trackLeft;
}

function createOverlappingSceneComposition() {
  const base = migrateCompositionV1toV2(createPromoGridComposition("lift"));
  const mainScene = base.scenes[0]!;

  return {
    ...base,
    scenes: [
      {
        ...mainScene,
        id: "scene-a",
        title: "Scene A",
        startMs: 0,
        durationMs: 3200,
      },
      {
        ...mainScene,
        id: "scene-b",
        title: "Scene B",
        startMs: 1800,
        durationMs: 2600,
        sequences: mainScene.sequences.map((sequence) =>
          Object.assign({}, sequence, { id: `scene-b-${sequence.id}` }),
        ),
        captions: mainScene.captions.map((caption) =>
          Object.assign({}, caption, { id: `scene-b-${caption.id}` }),
        ),
      },
    ],
  };
}

describe("updateMotionTimelineDrag", () => {
  const kinds: MotionItemKind[] = ["layer", "sequence", "caption"];

  for (const kind of kinds) {
    describe(`move ${kind}`, () => {
      it("moves item by delta", () => {
        const drag = moveDrag(kind, 1000, 500);
        const cmd = updateMotionTimelineDrag(drag, clientXForMs(1200));

        expect(cmd.type).toBe("update-item-timing");
        if (cmd.type === "update-item-timing") {
          expect(cmd.itemKind).toBe(kind);
          expect(cmd.startMs).toBe(1200);
          expect(cmd.durationMs).toBe(500);
        }
      });

      it("clamps move to not exceed composition end", () => {
        const drag = moveDrag(kind, 6000, 500);
        const cmd = updateMotionTimelineDrag(drag, clientXForMs(6500));

        if (cmd.type === "update-item-timing") {
          expect(cmd.startMs + cmd.durationMs).toBeLessThanOrEqual(TRACK.totalDurationMs);
        }
      });

      it("clamps move to not go below 0", () => {
        const drag = moveDrag(kind, 200, 500);
        const cmd = updateMotionTimelineDrag(drag, clientXForMs(-100));

        if (cmd.type === "update-item-timing") {
          expect(cmd.startMs).toBeGreaterThanOrEqual(0);
        }
      });
    });

    describe(`resize-start ${kind}`, () => {
      it("contracts window from start", () => {
        const drag = resizeStartDrag(kind, 1000, 2000);
        const cmd = updateMotionTimelineDrag(drag, clientXForMs(1300));

        if (cmd.type === "update-item-timing") {
          expect(cmd.startMs).toBe(1300);
          expect(cmd.durationMs).toBe(2000 - 1300);
        }
      });

      it("enforces minimum duration", () => {
        const drag = resizeStartDrag(kind, 1000, 2000);
        // startMs를 endMs 근처로 이동 — minDuration 120 강제
        const cmd = updateMotionTimelineDrag(drag, clientXForMs(1950));

        if (cmd.type === "update-item-timing") {
          expect(cmd.durationMs).toBeGreaterThanOrEqual(120);
        }
      });
    });

    describe(`resize-end ${kind}`, () => {
      it("extends window from end", () => {
        const drag = resizeEndDrag(kind, 1000, 2000);
        const cmd = updateMotionTimelineDrag(drag, clientXForMs(2500));

        if (cmd.type === "update-item-timing") {
          expect(cmd.startMs).toBe(1000);
          expect(cmd.durationMs).toBe(2500 - 1000);
        }
      });

      it("clamps end to composition duration", () => {
        const drag = resizeEndDrag(kind, 5000, 6000);
        const cmd = updateMotionTimelineDrag(drag, clientXForMs(7000));

        if (cmd.type === "update-item-timing") {
          expect(cmd.startMs + cmd.durationMs).toBeLessThanOrEqual(TRACK.totalDurationMs);
        }
      });

      it("enforces minimum duration on shrink", () => {
        const drag = resizeEndDrag(kind, 1000, 2000);
        const cmd = updateMotionTimelineDrag(drag, clientXForMs(1050));

        if (cmd.type === "update-item-timing") {
          expect(cmd.durationMs).toBeGreaterThanOrEqual(120);
        }
      });
    });
  }

  describe("resize-transition", () => {
    it("adjusts transition duration by drag delta", () => {
      const drag: MotionTimelineDragState = {
        operation: "resize-transition",
        id: "tr-1",
        anchorMs: 1700,
        originalDurationMs: 360,
        minDurationMs: 60,
        maxDurationMs: 1700,
        ...TRACK,
      };
      // 왼쪽으로 드래그 (anchorMs보다 작은 clientX) → duration 증가
      const cmd = updateMotionTimelineDrag(drag, clientXForMs(1500));

      expect(cmd.type).toBe("update-transition-duration");
      if (cmd.type === "update-transition-duration") {
        expect(cmd.durationMs).toBe(360 + 200);
      }
    });

    it("clamps transition duration to min/max", () => {
      const drag: MotionTimelineDragState = {
        operation: "resize-transition",
        id: "tr-1",
        anchorMs: 1700,
        originalDurationMs: 360,
        minDurationMs: 60,
        maxDurationMs: 500,
        ...TRACK,
      };
      // 극단적으로 왼쪽 드래그 → maxDurationMs에 clamp
      const cmd = updateMotionTimelineDrag(drag, clientXForMs(0));

      if (cmd.type === "update-transition-duration") {
        expect(cmd.durationMs).toBeLessThanOrEqual(500);
        expect(cmd.durationMs).toBeGreaterThanOrEqual(60);
      }
    });
  });

  describe("scene drag", () => {
    it("moves a scene with scene timing command", () => {
      const drag: MotionTimelineDragState = {
        operation: "move",
        target: { kind: "scene", id: "scene-a" },
        anchorMs: 1000,
        originalStartMs: 1000,
        spanMs: 1200,
        ...TRACK,
      };

      const cmd = updateMotionTimelineDrag(drag, clientXForMs(1500));

      expect(cmd).toEqual({
        type: "update-scene-timing",
        sceneId: "scene-a",
        startMs: 1500,
        durationMs: 1200,
      });
    });

    it("resizes a scene end with scene timing command", () => {
      const drag: MotionTimelineDragState = {
        operation: "resize-end",
        target: { kind: "scene", id: "scene-a" },
        anchorMs: 2200,
        originalStartMs: 1000,
        originalEndMs: 2200,
        minDurationMs: 120,
        ...TRACK,
      };

      const cmd = updateMotionTimelineDrag(drag, clientXForMs(2600));

      expect(cmd).toEqual({
        type: "update-scene-timing",
        sceneId: "scene-a",
        startMs: 1000,
        durationMs: 1600,
      });
    });
  });
});

describe("renderMotionTimeline", () => {
  it("renders a ruler and full-height playhead for the bottom timeline", () => {
    const session = createMotionEditorSession(createPromoGridComposition("lift"));
    const state = {
      ...session.present,
      transport: {
        ...session.present.transport,
        currentTimeMs: 1800,
      },
    };
    const markup = renderMotionTimeline(state);
    const host = document.createElement("div");
    host.innerHTML = markup;

    const ruler = host.querySelector<HTMLElement>('[data-timeline-ruler="true"]');
    const ticks = host.querySelectorAll<HTMLElement>("[data-ruler-tick]");
    const playhead = host.querySelector<HTMLElement>('[data-timeline-playhead="true"]');
    const introBar = host.querySelector<HTMLElement>('[data-bar-kind="sequence"][data-bar-id="intro"]');

    expect(ruler).toBeTruthy();
    expect(ticks.length).toBeGreaterThan(2);
    expect(playhead).toBeTruthy();
    expect(playhead?.getAttribute("style")).toContain("var(--mce-timeline-playhead-ratio)");
    expect(introBar).toBeTruthy();
  });

  it("renders stacked scene tracks for overlapping scene compositions", () => {
    const session = createMotionEditorSession(createOverlappingSceneComposition());
    const markup = renderMotionTimeline(session.present);
    const host = document.createElement("div");
    host.innerHTML = markup;

    const sceneTracks = host.querySelectorAll<HTMLElement>('[data-track-kind="scene"]');
    const sceneBars = host.querySelectorAll<HTMLElement>('[data-bar-kind="scene"]');

    expect(sceneTracks.length).toBe(2);
    expect(sceneBars.length).toBe(2);
    expect(sceneBars[0]?.textContent).toContain("Scene A");
    expect(sceneBars[1]?.textContent).toContain("Scene B");
  });

  it("selects a scene when a scene bar drag starts", () => {
    const session = createMotionEditorSession(createOverlappingSceneComposition());
    const host = document.createElement("div");
    host.innerHTML = renderMotionTimeline(session.present);

    const sceneTrack = host.querySelector<HTMLElement>('[data-track-kind="scene"]')!;
    const sceneBar = host.querySelector<HTMLElement>('[data-bar-kind="scene"][data-bar-id="scene-a"]')!;

    Object.defineProperty(sceneTrack, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 1000,
        bottom: 24,
        width: 1000,
        height: 24,
        toJSON: () => null,
      }),
    });

    const start = beginMotionTimelineDrag(session.present, sceneBar, clientXForMs(400));

    expect(start?.selection).toEqual({ kind: "scene", id: "scene-a" });
    expect(start?.dragState?.operation).toBe("move");
  });
});
