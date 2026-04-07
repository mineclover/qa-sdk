export interface ViewTransformLike {
  x: number;
  y: number;
  k: number;
}

export interface CanvasViewportPreset {
  minimapWidth: number;
  minimapHeight: number;
  minimapPadding: number;
  minScale: number;
  maxScale: number;
  wheelZoomInFactor: number;
  wheelZoomOutFactor: number;
  fitPadding: number;
}

export interface MinimapLayout {
  width: number;
  height: number;
  padding: number;
  contentWidth: number;
  contentHeight: number;
  scale: number;
}

export interface MinimapViewportFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasPoint {
  x: number;
  y: number;
}

export const DEFAULT_CANVAS_VIEWPORT_PRESET: CanvasViewportPreset = {
  minimapWidth: 200,
  minimapHeight: 136,
  minimapPadding: 8,
  minScale: 0.45,
  maxScale: 2.2,
  wheelZoomInFactor: 1.1,
  wheelZoomOutFactor: 0.9,
  fitPadding: 24,
};

export function createMinimapLayout(options: {
  width: number;
  height: number;
  contentWidth: number;
  contentHeight: number;
  padding?: number;
}): MinimapLayout {
  const padding = options.padding ?? 10;
  const scale = Math.min(
    (options.width - padding * 2) / options.contentWidth,
    (options.height - padding * 2) / options.contentHeight,
  );

  return {
    width: options.width,
    height: options.height,
    padding,
    contentWidth: options.contentWidth,
    contentHeight: options.contentHeight,
    scale,
  };
}

export function fitTransformToViewport(options: {
  contentWidth: number;
  contentHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  padding?: number;
}): ViewTransformLike {
  const padding = options.padding ?? DEFAULT_CANVAS_VIEWPORT_PRESET.fitPadding;
  const safeViewportWidth = Math.max(options.viewportWidth - padding * 2, 1);
  const safeViewportHeight = Math.max(options.viewportHeight - padding * 2, 1);
  const scale = Math.min(
    safeViewportWidth / options.contentWidth,
    safeViewportHeight / options.contentHeight,
  );

  const x = (options.viewportWidth - options.contentWidth * scale) / 2;
  const y = (options.viewportHeight - options.contentHeight * scale) / 2;

  return { x, y, k: scale };
}

export function projectViewportFrame(
  transform: ViewTransformLike,
  layout: MinimapLayout,
  viewport: { width: number; height: number },
): MinimapViewportFrame {
  const visibleX = (-transform.x) / transform.k;
  const visibleY = (-transform.y) / transform.k;
  const visibleWidth = viewport.width / transform.k;
  const visibleHeight = viewport.height / transform.k;

  return {
    x: layout.padding + visibleX * layout.scale,
    y: layout.padding + visibleY * layout.scale,
    width: visibleWidth * layout.scale,
    height: visibleHeight * layout.scale,
  };
}

export function minimapPointToContentPoint(
  point: CanvasPoint,
  layout: MinimapLayout,
): CanvasPoint {
  return {
    x: (point.x - layout.padding) / layout.scale,
    y: (point.y - layout.padding) / layout.scale,
  };
}

export function createTransformCenteredAtPoint(options: {
  point: CanvasPoint;
  scale: number;
  viewportWidth: number;
  viewportHeight: number;
}): ViewTransformLike {
  return {
    x: options.viewportWidth / 2 - options.point.x * options.scale,
    y: options.viewportHeight / 2 - options.point.y * options.scale,
    k: options.scale,
  };
}

export function zoomTransformAtCanvasPoint(options: {
  point: CanvasPoint;
  transform: ViewTransformLike;
  nextScale: number;
}): ViewTransformLike {
  const contentX = (options.point.x - options.transform.x) / options.transform.k;
  const contentY = (options.point.y - options.transform.y) / options.transform.k;

  return {
    x: options.point.x - contentX * options.nextScale,
    y: options.point.y - contentY * options.nextScale,
    k: options.nextScale,
  };
}

export function clampScale(scale: number, preset: CanvasViewportPreset = DEFAULT_CANVAS_VIEWPORT_PRESET): number {
  return Math.min(preset.maxScale, Math.max(preset.minScale, scale));
}
