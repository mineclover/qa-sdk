import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion-content", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion-content")>();

  return {
    ...actual,
    createMotionPlayer(
      adapter: import("motion-content").MotionStageAdapter,
      composition: import("motion-content").ResolvedMotionComposition,
    ): import("motion-content").MotionPlayer {
      const transport: import("motion-content").MotionTransportState = {
        playing: false,
        currentTimeMs: 0,
        durationMs: composition.durationMs,
        loop: false,
        playbackRate: 1,
      };

      const snapshot = () => ({
        ...actual.createMotionDebugSnapshot(
          composition,
          transport.currentTimeMs,
          actual.resolveMotionAssetSnapshots(composition),
        ),
        transport: { ...transport },
      });

      return {
        play() {
          transport.playing = true;
        },
        pause() {
          transport.playing = false;
        },
        restart() {
          transport.playing = true;
          transport.currentTimeMs = 0;
        },
        seek(ms) {
          transport.currentTimeMs = Math.max(0, Math.min(ms, composition.durationMs));
        },
        setPlaybackRate(playbackRate) {
          transport.playbackRate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
        },
        setLoop(loop) {
          transport.loop = loop;
        },
        getTransportState() {
          return { ...transport };
        },
        progress() {
          return composition.durationMs === 0 ? 0 : transport.currentTimeMs / composition.durationMs;
        },
        currentTimeMs() {
          return transport.currentTimeMs;
        },
        durationMs() {
          return composition.durationMs;
        },
        snapshot,
        destroy() {
          return;
        },
      };
    },
  };
});

import {
  createPromoGridComposition,
  serializeMotionComposition,
} from "motion-content";
import { createMotionEditorShell } from "./shell.js";

function installPointerCapturePolyfill(): void {
  const captures = new WeakMap<HTMLElement, Set<number>>();

  Object.defineProperties(HTMLElement.prototype, {
    setPointerCapture: {
      configurable: true,
      value(pointerId: number) {
        const current = captures.get(this) ?? new Set<number>();
        current.add(pointerId);
        captures.set(this, current);
      },
    },
    releasePointerCapture: {
      configurable: true,
      value(pointerId: number) {
        captures.get(this)?.delete(pointerId);
      },
    },
    hasPointerCapture: {
      configurable: true,
      value(pointerId: number) {
        return captures.get(this)?.has(pointerId) ?? false;
      },
    },
  });
}

function dispatchPointerEvent(
  target: EventTarget,
  type: string,
  pointerId: number,
  clientX: number,
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
  });
  Object.defineProperty(event, "pointerId", {
    configurable: true,
    value: pointerId,
  });
  target.dispatchEvent(event);
}

function stubTimelineGeometry(container: HTMLElement): void {
  for (const track of container.querySelectorAll<HTMLElement>(".mce-track")) {
    Object.defineProperty(track, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 660,
        bottom: 24,
        width: 660,
        height: 24,
        toJSON: () => null,
      }),
    });
  }
}

