import {
  inspectCssDeclarations,
  inspectElementLayout,
  measureElementComparison,
  measureRuler,
  rulerGuides,
  type CssInspectorSnapshot,
  type ElementLayoutInspection,
  type LayoutGapMeasurement,
  type RelativePosition,
  type RulerMeasurement,
  type ViewportPointCssPx,
} from 'browser-layout-inspector';

const SNAPSHOT_PROPERTIES = [
  'display',
  'position',
  'width',
  'height',
  'margin',
  'padding',
  'gap',
  'color',
  'background-color',
  'box-sizing',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'grid-template-columns',
  'grid-template-rows',
  'grid-column',
  'grid-row',
  'flex-flow',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'justify-content',
  'align-items',
  'align-content',
  'overflow',
  'transform',
] as const;

type PickerMode = 'select' | 'auto-select' | 'measure-anchor' | 'measure-target' | 'ruler' | null;

type ViewportPoint = ViewportPointCssPx;
export type { RulerMeasurement } from 'browser-layout-inspector';

interface InlineProperty {
  readonly value: string;
  readonly priority: string;
  readonly wasPresent: boolean;
}

export interface ElementSummary {
  readonly selector: string;
  readonly tagName: string;
  readonly text: string | null;
}

export type PageWorkItemId = 'selection' | 'anchor' | 'target' | 'ruler';

export interface PageSelectorCandidate {
  readonly selector: string;
  readonly source: 'matched-css' | 'unique' | 'fallback';
  readonly unique: boolean;
}

/** A persistent tab-local item that can be refocused or dismissed from the Side Panel. */
export interface PageWorkItem {
  readonly id: PageWorkItemId;
  /** Role stays compact while the visible label is the currently chosen selector. */
  readonly role: string;
  readonly label: string;
  readonly detail: string;
  readonly active: boolean;
  readonly selectorCandidates: readonly PageSelectorCandidate[];
  readonly selectedSelector: string | null;
}

/** Browser context needed to replay or compare a viewport-relative measurement. */
export interface PageMeasurementEnvironment {
  readonly url: string;
  readonly viewportCssPx: Readonly<{ readonly width: number; readonly height: number }>;
  readonly scrollCssPx: Readonly<{ readonly x: number; readonly y: number }>;
  readonly devicePixelRatio: number;
  readonly visualViewport: Readonly<{
    readonly width: number;
    readonly height: number;
    readonly scale: number;
  }> | null;
}

export interface PageToolState {
  readonly environment: PageMeasurementEnvironment;
  readonly pickerMode: 'select' | 'auto-select' | 'measure' | 'ruler' | null;
  readonly selected: ElementSummary | null;
  /** Active page selections and drawings, kept independently so A/B does not replace a normal selection. */
  readonly workItems: readonly PageWorkItem[];
  readonly inspection: ElementLayoutInspection | null;
  /** Source declaration candidates and complete final computed declarations for the selected element. */
  readonly cssInspector: CssInspectorSnapshot | null;
  readonly measurement: {
    readonly anchor: ElementSummary;
    readonly target: ElementSummary;
    readonly relative: RelativePosition;
  } | null;
  /** Free-drag viewport ruler. It measures screen points, independent of DOM elements. */
  readonly ruler: RulerMeasurement | null;
  readonly rulerSnapEnabled: boolean;
  /** Viewport-fixed reference lines retained for this tab session. */
  readonly guides: Readonly<{
    readonly vertical: readonly number[];
    readonly horizontal: readonly number[];
  }>;
  readonly changedElementCount: number;
}

/**
 * Tab-local interaction state. Every mutation records the original inline declaration,
 * so restore only rolls back changes introduced by this extension session.
 */
export class PageToolController {
  /** Inspector focus; it may be a normal selection, A, or B. */
  private selected: Element | null = null;
  /** Normal element selection, intentionally independent from A/B comparison state. */
  private normalSelection: Element | null = null;
  private anchor: Element | null = null;
  private measureTarget: Element | null = null;
  private rulerStart: ViewportPoint | null = null;
  private rulerEnd: ViewportPoint | null = null;
  private rulerSnapEnabled = false;
  private readonly verticalGuides = new Set<number>();
  private readonly horizontalGuides = new Set<number>();
  private readonly selectedWorkSelectors = new Map<Exclude<PageWorkItemId, 'ruler'>, string>();
  private mode: PickerMode = null;
  private activeWorkItem: PageWorkItemId | null = null;
  private pickerCursor: InlineProperty | null = null;
  private consumeNextClick = false;
  private readonly changes = new Map<Element, Map<string, InlineProperty>>();
  private readonly overlay: Overlay;

  public constructor(
    private readonly document: Document,
    private readonly onStateChange?: (state: PageToolState) => void,
  ) {
    this.overlay = new Overlay(document);
    document.addEventListener('mousemove', this.onPointerMove, true);
    document.addEventListener('mousedown', this.onMouseDown, true);
    document.addEventListener('mouseup', this.onMouseUp, true);
    document.addEventListener('click', this.onClick, true);
    document.defaultView?.addEventListener('keydown', this.onKeyDown, true);
    document.defaultView?.addEventListener('scroll', this.refreshOverlay, true);
    document.defaultView?.addEventListener('resize', this.refreshOverlay);
  }

  public startPicker(mode: 'select' | 'auto-select' | 'measure' | 'ruler'): void {
    this.mode =
      mode === 'select' || mode === 'auto-select'
        ? mode
        : mode === 'measure'
          ? 'measure-anchor'
          : 'ruler';
    if (mode === 'measure') {
      this.anchor = null;
      this.measureTarget = null;
    }
    if (mode === 'ruler') {
      this.rulerStart = null;
      this.rulerEnd = null;
    }
    this.showPickerCursor();
    this.overlay.clearHover();
    this.refreshOverlay();
    this.notifyStateChange();
  }

