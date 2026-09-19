export interface PageDomTreeNode {
  readonly selector: string;
  readonly label: string;
  readonly childCount: number;
  readonly children: readonly PageDomTreeNode[];
  readonly truncated: boolean;
}

export interface PageStyleSnapshot {
  readonly css: string;
  readonly accessibleStylesheetCount: number;
  readonly inaccessibleStylesheets: readonly string[];
}

/**
 * Produces a bounded, clickable map of the inspected document. Extension overlays
 * are deliberately omitted so the tree represents the page rather than this tool.
 */
export function collectPageDomTree(
  document: Document,
  maxDepth = 5,
  maxNodes = 240,
): PageDomTreeNode | null {
  const root = document.body;
  if (!root) return null;
  let visited = 0;
  const visit = (element: Element, depth: number): PageDomTreeNode => {
    visited += 1;
    const pageChildren = [...element.children].filter(
      (child) => !child.hasAttribute('data-browser-layout-inspector-ui'),
    );
    const canDescend = depth < maxDepth && visited < maxNodes;
    const children = canDescend ? pageChildren.map((child) => visit(child, depth + 1)) : [];
    return {
      selector: selectorFor(element),
      label: nodeLabel(element),
      childCount: pageChildren.length,
      children,
      truncated: pageChildren.length > children.length,
    };
  };
  return visit(root, 0);
}

/** Returns readable author stylesheets as CSS text and reports CSSOM access failures without bypassing them. */
export function extractPageStyles(document: Document): PageStyleSnapshot {
  const sections: string[] = [];
  const inaccessibleStylesheets: string[] = [];
  let accessibleStylesheetCount = 0;
  [...document.styleSheets].forEach((sheet, index) => {
    const label = sheet.href ?? `<style #${index + 1}>`;
    try {
      const rules = [...sheet.cssRules].map((rule) => rule.cssText).join('\n\n');
      accessibleStylesheetCount += 1;
      sections.push(`/* Source: ${safeComment(label)} */\n${rules}`);
    } catch {
      inaccessibleStylesheets.push(label);
    }
  });
  if (inaccessibleStylesheets.length > 0)
    sections.push(
      `/* CSSOM unavailable: ${inaccessibleStylesheets.map(safeComment).join(', ')} */`,
    );
  return {
    css: sections.join('\n\n') || '/* 읽을 수 있는 author stylesheet가 없습니다. */',
    accessibleStylesheetCount,
    inaccessibleStylesheets,
  };
}

function selectorFor(element: Element): string {
  if (element === element.ownerDocument.body) return 'body';
  const id = element.getAttribute('id');
  if (id) return `#${cssEscape(id)}`;
  for (const attribute of ['data-testid', 'data-qa-id', 'data-measure-id']) {
    const value = element.getAttribute(attribute);
    if (value) return `[${attribute}="${cssStringEscape(value)}"]`;
  }
  const segments: string[] = [];
  let current: Element | null = element;
  while (current && current !== current.ownerDocument.documentElement && segments.length < 4) {
    const name = current.tagName.toLowerCase();
    const siblings = current.parentElement
      ? [...current.parentElement.children].filter(
          (sibling) => sibling.tagName === current!.tagName,
        )
      : [];
    segments.unshift(`${name}:nth-of-type(${Math.max(siblings.indexOf(current) + 1, 1)})`);
    current = current.parentElement;
  }
  return segments.join(' > ') || element.tagName.toLowerCase();
}

function nodeLabel(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const classes = [...element.classList]
    .slice(0, 2)
    .map((name) => `.${name}`)
    .join('');
  return `${tag}${id}${classes}`;
}

function cssEscape(value: string): string {
  return globalThis.CSS?.escape
    ? globalThis.CSS.escape(value)
    : value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function cssStringEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function safeComment(value: string): string {
  return value.replaceAll('*/', '* /').replaceAll('\n', ' ');
}
