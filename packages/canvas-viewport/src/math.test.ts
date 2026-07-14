// @def.boundary canvas-viewport-spec
// @def.doc canvas-viewport-spec

import { describe, expect, it } from 'vitest';
import {
  createMinimapLayout,
  createTransformCenteredAtPoint,
  projectViewportFrame,
} from './math.js';

describe('canvas viewport math', () => {
  it('center transform uses viewport center', () => {
    const transform = createTransformCenteredAtPoint({
      point: { x: 400, y: 300 },
      scale: 2,
      viewportWidth: 1000,
      viewportHeight: 800,
    });

    expect(transform).toEqual({ x: -300, y: -200, k: 2 });
  });

  it('viewport frame uses viewport dimensions instead of content dimensions', () => {
    const layout = createMinimapLayout({
      width: 200,
      height: 120,
      contentWidth: 2000,
      contentHeight: 1000,
      padding: 10,
    });

    const frame = projectViewportFrame({ x: -250, y: -100, k: 2 }, layout, {
      width: 1000,
      height: 800,
    });

    expect(frame.width).toBeCloseTo(45);
    expect(frame.height).toBeCloseTo(36);
  });
});
