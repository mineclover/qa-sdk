export { collectCssInfluences, splitSelectorList } from './css-influences.js';
export { extractComputedStyle } from './computed-style.js';
export { extractElementMetrics, extractPosition, observeElementMetrics } from './metrics.js';
export type * from './types.js';

import { collectCssInfluences } from './css-influences.js';
import { extractComputedStyle } from './computed-style.js';
import { extractElementMetrics, extractPosition } from './metrics.js';
import type { ElementLayoutInspection, InspectElementOptions } from './types.js';

/**
 * One content-script friendly call for a selected DOM element.
 * CSS provenance is intentionally reported separately from final computed values:
 * browsers do not expose a standards-based per-property cascade winner API.
 */
export function inspectElementLayout(
  element: Element,
  options: InspectElementOptions = {},
): ElementLayoutInspection {
  return {
    targetSelector: options.targetSelector ?? null,
    ...(options.includeCssInfluences === false ? {} : { cssInfluences: collectCssInfluences(element) }),
    computedStyle: extractComputedStyle(element, options.computedProperties, options.pseudoElement),
    metrics: extractElementMetrics(element),
    position: extractPosition(element, options.referenceElement, options.referenceSelector ?? null),
  };
}

/** Resolve a selector in the supplied document for extension message handlers. */
export function inspectSelectorLayout(
  selector: string,
  document: Document = globalThis.document,
  options: Omit<InspectElementOptions, 'referenceElement'> = {},
): ElementLayoutInspection {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`No element matched selector: ${selector}`);
  const referenceElement = options.referenceSelector ? document.querySelector(options.referenceSelector) : null;
  return inspectElementLayout(element, { ...options, targetSelector: selector, referenceElement });
}