  /** Makes a work-list row the current CSS inspector target without altering its saved role. */
  public focusWorkItem(id: PageWorkItemId): void {
    const element =
      id === 'selection'
        ? this.normalSelection
        : id === 'anchor'
          ? this.anchor
          : id === 'target'
            ? this.measureTarget
            : null;
    if (id !== 'ruler' && !element) throw new Error('선택할 작업 항목이 없습니다.');
    if (element) this.selected = element;
    this.activeWorkItem = id;
    this.refreshOverlay();
    this.notifyStateChange();
  }

  /** Removes just the requested tab-local selection or drawing. Removing A also clears its dependent B. */
  public clearWorkItem(id: PageWorkItemId): void {
    if (id === 'selection') {
      const previous = this.normalSelection;
      this.normalSelection = null;
      if (this.selected === previous) this.selected = this.measureTarget ?? this.anchor;
    } else if (id === 'anchor') {
      const previousAnchor = this.anchor;
      const previousTarget = this.measureTarget;
      this.anchor = null;
      this.measureTarget = null;
      if (this.selected === previousAnchor || this.selected === previousTarget)
        this.selected = this.normalSelection;
    } else if (id === 'target') {
      const previous = this.measureTarget;
      this.measureTarget = null;
      if (this.selected === previous) this.selected = this.normalSelection ?? this.anchor;
    } else {
      this.rulerStart = null;
      this.rulerEnd = null;
    }
    if (this.activeWorkItem === id || (id === 'anchor' && this.activeWorkItem === 'target'))
      this.activeWorkItem =
        this.selected === this.normalSelection && this.normalSelection ? 'selection' : null;
    if (id === 'anchor') {
      this.selectedWorkSelectors.delete('anchor');
      this.selectedWorkSelectors.delete('target');
    } else if (id !== 'ruler') this.selectedWorkSelectors.delete(id);
    this.refreshOverlay();
    this.notifyStateChange();
  }

  /** Selects the display/copy selector for an existing element role without changing the underlying element. */
  public setWorkItemSelector(id: Exclude<PageWorkItemId, 'ruler'>, selector: string): void {
    const element =
      id === 'selection'
        ? this.normalSelection
        : id === 'anchor'
          ? this.anchor
          : this.measureTarget;
    if (!element) throw new Error('선택자를 바꿀 작업 항목이 없습니다.');
    if (!selectorCandidatesFor(element).some((candidate) => candidate.selector === selector))
      throw new Error('이 요소에 사용할 수 없는 selector입니다.');
    this.selectedWorkSelectors.set(id, selector);
    this.refreshOverlay();
    this.notifyStateChange();
  }

  /** Selects an element from the DOM-tree panel and treats it as the normal selection. */
  public selectTreeNode(selector: string): void {
    let element: Element | null;
    try {
      element = this.document.querySelector(selector);
    } catch {
      throw new Error('유효한 DOM tree selector가 아닙니다.');
    }
    if (!element || this.overlay.contains(element))
      throw new Error('현재 페이지에서 DOM tree 요소를 찾을 수 없습니다.');
    this.normalSelection = element;
    this.selected = element;
    this.activeWorkItem = 'selection';
    this.refreshOverlay();
    this.notifyStateChange();
  }

  public setRulerSnap(enabled: boolean): void {
    this.rulerSnapEnabled = enabled;
    this.notifyStateChange();
  }

  /** Removes only the tab-local guides produced by the most recent completed Ruler. */
  public clearRulerGuides(): void {
    this.verticalGuides.clear();
    this.horizontalGuides.clear();
    this.refreshOverlay();
    this.notifyStateChange();
  }

  public applyStyle(property: string, value: string, priority?: string): void {
    const element = this.requireSelected();
    const normalizedProperty = this.requireValidProperty(property);
    const normalizedPriority = priority?.trim().toLowerCase();
    if (normalizedPriority && normalizedPriority !== 'important')
      throw new Error('priority는 important만 지원합니다.');
    if (!normalizedProperty.startsWith('--') && !this.supports(normalizedProperty, value))
      throw new Error(`유효한 ${normalizedProperty} CSS 값이 아닙니다.`);
    this.capture(element, normalizedProperty);
    (element as HTMLElement).style.setProperty(normalizedProperty, value, normalizedPriority);
    this.refreshOverlay();
    this.notifyStateChange();
  }

  public removeStyle(property: string): void {
    const element = this.requireSelected();
    const normalizedProperty = this.requireValidProperty(property);
    this.capture(element, normalizedProperty);
    (element as HTMLElement).style.removeProperty(normalizedProperty);
    this.refreshOverlay();
    this.notifyStateChange();
  }

  public hideSelected(): void {
    const element = this.requireSelected();
    this.capture(element, 'display');
    (element as HTMLElement).style.setProperty('display', 'none', 'important');
    this.refreshOverlay();
    this.notifyStateChange();
  }

  public restoreSelected(): void {
    const element = this.requireSelected();
    this.restoreElement(element);
    this.refreshOverlay();
    this.notifyStateChange();
  }

  public restoreAll(): void {
    for (const element of this.changes.keys()) this.restoreElement(element);
    this.refreshOverlay();
    this.notifyStateChange();
  }

