// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  collectCssInfluences,
  extractComputedStyle,
  extractElementMetrics,
  extractPosition,
  inspectCssDeclarations,
  inspectSelectorLayout,
  matchCssPixels,
  measureElementComparison,
  measureRuler,
  rulerGuides,
  splitSelectorList,
} from '../src/index.js';

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('browser-layout-inspector', () => {
  it('[contract:browser-layout-inspector.css-provenance.query.v1] separates every matching selector by stylesheet source', () => {
    document.head.innerHTML = `
      <style>.card, #not-target { color: red; } .shell > .card { padding: 12px; }</style>
      <style>@media screen { :is(.card, .fallback) { margin: 8px; } }</style>
    `;
    document.body.innerHTML =
      '<main class="shell"><article class="card" style="border-width: 2px"></article></main>';
    const target = document.querySelector('.card');
    if (!target) throw new Error('missing target');

    const report = collectCssInfluences(target);

    expect(report.matchedSelectors.map((match) => match.selector)).toEqual([
      '.card',
      '.shell > .card',
      ':is(.card, .fallback)',
    ]);
    expect(report.matchedSelectors[0]?.stylesheetLabel).toBe('inline-style-1');
    expect(report.matchedSelectors[0]?.declarations).toContainEqual({
      property: 'color',
      value: 'red',
      priority: '',
    });
    expect(report.inlineStyle).toContainEqual({
      property: 'border-top-width',
      value: '2px',
      priority: '',
    });
  });

  it('[contract:browser-layout-inspector.css-provenance.query.v1] keeps commas inside functional and attribute selectors intact', () => {
    expect(splitSelectorList(':is(.a, .b), [data-label="one,two"], .c')).toEqual([
      ':is(.a, .b)',
      '[data-label="one,two"]',
      '.c',
    ]);
  });

  it('[contract:browser-layout-inspector.computed-style.query.v1] extracts only final computed values requested by the caller', () => {
    document.body.innerHTML = '<article class="card" style="display: grid; gap: 12px"></article>';
    const target = document.querySelector('.card');
    if (!target) throw new Error('missing target');

    expect(extractComputedStyle(target, ['display', 'gap']).properties).toEqual({
      display: 'grid',
      gap: '12px',
    });
  });

  it('[contract:browser-layout-inspector.css-inspector.query.v1] separates individual source declarations from sorted final computed values', () => {
    document.head.innerHTML = '<style>.card { color: red; padding: 12px !important; }</style>';
    document.body.innerHTML =
      '<article class="card" style="border-width: 2px; color: blue"></article>';
    const target = document.querySelector('.card');
    if (!target) throw new Error('missing target');

    const inspector = inspectCssDeclarations(target);

    expect(inspector.sourceDeclarations).toContainEqual(
      expect.objectContaining({
        source: 'inline',
        stylesheetLabel: 'element.style',
        property: 'color',
        value: 'blue',
        selector: null,
      }),
    );
    expect(inspector.sourceDeclarations).toContainEqual(
      expect.objectContaining({
        source: 'author',
        selector: '.card',
        property: 'padding-top',
        value: '12px',
        priority: 'important',
      }),
    );
    const computedProperties = inspector.computedDeclarations.map(
      (declaration) => declaration.property,
    );
    expect(computedProperties).toEqual(
      computedProperties.slice().sort((left, right) => left.localeCompare(right)),
    );
    expect(inspector.computedDeclarations).toContainEqual(
      expect.objectContaining({ property: 'color', value: 'blue' }),
    );
  });

  it('[contract:browser-layout-inspector.geometry.query.v1] returns viewport, document, box, and reference-relative CSS pixel positions', () => {
    document.body.innerHTML = '<section id="reference"><article id="target"></article></section>';
    const reference = document.querySelector('#reference');
    const target = document.querySelector('#target');
    if (!reference || !target) throw new Error('missing fixture');
    setRect(reference, { x: 20, y: 30, width: 400, height: 300 });
    setRect(target, { x: 80, y: 95, width: 120, height: 40 });
    setBoxMetrics(target, {
      offsetWidth: 124,
      offsetHeight: 44,
      clientWidth: 120,
      clientHeight: 40,
      scrollWidth: 180,
      scrollHeight: 90,
    });
    Object.defineProperty(window, 'scrollX', { configurable: true, value: 10 });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 15 });

    const metrics = extractElementMetrics(target);
    const position = extractPosition(target, reference, '#reference');

    expect(metrics.viewportRect).toMatchObject({ x: 80, y: 95, width: 120, height: 40 });
    expect(metrics.documentRect).toMatchObject({ x: 90, y: 110, left: 90, top: 110 });
    expect(metrics.offset).toMatchObject({ width: 124, height: 44 });
    expect(metrics.scroll).toMatchObject({ width: 180, height: 90 });
    expect(position.relativeToReference).toMatchObject({
      reference: 'element',
      referenceSelector: '#reference',
      deltaCssPx: { x: 60, y: 65 },
      edgeGapsCssPx: { leftToRight: -340, topToBottom: -235 },
    });
  });

  it('[contract:browser-layout-inspector.measurement-core.query.v1] exposes DOM-free comparison, Ruler, guide, and tolerance helpers for browser tests', () => {
    const comparison = measureElementComparison(
      { left: 20, right: 120, top: 30, bottom: 130, width: 100, height: 100 },
      { left: 150, right: 210, top: 60, bottom: 110, width: 60, height: 50 },
    );
    expect(comparison).toMatchObject({
      deltaCssPx: { x: 130, y: 30 },
      cornerDeltasCssPx: { left: 130, right: 90, top: 30, bottom: -20 },
      directionalEdgeGapsCssPx: { referenceRightToTargetLeft: 30, referenceBottomToTargetTop: -70 },
      gaps: [
        expect.objectContaining({
          axis: 'horizontal',
          cssPx: 30,
          from: { box: 'reference', edge: 'right' },
          to: { box: 'target', edge: 'left' },
        }),
      ],
    });
    const ruler = measureRuler({ x: 3, y: 4 }, { x: 13, y: 28 });
    expect(ruler).toMatchObject({ width: 10, height: 24, distance: 26, angle: 67.38 });
    expect(rulerGuides(ruler)).toEqual({ vertical: [3, 13], horizontal: [4, 28] });
    expect(matchCssPixels(10.4, { expected: 10, toleranceCssPx: 0.5 })).toEqual({
      actual: 10.4,
      expected: 10,
      toleranceCssPx: 0.5,
      differenceCssPx: 0.4,
      pass: true,
    });
    expect(matchCssPixels(10.6, { expected: 10, toleranceCssPx: 0.5 }).pass).toBe(false);
  });

  it('[contract:browser-layout-inspector.selector.query.v1] resolves a target and produces all extension payload sections together', () => {
    document.body.innerHTML = '<article data-measure-id="card" style="width: 200px"></article>';
    const target = document.querySelector('[data-measure-id="card"]');
    if (!target) throw new Error('missing target');
    setRect(target, { x: 0, y: 0, width: 200, height: 40 });

    const inspection = inspectSelectorLayout('[data-measure-id="card"]', document, {
      computedProperties: ['width'],
    });

    expect(inspection.targetSelector).toBe('[data-measure-id="card"]');
    expect(inspection.cssInfluences).toBeDefined();
    expect(inspection.computedStyle.properties.width).toBe('200px');
    expect(inspection.metrics.viewportRect.width).toBe(200);
    expect(inspection.position.document.width).toBe(200);
  });
});

function setRect(
  element: Element,
  rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): void {
  const value = {
    x: rect.x,
    y: rect.y,
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
    toJSON: () => rect,
  };
  element.getBoundingClientRect = () => value as DOMRect;
  element.getClientRects = () => [value] as unknown as DOMRectList;
}

function setBoxMetrics(element: Element, metrics: Record<string, number>): void {
  for (const [name, value] of Object.entries(metrics)) {
    Object.defineProperty(element, name, { configurable: true, value });
  }
}
