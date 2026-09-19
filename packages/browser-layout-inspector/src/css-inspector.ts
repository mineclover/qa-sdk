import { extractComputedStyle } from './computed-style.js';
import { collectCssInfluences } from './css-influences.js';
import type { CssInspectorSnapshot, CssSourceDeclaration } from './types.js';

/**
 * Produces a declaration-level inspector read model without inferring a CSS cascade winner.
 * `sourceDeclarations` are the accessible author/inline candidates; `computedDeclarations`
 * are the browser's final values and must be consumed as a separate view.
 */
export function inspectCssDeclarations(element: Element): CssInspectorSnapshot {
  const influences = collectCssInfluences(element);
  const sourceDeclarations: CssSourceDeclaration[] = [
    ...influences.inlineStyle.map((declaration) => ({
      ...declaration,
      source: 'inline' as const,
      stylesheetHref: null,
      stylesheetLabel: 'element.style',
      selector: null,
      conditions: [],
      rulePath: null,
    })),
    ...influences.matchedSelectors.flatMap((match) =>
      match.declarations.map((declaration) => ({
        ...declaration,
        source: 'author' as const,
        stylesheetHref: match.stylesheetHref,
        stylesheetLabel: match.stylesheetLabel,
        selector: match.selector,
        conditions: match.conditions,
        rulePath: match.rulePath,
      })),
    ),
  ];
  const computedDeclarations = Object.entries(extractComputedStyle(element).properties)
    .map(([property, value]) => ({ property, value, priority: '' }))
    .sort((left, right) => left.property.localeCompare(right.property));

  return {
    sourceDeclarations,
    computedDeclarations,
    inaccessibleStylesheets: influences.inaccessibleStylesheets,
  };
}