  public state(): PageToolState {
    const referenceSelector = this.anchor ? selectorFor(this.anchor) : null;
    const inspection = this.selected
      ? inspectElementLayout(this.selected, {
          targetSelector: selectorFor(this.selected),
          referenceElement: this.anchor,
          referenceSelector,
          computedProperties: SNAPSHOT_PROPERTIES,
        })
      : null;
    const cssInspector = this.selected ? inspectCssDeclarations(this.selected) : null;
    const measurement =
      this.anchor && this.measureTarget
        ? {
            anchor: summarize(this.anchor),
            target: summarize(this.measureTarget),
            relative: inspectElementLayout(this.measureTarget, {
              targetSelector: selectorFor(this.measureTarget),
              referenceElement: this.anchor,
              referenceSelector,
              includeCssInfluences: false,
              computedProperties: [],
            }).position.relativeToReference,
          }
        : null;
    const ruler =
      this.rulerStart && this.rulerEnd ? measureRuler(this.rulerStart, this.rulerEnd) : null;
    return {
      environment: environmentFor(this.document),
      pickerMode:
        this.mode === 'select'
          ? 'select'
          : this.mode === 'auto-select'
            ? 'auto-select'
            : this.mode === 'ruler'
              ? 'ruler'
              : this.mode
                ? 'measure'
                : null,
      selected: this.selected ? summarize(this.selected) : null,
      workItems: this.workItems(ruler),
      inspection,
      cssInspector,
      measurement,
      ruler,
      rulerSnapEnabled: this.rulerSnapEnabled,
      guides: {
        vertical: [...this.verticalGuides].sort((a, b) => a - b),
        horizontal: [...this.horizontalGuides].sort((a, b) => a - b),
      },
      changedElementCount: this.changes.size,
    };
  }

