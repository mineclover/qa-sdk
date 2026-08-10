import type { ElementMetrics, PositionReport, RectCssPx, RelativePosition } from './types.js';

function toRect(rect: DOMRect | ClientRect): RectCssPx {
  return {
    x: rect.x,
    y: rect.y,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function documentRect(viewport: RectCssPx, view: Window): RectCssPx {
  const x = viewport.x + view.scrollX;
  const y = viewport.y + view.scrollY;
  return { ...viewport, x, y, top: viewport.top + view.scrollY, right: viewport.right + view.scrollX, bottom: viewport.bottom + view.scrollY, left: viewport.left + view.scrollX };
}

export function extractElementMetrics(element: Element): ElementMetrics {
  const view = element.ownerDocument.defaultView;
  if (!view) throw new Error('extractElementMetrics requires an element in a browsing context');
  const html = element as HTMLElement;
  const viewportRect = toRect(element.getBoundingClientRect());
  return {
    viewportRect,
    documentRect: documentRect(viewportRect, view),
    clientRects: Array.from(element.getClientRects(), toRect),
    offset: { width: html.offsetWidth ?? 0, height: html.offsetHeight ?? 0, top: html.offsetTop ?? 0, left: html.offsetLeft ?? 0 },
    client: { width: html.clientWidth ?? 0, height: html.clientHeight ?? 0, top: html.clientTop ?? 0, left: html.clientLeft ?? 0 },
    scroll: { width: html.scrollWidth ?? 0, height: html.scrollHeight ?? 0, top: html.scrollTop ?? 0, left: html.scrollLeft ?? 0 },
    devicePixelRatio: view.devicePixelRatio,
  };
}

function relation(target: RectCssPx, reference: RectCssPx, selector: string | null, kind: RelativePosition['reference']): RelativePosition {
  return {
    reference: kind,
    referenceSelector: selector,
    deltaCssPx: { x: target.left - reference.left, y: target.top - reference.top },
    edgeGapsCssPx: {
      leftToRight: target.left - reference.right,
      rightToLeft: reference.left - target.right,
      topToBottom: target.top - reference.bottom,
      bottomToTop: reference.top - target.bottom,
    },
  };
}

const NO_RELATION: RelativePosition = {
  reference: 'none',
  referenceSelector: null,
  deltaCssPx: null,
  edgeGapsCssPx: null,
};

export function extractPosition(
  element: Element,
  referenceElement: Element | null = null,
  referenceSelector: string | null = null,
): PositionReport {
  const metrics = extractElementMetrics(element);
  const html = element as HTMLElement;
  const offsetParent = html.offsetParent;
  return {
    viewport: metrics.viewportRect,
    document: metrics.documentRect,
    relativeToReference: referenceElement
      ? relation(metrics.viewportRect, extractElementMetrics(referenceElement).viewportRect, referenceSelector, 'element')
      : NO_RELATION,
    relativeToOffsetParent: offsetParent
      ? relation(metrics.viewportRect, extractElementMetrics(offsetParent).viewportRect, null, 'offset-parent')
      : NO_RELATION,
  };
}

export function observeElementMetrics(
  element: Element,
  onChange: (metrics: ElementMetrics, entry: ResizeObserverEntry) => void,
  options: ResizeObserverOptions = {},
): ResizeObserver {
  const view = element.ownerDocument.defaultView;
  if (!view?.ResizeObserver) throw new Error('ResizeObserver is not available in this browsing context');
  const observer = new view.ResizeObserver((entries) => {
    for (const entry of entries) onChange(extractElementMetrics(entry.target), entry);
  });
  observer.observe(element, options);
  return observer;
}