describe("motion editor shell", () => {
  let container: HTMLDivElement;
  let urlCreateObjectUrl: ReturnType<typeof vi.fn>;
  let urlRevokeObjectUrl: ReturnType<typeof vi.fn>;
  let anchorClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    installPointerCapturePolyfill();

    container = document.createElement("div");
    document.body.appendChild(container);

    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    urlCreateObjectUrl = vi.fn(() => "blob:motion-content");
    urlRevokeObjectUrl = vi.fn();
    anchorClick = vi.fn();

    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: urlCreateObjectUrl,
      revokeObjectURL: urlRevokeObjectUrl,
    });

    Object.defineProperty(HTMLAnchorElement.prototype, "click", {
      configurable: true,
      value: anchorClick,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    container.remove();
    document.body.innerHTML = "";
  });

  it("runs the shell command flow for undo redo download and composition apply", () => {
    const onStateChange = vi.fn();
    const shell = createMotionEditorShell({ container, onStateChange });

    const undoButton = container.querySelector<HTMLButtonElement>('[data-action="undo"]');
    const redoButton = container.querySelector<HTMLButtonElement>('[data-action="redo"]');
    const downloadButton = container.querySelector<HTMLButtonElement>('[data-action="download-json"]');
    const jsonPanel = container.querySelector<HTMLTextAreaElement>('[data-panel="json"]');
    const importButton = container.querySelector<HTMLButtonElement>('[data-action="import-json"]');
    const importDiagnosticsPanel = container.querySelector<HTMLElement>('[data-panel="import-diagnostics"]');

    expect(undoButton?.disabled).toBe(true);
    expect(redoButton?.disabled).toBe(true);

    shell.dispatch({
      type: "set-parameter",
      parameterId: "headline",
      value: "편집된 헤드라인",
    });

    expect(shell.getState().values["headline"]).toBe("편집된 헤드라인");
    expect(undoButton?.disabled).toBe(false);
    expect(redoButton?.disabled).toBe(true);

    undoButton!.click();
    expect(shell.getState().values["headline"]).toBe("GSAP Motion Canvas");
    expect(undoButton?.disabled).toBe(true);
    expect(redoButton?.disabled).toBe(false);

    redoButton!.click();
    expect(shell.getState().values["headline"]).toBe("편집된 헤드라인");

    downloadButton!.click();
    expect(urlCreateObjectUrl).toHaveBeenCalledTimes(1);
    expect(urlCreateObjectUrl.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(urlRevokeObjectUrl).toHaveBeenCalledWith("blob:motion-content");

    const importedComposition = {
      ...createPromoGridComposition("lift"),
      id: "imported-shell",
      title: "Imported Shell",
    };
    jsonPanel!.value = serializeMotionComposition(importedComposition);

    importButton!.click();

    expect(shell.getState().composition.id).toBe("imported-shell");
    expect(shell.getState().composition.title).toBe("Imported Shell");
    expect(undoButton?.disabled).toBe(true);
    expect(redoButton?.disabled).toBe(true);
    expect(importDiagnosticsPanel?.textContent).toContain("성공");
    expect(importDiagnosticsPanel?.textContent).toContain("schemaVersion 검증 및 composition import가 완료되었습니다.");
    expect(onStateChange).toHaveBeenCalled();

    shell.destroy();
  });

  it("keeps timeline drag preview separate from commit and undo history", () => {
    const shell = createMotionEditorShell({ container });
    stubTimelineGeometry(container);

    const timelinePanel = container.querySelector<HTMLElement>('[data-panel="timeline"]');
    const introBar = container.querySelector<HTMLElement>('[data-bar-kind="sequence"][data-bar-id="intro"]');
    const undoButton = container.querySelector<HTMLButtonElement>('[data-action="undo"]');

    expect(timelinePanel).toBeTruthy();
    expect(introBar).toBeTruthy();

    const initialSeq = shell.getState().composition.sequences.find((s) => s.id === "intro");
    expect(initialSeq?.startMs).toBe(0);
    expect(undoButton?.disabled).toBe(true);

    dispatchPointerEvent(introBar!, "pointerdown", 7, 12);
    dispatchPointerEvent(timelinePanel!, "pointermove", 7, 100);

    expect(shell.getState().selection).toEqual({ kind: "sequence", id: "intro" });
    // preview 상태: sequence가 이동됨
    const previewSeq = shell.getState().composition.sequences.find((s) => s.id === "intro");
    expect(previewSeq?.startMs).not.toBe(0);
    expect(undoButton?.disabled).toBe(true);

    dispatchPointerEvent(timelinePanel!, "pointerup", 7, 100);

    // commit 후 undo 가능
    expect(undoButton?.disabled).toBe(false);

    undoButton!.click();
    // undo 후 원래 위치로 복귀
    expect(shell.getState().composition.sequences.find((s) => s.id === "intro")?.startMs).toBe(0);

    shell.destroy();
  });

  it("surfaces file import parse errors in both diagnostics and inline error panels", async () => {
    const shell = createMotionEditorShell({ container });
    const fileInput = container.querySelector<HTMLInputElement>('[data-action="file-input"]');
    const jsonErrorPanel = container.querySelector<HTMLElement>('[data-panel="json-error"]');
    const importDiagnosticsPanel = container.querySelector<HTMLElement>('[data-panel="import-diagnostics"]');

    expect(fileInput).toBeTruthy();

    Object.defineProperty(fileInput!, "files", {
      configurable: true,
      value: [
        {
          text: vi.fn().mockResolvedValue("{ invalid json"),
        },
      ],
    });

    fileInput!.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => {
      expect(importDiagnosticsPanel?.textContent).toContain("실패");
    });

    expect(importDiagnosticsPanel?.textContent).toContain("실패");
    expect(importDiagnosticsPanel?.textContent).toContain("파일 업로드");
    expect(importDiagnosticsPanel?.textContent).toContain("JSON 파싱에 실패했습니다.");
    expect(jsonErrorPanel?.textContent).toContain("JSON 파싱에 실패했습니다.");
    expect(jsonErrorPanel?.classList.contains("is-visible")).toBe(true);

    shell.destroy();
  });
});
