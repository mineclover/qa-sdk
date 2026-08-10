import type {
  CssDeclaration,
  CssInfluenceReport,
  InaccessibleStylesheet,
  MatchedCssSelector,
} from './types.js';

function readDeclarations(style: CSSStyleDeclaration): readonly CssDeclaration[] {
  return Array.from(style).map((property) => ({
    property,
    value: style.getPropertyValue(property).trim(),
    priority: style.getPropertyPriority(property),
  }));
}

/** Split selectors without breaking :is(.a, .b), [data-value=","] or quoted strings. */
export function splitSelectorList(selectorText: string): readonly string[] {
  const selectors: string[] = [];
  let start = 0;
  let parenDepth = 0;
  let bracketDepth = 0;
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (let index = 0; index < selectorText.length; index += 1) {
    const character = selectorText[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '(') parenDepth += 1;
    else if (character === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (character === '[') bracketDepth += 1;
    else if (character === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    else if (character === ',' && parenDepth === 0 && bracketDepth === 0) {
      const selector = selectorText.slice(start, index).trim();
      if (selector) selectors.push(selector);
      start = index + 1;
    }
  }
  const selector = selectorText.slice(start).trim();
  if (selector) selectors.push(selector);
  return selectors;
}

function isActiveCondition(rule: CSSRule, view: Window): string | null {
  const conditionText = (rule as CSSConditionRule).conditionText;
  if (!conditionText) return null;
  if (typeof CSSRule !== 'undefined' && rule.type === CSSRule.MEDIA_RULE) {
    return view.matchMedia(conditionText).matches ? conditionText : 'inactive-media';
  }
  if (typeof CSSRule !== 'undefined' && rule.type === CSSRule.SUPPORTS_RULE) {
    return CSS.supports(conditionText) ? conditionText : 'inactive-supports';
  }
  return conditionText;
}

function matchesSelector(element: Element, selector: string): boolean {
  // Pseudo-elements cannot be matched against an Element by the DOM selector API.
  if (selector.includes('::')) return false;
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

function readRules(
  element: Element,
  rules: CSSRuleList,
  view: Window,
  stylesheetHref: string | null,
  stylesheetLabel: string,
  conditions: readonly string[],
  path: readonly number[],
  matches: MatchedCssSelector[],
): void {
  Array.from(rules).forEach((rule, index) => {
    const nextPath = [...path, index];
    const condition = isActiveCondition(rule, view);
    if (condition === 'inactive-media' || condition === 'inactive-supports') return;
    const nextConditions = condition ? [...conditions, condition] : conditions;

    if (typeof CSSRule !== 'undefined' && rule.type === CSSRule.IMPORT_RULE) {
      const imported = rule as CSSImportRule;
      if (imported.styleSheet) {
        try {
          readRules(
            element,
            imported.styleSheet.cssRules,
            view,
            imported.href,
            imported.href,
            nextConditions,
            nextPath,
            matches,
          );
        } catch {
          // The parent stylesheet's inaccessible diagnostic remains the actionable signal.
        }
      }
      return;
    }

    const selectorText = (rule as CSSStyleRule).selectorText;
    const style = (rule as CSSStyleRule).style;
    if (typeof selectorText === 'string' && style) {
      for (const selector of splitSelectorList(selectorText)) {
        if (matchesSelector(element, selector)) {
          matches.push({
            stylesheetHref,
            stylesheetLabel,
            selector,
            declarations: readDeclarations(style),
            conditions: nextConditions,
            rulePath: nextPath,
          });
        }
      }
      return;
    }

    const nestedRules = (rule as CSSGroupingRule).cssRules;
    if (nestedRules) {
      readRules(element, nestedRules, view, stylesheetHref, stylesheetLabel, nextConditions, nextPath, matches);
    }
  });
}

function stylesheetLabel(sheet: CSSStyleSheet, index: number): string {
  return sheet.href ?? `inline-style-${index + 1}`;
}

export function collectCssInfluences(element: Element): CssInfluenceReport {
  const document = element.ownerDocument;
  const view = document.defaultView;
  if (!view) throw new Error('collectCssInfluences requires an element in a browsing context');

  const matchedSelectors: MatchedCssSelector[] = [];
  const inaccessibleStylesheets: InaccessibleStylesheet[] = [];
  Array.from(document.styleSheets).forEach((sheet, index) => {
    const label = stylesheetLabel(sheet, index);
    try {
      readRules(element, sheet.cssRules, view, sheet.href, label, [], [], matchedSelectors);
    } catch {
      inaccessibleStylesheets.push({
        stylesheetHref: sheet.href,
        stylesheetLabel: label,
        reason: 'css-rules-inaccessible',
      });
    }
  });

  return {
    matchedSelectors,
    inaccessibleStylesheets,
    inlineStyle: (element as HTMLElement).style ? readDeclarations((element as HTMLElement).style) : [],
  };
}