  private readonly onPointerMove = (event: MouseEvent): void => {
    if (!this.mode) return;
    if (this.mode === 'ruler') {
      if (!this.rulerStart) return;
      this.rulerEnd = pointFrom(event, this.rulerSnapEnabled);
      this.overlay.showRuler(this.rulerStart, this.rulerEnd);
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const element = this.elementFromEvent(event);
    if (!element) return;
    if (this.mode === 'auto-select') {
      if (element !== this.normalSelection || element !== this.selected) {
        this.normalSelection = element;
        this.selected = element;
        this.activeWorkItem = 'selection';
        this.refreshOverlay();
        this.notifyStateChange();
      }
      this.overlay.showHover(element, '#0f766e');
      return;
    }
    this.overlay.showHover(element, this.mode === 'select' ? '#2563eb' : '#f59e0b');
  };

  private readonly onMouseDown = (event: MouseEvent): void => {
    if (this.mode !== 'ruler' || event.button !== 0) return;
    this.rulerStart = pointFrom(event, this.rulerSnapEnabled);
    this.rulerEnd = this.rulerStart;
    this.overlay.showRuler(this.rulerStart, this.rulerEnd);
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  private readonly onMouseUp = (event: MouseEvent): void => {
    if (this.mode !== 'ruler' || event.button !== 0 || !this.rulerStart) return;
    this.rulerEnd = pointFrom(event, this.rulerSnapEnabled);
    this.replaceRulerGuides();
    this.mode = null;
    this.clearPickerCursor();
    this.consumeNextClick = true;
    this.refreshOverlay();
    this.notifyStateChange();
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  private readonly onClick = (event: MouseEvent): void => {
    if (this.consumeNextClick) {
      this.consumeNextClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (!this.mode || event.button !== 0) return;
    const element = this.elementFromEvent(event);
    if (!element) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (this.mode === 'auto-select') return;
    if (this.mode === 'select') {
      this.normalSelection = element;
      this.selected = element;
      this.activeWorkItem = 'selection';
      this.mode = null;
    } else if (this.mode === 'measure-anchor') {
      this.anchor = element;
      this.measureTarget = null;
      this.selected = element;
      this.activeWorkItem = 'anchor';
      this.mode = 'measure-target';
    } else {
      this.measureTarget = element;
      this.selected = element;
      this.activeWorkItem = 'target';
      this.mode = null;
    }
    if (!this.mode) this.clearPickerCursor();
    this.overlay.clearHover();
    this.refreshOverlay();
    this.notifyStateChange();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.mode) {
      this.mode = null;
      this.clearPickerCursor();
      this.overlay.clearHover();
      this.notifyStateChange();
      return;
    }
    if (
      this.mode !== 'auto-select' ||
      (event.key !== 'Delete' && event.key !== 'Backspace') ||
      isEditable(event.target)
    )
      return;
    if (!this.normalSelection) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.selected = this.normalSelection;
    this.hideSelected();
  };

  private readonly refreshOverlay = (): void => {
    this.overlay.showSelected(this.normalSelection);
    this.overlay.showMeasurement(
      this.anchor,
      this.measureTarget,
      this.selectorForWorkItem('anchor', this.anchor),
      this.selectorForWorkItem('target', this.measureTarget),
    );
    this.overlay.showRuler(this.rulerStart, this.rulerEnd);
    this.overlay.showGuides(this.verticalGuides, this.horizontalGuides);
  };

  /** A completed Ruler owns exactly its four edge guides; the next completed Ruler replaces them. */
  private replaceRulerGuides(): void {
    if (!this.rulerStart || !this.rulerEnd) return;
    const guides = rulerGuides(measureRuler(this.rulerStart, this.rulerEnd));
    this.verticalGuides.clear();
    this.horizontalGuides.clear();
    for (const value of guides.vertical) this.verticalGuides.add(value);
    for (const value of guides.horizontal) this.horizontalGuides.add(value);
  }

  private elementFromEvent(event: MouseEvent): Element | null {
    const target = event.target;
    if (!(target instanceof Element) || this.overlay.contains(target)) return null;
    return target;
  }

  private requireSelected(): Element {
    if (!this.selected) throw new Error('먼저 페이지에서 요소를 선택하세요.');
    return this.selected;
  }

  private workItems(ruler: RulerMeasurement | null): readonly PageWorkItem[] {
    const items: PageWorkItem[] = [];
    if (this.normalSelection?.isConnected)
      items.push(
        elementWorkItem(
          'selection',
          '일반 선택',
          this.normalSelection,
          this.activeWorkItem,
          this.selectedWorkSelectors,
        ),
      );
    if (this.anchor?.isConnected)
      items.push(
        elementWorkItem(
          'anchor',
          '비교 A',
          this.anchor,
          this.activeWorkItem,
          this.selectedWorkSelectors,
        ),
      );
    if (this.measureTarget?.isConnected)
      items.push(
        elementWorkItem(
          'target',
          '비교 B',
          this.measureTarget,
          this.activeWorkItem,
          this.selectedWorkSelectors,
        ),
      );
    if (ruler)
      items.push({
        id: 'ruler',
        role: 'Ruler',
        label: 'Ruler box',
        detail: `${ruler.width} × ${ruler.height}px · ${ruler.distance}px`,
        active: this.activeWorkItem === 'ruler',
        selectorCandidates: [],
        selectedSelector: null,
      });
    return items;
  }

  private selectorForWorkItem(
    id: Exclude<PageWorkItemId, 'ruler'>,
    element: Element | null,
  ): string | null {
    if (!element?.isConnected) return null;
    const candidates = selectorCandidatesFor(element);
    const chosen = this.selectedWorkSelectors.get(id);
    return candidates.some((candidate) => candidate.selector === chosen)
      ? chosen!
      : (candidates[0]?.selector ?? selectorFor(element));
  }

  private showPickerCursor(): void {
    const style = this.document.documentElement.style;
    if (!this.pickerCursor) {
      const value = style.getPropertyValue('cursor');
      this.pickerCursor = {
        value,
        priority: style.getPropertyPriority('cursor'),
        wasPresent: value !== '',
      };
    }
    style.setProperty('cursor', 'crosshair', 'important');
  }

  private clearPickerCursor(): void {
    if (!this.pickerCursor) return;
    const style = this.document.documentElement.style;
    if (this.pickerCursor.wasPresent)
      style.setProperty('cursor', this.pickerCursor.value, this.pickerCursor.priority);
    else style.removeProperty('cursor');
    this.pickerCursor = null;
  }

  private requireValidProperty(property: string): string {
    const normalizedProperty = property.trim();
    if (!normalizedProperty || /[;:{}]/.test(normalizedProperty))
      throw new Error('유효한 CSS 속성명을 입력하세요.');
    if (normalizedProperty.startsWith('--')) {
      if (!/^--[-_a-zA-Z0-9]+$/.test(normalizedProperty))
        throw new Error('유효한 CSS custom property 이름을 입력하세요.');
      return normalizedProperty;
    }
    if (!this.supports(normalizedProperty, 'initial'))
      throw new Error('유효한 CSS 속성명을 입력하세요.');
    return normalizedProperty;
  }

  private supports(property: string, value: string): boolean {
    return this.document.defaultView?.CSS.supports(property, value) ?? false;
  }

  private capture(element: Element, property: string): void {
    let elementChanges = this.changes.get(element);
    if (!elementChanges) {
      elementChanges = new Map();
      this.changes.set(element, elementChanges);
    }
    if (elementChanges.has(property)) return;
    const style = (element as HTMLElement).style;
    const value = style.getPropertyValue(property);
    elementChanges.set(property, {
      value,
      priority: style.getPropertyPriority(property),
      wasPresent: value !== '',
    });
  }

  private restoreElement(element: Element): void {
    const elementChanges = this.changes.get(element);
    if (!elementChanges) return;
    const style = (element as HTMLElement).style;
    for (const [property, original] of elementChanges) {
      if (original.wasPresent) style.setProperty(property, original.value, original.priority);
      else style.removeProperty(property);
    }
    this.changes.delete(element);
  }

  private notifyStateChange(): void {
    this.onStateChange?.(this.state());
  }
}

class Overlay {
  private readonly root: HTMLDivElement;
  private readonly hover = this.createBox();
  private readonly selected = this.createBox();
  private readonly anchor = this.createBox();
  private readonly target = this.createBox();
  private readonly measureLabel: HTMLDivElement;
  private readonly dimensions: HTMLDivElement;
  private readonly ruler: HTMLDivElement;
  private readonly rulerLabel: HTMLDivElement;
  private readonly guides: HTMLDivElement;
  private readonly labelOffsets = new Map<string, ViewportPoint>();
  private drag: {
    readonly label: HTMLElement;
    readonly line: HTMLElement | null;
    readonly key: string;
    readonly start: ViewportPoint;
    readonly initial: ViewportPoint;
    moved: boolean;
  } | null = null;

  public constructor(document: Document) {
    this.root = document.createElement('div');
    this.root.setAttribute('data-browser-layout-inspector-ui', 'true');
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      pointerEvents: 'none',
    });
    this.measureLabel = document.createElement('div');
    this.measureLabel.setAttribute('data-browser-layout-inspector-measurement-summary', 'true');
    Object.assign(this.measureLabel.style, {
      position: 'fixed',
      display: 'none',
      maxWidth: '340px',
      padding: '5px 7px',
      borderRadius: '4px',
      background: '#172033',
      color: '#fff',
      cursor: 'copy',
      pointerEvents: 'auto',
      font: '12px/1.35 ui-monospace, SFMono-Regular, monospace',
      boxShadow: '0 2px 8px rgb(0 0 0 / 0.25)',
    });
    this.enableMeasurementLabel(this.measureLabel, 'comparison-summary');
    this.dimensions = document.createElement('div');
    Object.assign(this.dimensions.style, { position: 'fixed', inset: '0', pointerEvents: 'none' });
    this.ruler = document.createElement('div');
    Object.assign(this.ruler.style, {
      position: 'fixed',
      display: 'none',
      boxSizing: 'border-box',
      border: '1px dashed #7c3aed',
      background: 'rgb(124 58 237 / 0.08)',
    });
    this.rulerLabel = document.createElement('div');
    Object.assign(this.rulerLabel.style, {
      position: 'absolute',
      left: '-1px',
      top: '-23px',
      padding: '4px 6px',
      borderRadius: '4px',
      whiteSpace: 'nowrap',
      background: '#6d28d9',
      color: '#fff',
      font: '12px/1.25 ui-monospace, SFMono-Regular, monospace',
      boxShadow: '0 2px 8px rgb(0 0 0 / 0.25)',
    });
    this.ruler.append(this.rulerLabel);
    this.guides = document.createElement('div');
    Object.assign(this.guides.style, { position: 'fixed', inset: '0', pointerEvents: 'none' });
    this.root.append(
      this.guides,
      this.hover,
      this.selected,
      this.anchor,
      this.target,
      this.dimensions,
      this.measureLabel,
      this.ruler,
    );
    document.documentElement.append(this.root);
    document.addEventListener('pointermove', this.onLabelPointerMove, true);
    document.addEventListener('pointerup', this.onLabelPointerUp, true);
    document.addEventListener('pointercancel', this.onLabelPointerCancel, true);
  }

  public contains(element: Element): boolean {
    return this.root.contains(element);
  }

  public clearHover(): void {
    this.hover.style.display = 'none';
  }

  public showHover(element: Element, color: string): void {
    this.showBox(this.hover, element, color, 'hover');
  }

  public showSelected(element: Element | null): void {
    if (!element || !element.isConnected) return this.hide(this.selected);
    this.showBox(this.selected, element, '#2563eb', `선택 · ${selectorFor(element)}`);
  }

  public showMeasurement(
    anchor: Element | null,
    target: Element | null,
    anchorSelector: string | null,
    targetSelector: string | null,
  ): void {
    if (!anchor || !anchor.isConnected) this.hide(this.anchor);
    else
      this.showBox(
        this.anchor,
        anchor,
        '#f59e0b',
        `기준 · ${anchorSelector ?? selectorFor(anchor)}`,
      );
    if (!target || !target.isConnected) {
      this.hide(this.target);
      this.measureLabel.style.display = 'none';
      this.dimensions.replaceChildren();
      return;
    }
    this.showBox(this.target, target, '#ef4444', `대상 · ${targetSelector ?? selectorFor(target)}`);
    if (!anchor || !anchor.isConnected) {
      this.dimensions.replaceChildren();
      return;
    }
    const a = anchor.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const comparison = measureElementComparison(a, b);
    this.measureLabel.textContent = `${anchorSelector ?? selectorFor(anchor)} → ${targetSelector ?? selectorFor(target)}  Δx ${comparison.deltaCssPx.x}px · Δy ${comparison.deltaCssPx.y}px  |  right→left ${comparison.directionalEdgeGapsCssPx.referenceRightToTargetLeft}px · bottom→top ${comparison.directionalEdgeGapsCssPx.referenceBottomToTargetTop}px`;
    this.measureLabel.dataset.copyValue = this.measureLabel.textContent;
    this.applyLabelOffset(this.measureLabel, 'comparison-summary');
    Object.assign(this.measureLabel.style, {
      display: 'block',
      left: `${Math.max(8, Math.min(b.left, window.innerWidth - 348))}px`,
      top: `${Math.max(8, Math.min(b.bottom + 8, window.innerHeight - 52))}px`,
    });
    this.showCornerDimensions(a, b, comparison);
  }

  public showRuler(start: ViewportPoint | null, end: ViewportPoint | null): void {
    if (!start || !end) {
      this.ruler.style.display = 'none';
      return;
    }
    const measurement = measureRuler(start, end);
    Object.assign(this.ruler.style, {
      display: 'block',
      left: `${Math.min(start.x, end.x)}px`,
      top: `${Math.min(start.y, end.y)}px`,
      width: `${measurement.width}px`,
      height: `${measurement.height}px`,
    });
    this.rulerLabel.textContent = `Ruler · W ${measurement.width}px · H ${measurement.height}px · ↗ ${measurement.distance}px · ∠ ${measurement.angle}°`;
  }

  public showGuides(vertical: ReadonlySet<number>, horizontal: ReadonlySet<number>): void {
    this.guides.replaceChildren();
    for (const x of vertical) this.guides.append(this.createGuide('vertical', x));
    for (const y of horizontal) this.guides.append(this.createGuide('horizontal', y));
  }

  private createBox(): HTMLDivElement {
    const box = this.root?.ownerDocument.createElement('div') ?? document.createElement('div');
    Object.assign(box.style, {
      position: 'fixed',
      display: 'none',
      boxSizing: 'border-box',
      border: '2px solid',
      background: 'rgb(37 99 235 / 0.08)',
      color: '#fff',
      font: '11px/1.25 ui-monospace, SFMono-Regular, monospace',
    });
    const label = box.ownerDocument.createElement('span');
    label.dataset.role = 'label';
    Object.assign(label.style, {
      position: 'absolute',
      left: '-2px',
      top: '-20px',
      maxWidth: '330px',
      padding: '2px 4px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      background: '#2563eb',
    });
    box.append(label);
    return box;
  }

  private createGuide(direction: 'vertical' | 'horizontal', value: number): HTMLDivElement {
    const guide = this.guides.ownerDocument.createElement('div');
    guide.setAttribute('data-browser-layout-inspector-guide', direction);
    Object.assign(
      guide.style,
      direction === 'vertical'
        ? {
            position: 'fixed',
            left: `${value}px`,
            top: '0',
            bottom: '0',
            borderLeft: '1px dashed #d946ef',
          }
        : {
            position: 'fixed',
            left: '0',
            right: '0',
            top: `${value}px`,
            borderTop: '1px dashed #d946ef',
          },
    );
    return guide;
  }

  /** Draws four corresponding-corner measurements, retaining signs for overlap and containment. */
  private showCornerDimensions(
    a: DOMRect,
    b: DOMRect,
    comparison = measureElementComparison(a, b),
  ): void {
    const top = Math.max(26, Math.min(a.top, b.top) - 26);
    const bottom = Math.min(window.innerHeight - 18, Math.max(a.bottom, b.bottom) + 26);
    const left = Math.max(30, Math.min(a.left, b.left) - 30);
    const right = Math.min(window.innerWidth - 18, Math.max(a.right, b.right) + 30);
    const dimensions = [
      this.nonZeroDimension(comparison.cornerDeltasCssPx.left, () =>
        this.createHorizontalDimension(
          'left',
          a.left,
          b.left,
          top,
          'A.left → B.left',
          comparison.cornerDeltasCssPx.left,
          'above',
        ),
      ),
      this.nonZeroDimension(comparison.cornerDeltasCssPx.right, () =>
        this.createHorizontalDimension(
          'right',
          a.right,
          b.right,
          bottom,
          'A.right → B.right',
          comparison.cornerDeltasCssPx.right,
          'below',
        ),
      ),
      this.nonZeroDimension(comparison.cornerDeltasCssPx.top, () =>
        this.createVerticalDimension(
          'top',
          a.top,
          b.top,
          left,
          'A.top → B.top',
          comparison.cornerDeltasCssPx.top,
          'right',
        ),
      ),
      this.nonZeroDimension(comparison.cornerDeltasCssPx.bottom, () =>
        this.createVerticalDimension(
          'bottom',
          a.bottom,
          b.bottom,
          right,
          'A.bottom → B.bottom',
          comparison.cornerDeltasCssPx.bottom,
          'left',
        ),
      ),
      ...this.gapDimensions(comparison.gaps),
    ].filter((dimension): dimension is HTMLDivElement => dimension !== null);
    this.dimensions.replaceChildren(...dimensions);
  }

  private nonZeroDimension(value: number, create: () => HTMLDivElement): HTMLDivElement | null {
    return round(value) === 0 ? null : create();
  }

  /** Renders only positive, projection-overlapping gaps calculated by the DOM-free measurement core. */
  private gapDimensions(gaps: readonly LayoutGapMeasurement[]): readonly HTMLDivElement[] {
    return gaps.map((gap) => {
      const title = `${gap.from.box === 'reference' ? 'A' : 'B'}.${gap.from.edge} → ${gap.to.box === 'reference' ? 'A' : 'B'}.${gap.to.edge} gap`;
      return gap.axis === 'horizontal'
        ? this.createHorizontalDimension(
            'gap-horizontal',
            gap.start,
            gap.end,
            gap.crossAxisCenter,
            title,
            gap.cssPx,
            'above',
            false,
          )
        : this.createVerticalDimension(
            'gap-vertical',
            gap.start,
            gap.end,
            gap.crossAxisCenter,
            title,
            gap.cssPx,
            'right',
            false,
          );
    });
  }

  private createHorizontalDimension(
    id: string,
    start: number,
    end: number,
    y: number,
    title: string,
    value: number,
    labelPosition: 'above' | 'below',
    signed = true,
  ): HTMLDivElement {
    const line = this.dimensions.ownerDocument.createElement('div');
    const left = Math.min(start, end);
    Object.assign(line.style, {
      position: 'fixed',
      left: `${left}px`,
      top: `${y}px`,
      width: `${Math.max(2, Math.abs(end - start))}px`,
      height: '2px',
      borderTop: '2px solid #0f766e',
      background: 'rgb(45 212 191 / 0.3)',
      boxShadow: '0 0 3px rgb(20 184 166 / 0.75)',
    });
    line.setAttribute('data-browser-layout-inspector-dimension', id);
    if (id.startsWith('gap-')) line.setAttribute('data-browser-layout-inspector-gap', id.slice(4));
    line.append(
      this.dimensionTick('vertical', start - left),
      this.dimensionTick('vertical', end - left),
      this.dimensionLabel(id, title, value, labelPosition, signed),
    );
    return line;
  }

  private createVerticalDimension(
    id: string,
    start: number,
    end: number,
    x: number,
    title: string,
    value: number,
    labelPosition: 'left' | 'right',
    signed = true,
  ): HTMLDivElement {
    const line = this.dimensions.ownerDocument.createElement('div');
    const top = Math.min(start, end);
    Object.assign(line.style, {
      position: 'fixed',
      left: `${x}px`,
      top: `${top}px`,
      width: '2px',
      height: `${Math.max(2, Math.abs(end - start))}px`,
      borderLeft: '2px solid #0f766e',
      background: 'rgb(45 212 191 / 0.3)',
      boxShadow: '0 0 3px rgb(20 184 166 / 0.75)',
    });
    line.setAttribute('data-browser-layout-inspector-dimension', id);
    if (id.startsWith('gap-')) line.setAttribute('data-browser-layout-inspector-gap', id.slice(4));
    line.append(
      this.dimensionTick('horizontal', start - top),
      this.dimensionTick('horizontal', end - top),
      this.dimensionLabel(id, title, value, labelPosition, signed),
    );
    return line;
  }

  private dimensionTick(direction: 'horizontal' | 'vertical', offset: number): HTMLDivElement {
    const tick = this.dimensions.ownerDocument.createElement('div');
    Object.assign(
      tick.style,
      direction === 'vertical'
        ? {
            position: 'absolute',
            left: `${offset}px`,
            top: '-6px',
            height: '12px',
            borderLeft: '2px solid #0f766e',
            boxShadow: '0 0 2px rgb(20 184 166 / 0.75)',
          }
        : {
            position: 'absolute',
            left: '-6px',
            top: `${offset}px`,
            width: '12px',
            borderTop: '2px solid #0f766e',
            boxShadow: '0 0 2px rgb(20 184 166 / 0.75)',
          },
    );
    return tick;
  }

  private dimensionLabel(
    key: string,
    title: string,
    value: number,
    position: 'above' | 'below' | 'left' | 'right',
    signed: boolean,
  ): HTMLSpanElement {
    const label = this.dimensions.ownerDocument.createElement('span');
    label.textContent = `${title} ${signed ? signedPixels(value) : pixels(value)}`;
    label.dataset.copyValue = label.textContent;
    Object.assign(label.style, {
      position: 'absolute',
      padding: '2px 4px',
      borderRadius: '3px',
      background: '#0f766e',
      color: '#fff',
      cursor: 'grab',
      pointerEvents: 'auto',
      whiteSpace: 'nowrap',
      font: '11px/1.25 ui-monospace, SFMono-Regular, monospace',
      boxShadow: '0 1px 4px rgb(0 0 0 / 0.2)',
      transition: 'background-color 120ms ease, box-shadow 120ms ease, outline-color 120ms ease',
    });
    if (position === 'above')
      Object.assign(label.style, { left: '50%', top: '-5px', transform: 'translate(-50%, -100%)' });
    else if (position === 'below')
      Object.assign(label.style, { left: '50%', top: '5px', transform: 'translateX(-50%)' });
    else if (position === 'left')
      Object.assign(label.style, { left: '-5px', top: '50%', transform: 'translate(-100%, -50%)' });
    else Object.assign(label.style, { left: '5px', top: '50%', transform: 'translateY(-50%)' });
    this.enableMeasurementLabel(label, key);
    return label;
  }

  private enableMeasurementLabel(label: HTMLElement, key: string): void {
    label.dataset.browserLayoutInspectorLabel = key;
    label.title = '클릭: 측정값 복사 · 드래그: 라벨 이동';
    label.addEventListener('pointerenter', () => {
      if (this.drag?.label === label) return;
      Object.assign(label.style, {
        background: '#115e59',
        boxShadow: '0 3px 10px rgb(15 118 110 / 0.55)',
        outline: '2px solid rgb(94 234 212 / 0.95)',
        outlineOffset: '2px',
      });
      this.emphasizeDimension(this.dimensionLineFor(label), true);
    });
    label.addEventListener('pointerleave', () => {
      if (this.drag?.label === label) return;
      Object.assign(label.style, {
        background: '#0f766e',
        boxShadow: '0 1px 4px rgb(0 0 0 / 0.2)',
        outline: 'none',
      });
      this.emphasizeDimension(this.dimensionLineFor(label), false);
    });
    label.addEventListener('pointerdown', (event) => this.startLabelPointer(event, label, key));
    this.applyLabelOffset(label, key);
  }

  private startLabelPointer(event: PointerEvent, label: HTMLElement, key: string): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const initial = this.labelOffsets.get(key) ?? { x: 0, y: 0 };
    const line = this.dimensionLineFor(label);
    this.drag = {
      label,
      line,
      key,
      start: { x: event.clientX, y: event.clientY },
      initial,
      moved: false,
    };
    label.setPointerCapture?.(event.pointerId);
    Object.assign(label.style, {
      cursor: 'grabbing',
      background: '#134e4a',
      outline: '2px solid rgb(94 234 212 / 0.95)',
      outlineOffset: '2px',
    });
    this.emphasizeDimension(line, true);
  }

