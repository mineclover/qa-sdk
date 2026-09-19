/** A viewport or synthetic-test point expressed in CSS pixels. */
export interface ViewportPointCssPx {
  readonly x: number;
  readonly y: number;
}

/** The DOM-independent rectangle shape needed for comparison measurement. */
export interface LayoutRectCssPx {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

export interface RulerMeasurement {
  readonly start: ViewportPointCssPx;
  readonly end: ViewportPointCssPx;
  readonly width: number;
  readonly height: number;
  readonly distance: number;
  /** Clockwise from the viewport's positive horizontal axis. */
  readonly angle: number;
}

export interface RulerGuides {
  readonly vertical: readonly number[];
  readonly horizontal: readonly number[];
}

export type LayoutBoxRole = 'reference' | 'target';
export type LayoutEdge = 'left' | 'right' | 'top' | 'bottom';

/** A positive empty space between two rects whose projection overlaps on the other axis. */
export interface LayoutGapMeasurement {
  readonly axis: 'horizontal' | 'vertical';
  readonly cssPx: number;
  readonly start: number;
  readonly end: number;
  readonly crossAxisCenter: number;
  readonly from: Readonly<{ readonly box: LayoutBoxRole; readonly edge: LayoutEdge }>;
  readonly to: Readonly<{ readonly box: LayoutBoxRole; readonly edge: LayoutEdge }>;
}

export interface ElementComparisonMeasurement {
  readonly deltaCssPx: Readonly<{ readonly x: number; readonly y: number }>;
  readonly cornerDeltasCssPx: Readonly<{
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
  }>;
  /** Directional edge values retain overlap as negative CSS pixels. */
  readonly directionalEdgeGapsCssPx: Readonly<{
    readonly referenceRightToTargetLeft: number;
    readonly referenceBottomToTargetTop: number;
  }>;
  readonly gaps: readonly LayoutGapMeasurement[];
}

/** Framework-neutral tolerance result for browser tests, visual QA, or custom assertion adapters. */
export interface CssPixelExpectation {
  readonly expected: number;
  readonly toleranceCssPx?: number;
}

export interface CssPixelMatch {
  readonly actual: number;
  readonly expected: number;
  readonly toleranceCssPx: number;
  readonly differenceCssPx: number;
  readonly pass: boolean;
}

/** Measures a free-drag Ruler without reading the DOM or browser global state. */
export function measureRuler(start: ViewportPointCssPx, end: ViewportPointCssPx): RulerMeasurement {
  const width = round(Math.abs(end.x - start.x));
  const height = round(Math.abs(end.y - start.y));
  return {
    start,
    end,
    width,
    height,
    distance: round(Math.hypot(width, height)),
    angle: round(Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI)),
  };
}

/** Produces the four viewport-fixed edge guides for exactly one completed Ruler. */
export function rulerGuides(ruler: Pick<RulerMeasurement, 'start' | 'end'>): RulerGuides {
  return {
    vertical: uniqueSorted([ruler.start.x, ruler.end.x]),
    horizontal: uniqueSorted([ruler.start.y, ruler.end.y]),
  };
}

/**
 * Compares two rendered or synthetic rectangles. Values remain signed for corresponding
 * corners; only disjoint edge-to-edge space becomes a positive gap measurement.
 */
export function measureElementComparison(
  reference: LayoutRectCssPx,
  target: LayoutRectCssPx,
): ElementComparisonMeasurement {
  const verticalOverlapStart = Math.max(reference.top, target.top);
  const verticalOverlapEnd = Math.min(reference.bottom, target.bottom);
  const horizontalOverlapStart = Math.max(reference.left, target.left);
  const horizontalOverlapEnd = Math.min(reference.right, target.right);
  const gaps: LayoutGapMeasurement[] = [];

  if (verticalOverlapStart < verticalOverlapEnd) {
    const crossAxisCenter = (verticalOverlapStart + verticalOverlapEnd) / 2;
    if (reference.right < target.left)
      gaps.push({
        axis: 'horizontal',
        cssPx: round(target.left - reference.right),
        start: reference.right,
        end: target.left,
        crossAxisCenter,
        from: { box: 'reference', edge: 'right' },
        to: { box: 'target', edge: 'left' },
      });
    else if (target.right < reference.left)
      gaps.push({
        axis: 'horizontal',
        cssPx: round(reference.left - target.right),
        start: target.right,
        end: reference.left,
        crossAxisCenter,
        from: { box: 'target', edge: 'right' },
        to: { box: 'reference', edge: 'left' },
      });
  }
  if (horizontalOverlapStart < horizontalOverlapEnd) {
    const crossAxisCenter = (horizontalOverlapStart + horizontalOverlapEnd) / 2;
    if (reference.bottom < target.top)
      gaps.push({
        axis: 'vertical',
        cssPx: round(target.top - reference.bottom),
        start: reference.bottom,
        end: target.top,
        crossAxisCenter,
        from: { box: 'reference', edge: 'bottom' },
        to: { box: 'target', edge: 'top' },
      });
    else if (target.bottom < reference.top)
      gaps.push({
        axis: 'vertical',
        cssPx: round(reference.top - target.bottom),
        start: target.bottom,
        end: reference.top,
        crossAxisCenter,
        from: { box: 'target', edge: 'bottom' },
        to: { box: 'reference', edge: 'top' },
      });
  }
  return {
    deltaCssPx: { x: round(target.left - reference.left), y: round(target.top - reference.top) },
    cornerDeltasCssPx: {
      left: round(target.left - reference.left),
      right: round(target.right - reference.right),
      top: round(target.top - reference.top),
      bottom: round(target.bottom - reference.bottom),
    },
    directionalEdgeGapsCssPx: {
      referenceRightToTargetLeft: round(target.left - reference.right),
      referenceBottomToTargetTop: round(target.top - reference.bottom),
    },
    gaps,
  };
}

/** Matches a CSS pixel value without taking a dependency on Vitest, Playwright, or another assertion library. */
export function matchCssPixels(actual: number, expectation: CssPixelExpectation): CssPixelMatch {
  const toleranceCssPx = expectation.toleranceCssPx ?? 0;
  if (
    !Number.isFinite(actual) ||
    !Number.isFinite(expectation.expected) ||
    !Number.isFinite(toleranceCssPx) ||
    toleranceCssPx < 0
  ) {
    throw new Error('CSS pixel comparison requires finite values and a non-negative tolerance.');
  }
  const differenceCssPx = round(actual - expectation.expected);
  return {
    actual,
    expected: expectation.expected,
    toleranceCssPx,
    differenceCssPx,
    pass: Math.abs(differenceCssPx) <= toleranceCssPx,
  };
}

function uniqueSorted(values: readonly number[]): readonly number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
