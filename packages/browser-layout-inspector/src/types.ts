export interface CssDeclaration {
  readonly property: string;
  readonly value: string;
  readonly priority: string;
}

/** One selector is one unit, even when it came from a comma-separated CSS rule. */
export interface MatchedCssSelector {
  readonly stylesheetHref: string | null;
  readonly stylesheetLabel: string;
  readonly selector: string;
  readonly declarations: readonly CssDeclaration[];
  readonly conditions: readonly string[];
  readonly rulePath: readonly number[];
}

export interface InaccessibleStylesheet {
  readonly stylesheetHref: string | null;
  readonly stylesheetLabel: string;
  readonly reason: 'css-rules-inaccessible';
}

export interface CssInfluenceReport {
  /** Rules active in the current browser state and matched by the supplied element. */
  readonly matchedSelectors: readonly MatchedCssSelector[];
  /** Cross-origin CSSOM cannot be read by a content script; it is reported, never bypassed. */
  readonly inaccessibleStylesheets: readonly InaccessibleStylesheet[];
  /** The style attribute is included as a source unit, but has no CSS file. */
  readonly inlineStyle: readonly CssDeclaration[];
}

/** One declaration rendered with its source context; it is not a cascade-winner claim. */
export interface CssSourceDeclaration extends CssDeclaration {
  readonly source: 'inline' | 'author';
  readonly stylesheetHref: string | null;
  readonly stylesheetLabel: string;
  readonly selector: string | null;
  readonly conditions: readonly string[];
  readonly rulePath: readonly number[] | null;
}

/** DevTools-style read model: candidate declarations and browser-final computed values stay separate. */
export interface CssInspectorSnapshot {
  readonly sourceDeclarations: readonly CssSourceDeclaration[];
  readonly computedDeclarations: readonly CssDeclaration[];
  readonly inaccessibleStylesheets: readonly InaccessibleStylesheet[];
}

export interface ComputedStyleSnapshot {
  readonly pseudoElement: string | null;
  readonly properties: Readonly<Record<string, string>>;
}

export interface RectCssPx {
  readonly x: number;
  readonly y: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

export interface ElementMetrics {
  readonly viewportRect: RectCssPx;
  readonly documentRect: RectCssPx;
  readonly clientRects: readonly RectCssPx[];
  readonly offset: Readonly<{ width: number; height: number; top: number; left: number }>;
  readonly client: Readonly<{ width: number; height: number; top: number; left: number }>;
  readonly scroll: Readonly<{ width: number; height: number; top: number; left: number }>;
  readonly devicePixelRatio: number;
}

export interface RelativePosition {
  readonly reference: 'element' | 'offset-parent' | 'none';
  readonly referenceSelector: string | null;
  readonly deltaCssPx: Readonly<{ x: number; y: number }> | null;
  /** Directional edge gaps. Negative values indicate overlap. */
  readonly edgeGapsCssPx: Readonly<{
    leftToRight: number;
    rightToLeft: number;
    topToBottom: number;
    bottomToTop: number;
  }> | null;
}

export interface PositionReport {
  /** Position in viewport CSS pixels. */
  readonly viewport: RectCssPx;
  /** Position in document CSS pixels, including current page scroll. */
  readonly document: RectCssPx;
  readonly relativeToReference: RelativePosition;
  /** Native offset-parent coordinate when the target is an HTMLElement. */
  readonly relativeToOffsetParent: RelativePosition;
}

export interface InspectElementOptions {
  /** Optional stable selector for the target, preserved in the returned record. */
  readonly targetSelector?: string | null;
  readonly referenceElement?: Element | null;
  readonly referenceSelector?: string | null;
  /** Omit this only when an extension caller intentionally wants geometry without CSS provenance. */
  readonly includeCssInfluences?: boolean;
  /** A property allow-list; omit to extract every final computed property. */
  readonly computedProperties?: readonly string[];
  readonly pseudoElement?: string | null;
}

export interface ElementLayoutInspection {
  readonly targetSelector: string | null;
  readonly cssInfluences?: CssInfluenceReport;
  readonly computedStyle: ComputedStyleSnapshot;
  readonly metrics: ElementMetrics;
  readonly position: PositionReport;
}

export interface ObserveElementMetricsOptions {
  readonly box?: ResizeObserverBoxOptions;
}