  private readonly onLabelPointerMove = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag) return;
    const offset = {
      x: drag.initial.x + event.clientX - drag.start.x,
      y: drag.initial.y + event.clientY - drag.start.y,
    };
    if (Math.abs(offset.x - drag.initial.x) > 2 || Math.abs(offset.y - drag.initial.y) > 2)
      drag.moved = true;
    this.labelOffsets.set(drag.key, offset);
    this.applyLabelOffset(drag.label, drag.key);
    event.preventDefault();
    event.stopPropagation();
  };

  private readonly onLabelPointerUp = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    drag.label.releasePointerCapture?.(event.pointerId);
    Object.assign(drag.label.style, {
      cursor: 'grab',
      background: '#0f766e',
      outline: 'none',
      boxShadow: '0 1px 4px rgb(0 0 0 / 0.2)',
    });
    this.emphasizeDimension(drag.line, false);
    if (!drag.moved) this.copyLabel(drag.label);
    event.preventDefault();
    event.stopPropagation();
  };

  private readonly onLabelPointerCancel = (): void => {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    Object.assign(drag.label.style, {
      cursor: 'grab',
      background: '#0f766e',
      outline: 'none',
      boxShadow: '0 1px 4px rgb(0 0 0 / 0.2)',
    });
    this.emphasizeDimension(drag.line, false);
  };

  private applyLabelOffset(label: HTMLElement, key: string): void {
    const offset = this.labelOffsets.get(key) ?? { x: 0, y: 0 };
    const base = label.dataset.baseTransform ?? label.style.transform;
    label.dataset.baseTransform = base;
    label.style.transform = `${base} translate(${offset.x}px, ${offset.y}px)`;
  }

  private dimensionLineFor(label: HTMLElement): HTMLElement | null {
    return label.closest('[data-browser-layout-inspector-dimension]') as HTMLElement | null;
  }

  private emphasizeDimension(line: HTMLElement | null, active: boolean): void {
    if (!line) return;
    line.toggleAttribute('data-browser-layout-inspector-dimension-active', active);
    Object.assign(
      line.style,
      active
        ? {
            borderColor: '#5eead4',
            background: 'rgb(94 234 212 / 0.7)',
            filter: 'drop-shadow(0 0 5px rgb(45 212 191 / 0.95))',
            zIndex: '1',
          }
        : { borderColor: '#0f766e', background: 'rgb(45 212 191 / 0.3)', filter: '', zIndex: '' },
    );
    for (const child of line.children) {
      if (!(child instanceof HTMLElement) || child.dataset.browserLayoutInspectorLabel) continue;
      child.style.borderColor = active ? '#5eead4' : '#0f766e';
      child.style.filter = active ? 'drop-shadow(0 0 2px rgb(45 212 191 / 0.95))' : '';
    }
  }

  private copyLabel(label: HTMLElement): void {
    const value = label.dataset.copyValue ?? label.textContent ?? '';
    if (!value) return;
    void copyToClipboard(this.root.ownerDocument, value)
      .then(() => {
        const original = label.textContent;
        label.textContent = '복사됨';
        window.setTimeout(() => {
          label.textContent = original;
        }, 900);
      })
      .catch(() => {
        const original = label.textContent;
        label.textContent = '복사 실패';
        window.setTimeout(() => {
          label.textContent = original;
        }, 1_200);
      });
  }

  private showBox(box: HTMLDivElement, element: Element, color: string, label: string): void {
    const rect = element.getBoundingClientRect();
    const labelElement = box.querySelector('[data-role="label"]') as HTMLSpanElement;
    Object.assign(box.style, {
      display: 'block',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      borderColor: color,
      backgroundColor: `${color}16`,
    });
    labelElement.style.background = color;
    labelElement.textContent = `${label} · ${round(rect.width)} × ${round(rect.height)}`;
  }

  private hide(element: HTMLElement): void {
    element.style.display = 'none';
  }
}

