import {
  DEFAULT_CANVAS_VIEWPORT_PRESET,
  clampScale,
  createTransformCenteredAtPoint,
  fitTransformToViewport,
  type CanvasPoint,
  type CanvasViewportPreset,
  type ViewTransformLike,
  zoomTransformAtCanvasPoint,
} from "./math.js";
import { CANVAS_VIEWPORT_HUD_ACTION_ID, type CanvasViewportHudActionId } from "./hud.js";

export interface CanvasViewportController {
  fitView(): void;
  resetView(): void;
  zoomIn(): void;
  zoomOut(): void;
}

export interface CanvasViewportSession extends CanvasViewportController {
  getTransform(): ViewTransformLike;
  setTransform(transform: ViewTransformLike): void;
  zoomAtPoint(point: CanvasPoint, factor: number): void;
  centerOnPoint(point: CanvasPoint): void;
  panBy(delta: CanvasPoint): void;
}

export function createCanvasViewportSession(options: {
  getTransform: () => ViewTransformLike;
  setTransform: (transform: ViewTransformLike) => void;
  getContentSize: () => { width: number; height: number };
  getViewportSize: () => { width: number; height: number };
  preset?: CanvasViewportPreset;
}): CanvasViewportSession {
  const preset = options.preset ?? DEFAULT_CANVAS_VIEWPORT_PRESET;

  const fitView = () => {
    const content = options.getContentSize();
    const viewport = options.getViewportSize();
    options.setTransform(fitTransformToViewport({
      contentWidth: content.width,
      contentHeight: content.height,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      padding: preset.fitPadding,
    }));
  };

  const zoomAtPoint = (point: CanvasPoint, factor: number) => {
    const transform = options.getTransform();
    options.setTransform(zoomTransformAtCanvasPoint({
      point,
      transform,
      nextScale: clampScale(transform.k * factor, preset),
    }));
  };

  const session: CanvasViewportSession = {
    getTransform: options.getTransform,
    setTransform: options.setTransform,
    fitView,
    resetView() {
      fitView();
    },
    zoomIn() {
      const viewport = options.getViewportSize();
      zoomAtPoint({
        x: viewport.width / 2,
        y: viewport.height / 2,
      }, preset.wheelZoomInFactor);
    },
    zoomOut() {
      const viewport = options.getViewportSize();
      zoomAtPoint({
        x: viewport.width / 2,
        y: viewport.height / 2,
      }, preset.wheelZoomOutFactor);
    },
    zoomAtPoint,
    centerOnPoint(point: CanvasPoint) {
      const transform = options.getTransform();
      const content = options.getContentSize();
      options.setTransform(createTransformCenteredAtPoint({
        point,
        scale: transform.k,
        contentWidth: content.width,
        contentHeight: content.height,
      }));
    },
    panBy(delta: CanvasPoint) {
      const transform = options.getTransform();
      options.setTransform({
        x: transform.x + delta.x,
        y: transform.y + delta.y,
        k: transform.k,
      });
    },
  };

  return session;
}

export function applyViewportHudAction(
  controller: CanvasViewportController,
  actionId: CanvasViewportHudActionId,
): boolean {
  if (actionId === CANVAS_VIEWPORT_HUD_ACTION_ID.zoomIn) {
    controller.zoomIn();
    return true;
  }
  if (actionId === CANVAS_VIEWPORT_HUD_ACTION_ID.zoomOut) {
    controller.zoomOut();
    return true;
  }
  if (actionId === CANVAS_VIEWPORT_HUD_ACTION_ID.fitView) {
    controller.fitView();
    return true;
  }
  if (actionId === CANVAS_VIEWPORT_HUD_ACTION_ID.resetView) {
    controller.resetView();
    return true;
  }
  return false;
}
