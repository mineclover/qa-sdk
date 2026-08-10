import type { ComputedStyleSnapshot } from './types.js';

export function extractComputedStyle(
  element: Element,
  properties?: readonly string[],
  pseudoElement: string | null = null,
): ComputedStyleSnapshot {
  const view = element.ownerDocument.defaultView;
  if (!view) throw new Error('extractComputedStyle requires an element in a browsing context');
  const computed = view.getComputedStyle(element, pseudoElement);
  const names = properties ? [...properties] : Array.from(computed);
  const snapshot: Record<string, string> = {};
  for (const property of names) snapshot[property] = computed.getPropertyValue(property).trim();
  return { pseudoElement, properties: snapshot };
}