function summarize(element: Element): ElementSummary {
  const text = element.textContent?.trim().replace(/\s+/g, ' ') ?? '';
  return {
    selector: selectorFor(element),
    tagName: element.tagName.toLowerCase(),
    text: text ? text.slice(0, 80) : null,
  };
}

function elementWorkItem(
  id: Exclude<PageWorkItemId, 'ruler'>,
  role: string,
  element: Element,
  activeWorkItem: PageWorkItemId | null,
  selectedWorkSelectors: ReadonlyMap<Exclude<PageWorkItemId, 'ruler'>, string>,
): PageWorkItem {
  const selectorCandidates = selectorCandidatesFor(element);
  const selectedSelector =
    selectedWorkSelectors.get(id) &&
    selectorCandidates.some((candidate) => candidate.selector === selectedWorkSelectors.get(id))
      ? selectedWorkSelectors.get(id)!
      : (selectorCandidates[0]?.selector ?? selectorFor(element));
  const chosen = selectorCandidates.find((candidate) => candidate.selector === selectedSelector);
  return {
    id,
    role,
    label: selectedSelector,
    detail: selectorCandidateDescription(chosen),
    active: activeWorkItem === id,
    selectorCandidates,
    selectedSelector,
  };
}

/** Prefers currently matched stylesheet selectors, then stable unique identity selectors, then a structural fallback. */
function selectorCandidatesFor(element: Element): readonly PageSelectorCandidate[] {
  const seen = new Set<string>();
  const candidates: PageSelectorCandidate[] = [];
  const add = (selector: string, source: PageSelectorCandidate['source']): void => {
    if (!selector || seen.has(selector)) return;
    seen.add(selector);
    candidates.push({ selector, source, unique: matchesOnly(element, selector) });
  };
  for (const declaration of inspectCssDeclarations(element).sourceDeclarations) {
    if (declaration.source === 'author' && declaration.selector)
      add(declaration.selector, 'matched-css');
  }
  const id = element.getAttribute('id');
  if (id) add(`#${cssEscape(id)}`, 'unique');
  for (const attribute of ['data-testid', 'data-qa-id', 'data-measure-id']) {
    const value = element.getAttribute(attribute);
    if (value) add(`[${attribute}="${cssStringEscape(value)}"]`, 'unique');
  }
  add(selectorFor(element), 'fallback');
  return candidates.sort(
    (a, b) =>
      selectorCandidateRank(a) - selectorCandidateRank(b) || a.selector.localeCompare(b.selector),
  );
}

