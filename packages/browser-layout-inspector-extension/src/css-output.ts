import type { CssDeclaration, ElementLayoutInspection, MatchedCssSelector } from 'browser-layout-inspector';

/**
 * Converts an inspection into copyable CSS. The first rule is the browser's final
 * computed snapshot; later rules are matched source candidates and are intentionally
 * labelled because CSSOM cannot expose a standards-based cascade winner per property.
 */
export function formatInspectionAsCss(inspection: ElementLayoutInspection): string {
  const selector = inspection.targetSelector ?? ':root';
  const sections = [
    '/* Computed CSS snapshot — final values for the current page state. */',
    formatRule(selector, Object.entries(inspection.computedStyle.properties).map(([property, value]) => ({ property, value, priority: '' })), false),
  ];
  const influences = inspection.cssInfluences;
  if (!influences) return sections.join('\n\n');

  if (influences.inlineStyle.length > 0) {
    sections.push('/* Existing inline style before any extension edit. */', formatRule(selector, influences.inlineStyle, false));
  }
  if (influences.matchedSelectors.length > 0) {
    sections.push('/* Matched author CSS candidates — inspect the computed block above for final winners. */');
    for (const match of influences.matchedSelectors) sections.push(formatSourceRule(match));
  }
  if (influences.inaccessibleStylesheets.length > 0) {
    sections.push(`/* CSSOM unavailable: ${influences.inaccessibleStylesheets.map((sheet) => safeComment(sheet.stylesheetHref ?? sheet.stylesheetLabel)).join(', ')} */`);
  }
  return sections.join('\n\n');
}

function formatSourceRule(match: MatchedCssSelector): string {
  const source = match.stylesheetHref ?? match.stylesheetLabel;
  const conditions = match.conditions.length > 0 ? `; active when ${match.conditions.join(' → ')}` : '';
  return `/* Source: ${safeComment(source)}${safeComment(conditions)} */\n${formatRule(match.selector, match.declarations, true)}`;
}

function formatRule(selector: string, declarations: readonly CssDeclaration[], keepEmpty: boolean): string {
  const lines = declarations
    .filter((declaration) => keepEmpty || declaration.value !== '')
    .map((declaration) => `  ${declaration.property}: ${declaration.value}${declaration.priority ? ` !${declaration.priority}` : ''};`);
  return `${selector} {\n${lines.join('\n')}\n}`;
}

function safeComment(value: string): string {
  return value.replaceAll('*/', '* /').replaceAll('\n', ' ');
}