function selectorCandidateRank(candidate: PageSelectorCandidate): number {
  if (candidate.source === 'matched-css' && candidate.unique) return 0;
  if (candidate.source === 'unique' && candidate.unique) return 1;
  if (candidate.source === 'matched-css') return 2;
  if (candidate.unique) return 3;
  return 4;
}

function matchesOnly(element: Element, selector: string): boolean {
  try {
    const matches = element.ownerDocument.querySelectorAll(selector);
    return matches.length === 1 && matches[0] === element;
  } catch {
    return false;
  }
}

function selectorCandidateDescription(candidate: PageSelectorCandidate | undefined): string {
  if (!candidate) return '구조 selector';
  if (candidate.source === 'matched-css') return candidate.unique ? '매칭 CSS · 고유' : '매칭 CSS';
  if (candidate.source === 'unique') return '고유 식별자';
  return candidate.unique ? '구조 selector · 고유' : '구조 selector';
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function environmentFor(document: Document): PageMeasurementEnvironment {
  const view = document.defaultView;
  if (!view) throw new Error('page measurement requires a browsing context');
  const viewport = view.visualViewport;
  return {
    url: document.location.href,
    viewportCssPx: { width: view.innerWidth, height: view.innerHeight },
    scrollCssPx: { x: view.scrollX, y: view.scrollY },
    devicePixelRatio: view.devicePixelRatio,
    visualViewport: viewport
      ? { width: viewport.width, height: viewport.height, scale: viewport.scale }
      : null,
  };
}

function selectorFor(element: Element): string {
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
    const index = siblings.indexOf(current) + 1;
    segments.unshift(`${name}:nth-of-type(${Math.max(index, 1)})`);
    current = current.parentElement;
  }
  return segments.join(' > ') || element.tagName.toLowerCase();
}

function cssEscape(value: string): string {
  const escape = globalThis.CSS?.escape;
  return escape ? escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function cssStringEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function signedPixels(value: number): string {
  const rounded = round(value);
  return `${rounded >= 0 ? '+' : ''}${rounded}px`;
}

function pixels(value: number): string {
  return `${round(Math.abs(value))}px`;
}

async function copyToClipboard(document: Document, value: string): Promise<void> {
  const clipboard = document.defaultView?.navigator.clipboard;
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(value);
      return;
    } catch {
      // The fallback supports pages where the Clipboard API is unavailable despite a trusted label click.
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('aria-hidden', 'true');
  Object.assign(textarea.style, { position: 'fixed', opacity: '0', pointerEvents: 'none' });
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('clipboard write failed');
}

function pointFrom(event: MouseEvent, snapToGrid = false): ViewportPoint {
  const point = { x: round(event.clientX), y: round(event.clientY) };
  return snapToGrid ? { x: snap(point.x), y: snap(point.y) } : point;
}

function snap(value: number): number {
  return Math.round(value / 8) * 8;
}
