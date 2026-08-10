import { inspectElementLayout, type ElementLayoutInspection, type RelativePosition } from 'browser-layout-inspector';

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

type PickerMode = 'select' | 'measure-anchor' | 'measure-target' | 'ruler' | null;

interface ViewportPoint {
  readonly x: number;
  readonly y: number;
}

interface RulerMeasurement {
  readonly start: ViewportPoint;
  readonly end: ViewportPoint;
  readonly width: number;
  readonly height: number;
  readonly distance: number;
  /** Clockwise from the viewport's positive horizontal axis. */
  readonly angle: number;
}

interface InlineProperty {
  readonly value: string;
  readonly priority: string;
  readonly wasPresent: boolean;
}

interface ElementSummary {
  readonly selector: string;
  readonly tagName: string;
  readonly text: string | null;
}

/** Browser context needed to replay or compare a viewport-relative measurement. */
export interface PageMeasurementEnvironment {
  readonly url: string;
  readonly viewportCssPx: Readonly<{ readonly width: number; readonly height: number }>;
  readonly scrollCssPx: Readonly<{ readonly x: number; readonly y: number }>;
  readonly devicePixelRatio: number;
  readonly visualViewport: Readonly<{ readonly width: number; readonly height: number; readonly scale: number }> | null;
}

export interface PageToolState {
  readonly environment: PageMeasurementEnvironment;
  readonly pickerMode: 'select' | 'measure' | 'ruler' | null;
  readonly selected: ElementSummary | null;
  readonly inspection: ElementLayoutInspection | null;
  readonly measurement: {
    readonly anchor: ElementSummary;
    readonly target: ElementSummary;
    readonly relative: RelativePosition;
  } | null;
  /** Free-drag viewport ruler. It measures screen points, independent of DOM elements. */
  readonly ruler: RulerMeasurement | null;
  readonly rulerSnapEnabled: boolean;
  /** Viewport-fixed reference lines retained for this tab session. */
  readonly guides: Readonly<{ readonly vertical: readonly number[]; readonly horizontal: readonly number[] }>;
  readonly changedElementCount: number;
}

/**
 * Tab-local interaction state. Every mutation records the original inline declaration,
 * so restore only rolls back changes introduced by this extension session.
 */
export class PageToolController {
  private selected: Element | null = null;
  private anchor: Element | null = null;
  private measureTarget: Element | null = null;
  private rulerStart: ViewportPoint | null = null;
  private rulerEnd: ViewportPoint | null = null;
  private rulerSnapEnabled = false;
  private readonly verticalGuides = new Set<number>();
  private readonly horizontalGuides = new Set<number>();
  private mode: PickerMode = null;
  private consumeNextClick = false;
  private readonly changes = new Map<Element, Map<string, InlineProperty>>();
  private readonly overlay: Overlay;

  public constructor(private readonly document: Document, private readonly onStateChange?: (state: PageToolState) => void) {
    this.overlay = new Overlay(document);
    document.addEventListener('mousemove', this.onPointerMove, true);
    document.addEventListener('mousedown', this.onMouseDown, true);
    document.addEventListener('mouseup', this.onMouseUp, true);
    document.addEventListener('click', this.onClick, true);
    document.defaultView?.addEventListener('keydown', this.onKeyDown, true);
    document.defaultView?.addEventListener('scroll', this.refreshOverlay, true);
    document.defaultView?.addEventListener('resize', this.refreshOverlay);
  }

  public startPicker(mode: 'select' | 'measure' | 'ruler'): void {
    this.mode = mode === 'select' ? 'select' : mode === 'measure' ? 'measure-anchor' : 'ruler';
    if (mode === 'measure') {
      this.anchor = null;
      this.measureTarget = null;
    }
    if (mode === 'ruler') {
      this.rulerStart = null;
      this.rulerEnd = null;
    }
    this.overlay.clearHover();
    this.refreshOverlay();
    this.notifyStateChange();
  }

  public setRulerSnap(enabled: boolean): void {
    this.rulerSnapEnabled = enabled;
    this.notifyStateChange();
  }

  public pinRulerGuides(): void {
    if (!this.rulerStart || !this.rulerEnd) throw new Error('먼저 Ruler를 드래그해 측정 영역을 만드세요.');
    this.verticalGuides.add(this.rulerStart.x);
    this.verticalGuides.add(this.rulerEnd.x);
    this.horizontalGuides.add(this.rulerStart.y);
    this.horizontalGuides.add(this.rulerEnd.y);
    this.refreshOverlay();
    this.notifyStateChange();
  }

  public clearRulerGuides(): void {
    this.verticalGuides.clear();
    this.horizontalGuides.clear();
    this.refreshOverlay();
    this.notifyStateChange();
  }

  public applyStyle(property: string, value: string, priority?: string): void {
    const element = this.requireSelected();
    const normalizedProperty = property.trim();
    if (!normalizedProperty || /[;:{}]/.test(normalizedProperty)) throw new Error('유효한 CSS 속성명을 입력하세요.');
    const normalizedPriority = priority?.trim().toLowerCase();
    if (normalizedPriority && normalizedPriority !== 'important') throw new Error('priority는 important만 지원합니다.');
    this.capture(element, normalizedProperty);
    (element as HTMLElement).style.setProperty(normalizedProperty, value, normalizedPriority);
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
    const measurement = this.anchor && this.measureTarget
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
    const ruler = this.rulerStart && this.rulerEnd ? rulerMeasurement(this.rulerStart, this.rulerEnd) : null;
    return {
      environment: environmentFor(this.document),
      pickerMode: this.mode === 'select' ? 'select' : this.mode === 'ruler' ? 'ruler' : this.mode ? 'measure' : null,
      selected: this.selected ? summarize(this.selected) : null,
      inspection,
      measurement,
      ruler,
      rulerSnapEnabled: this.rulerSnapEnabled,
      guides: { vertical: [...this.verticalGuides].sort((a, b) => a - b), horizontal: [...this.horizontalGuides].sort((a, b) => a - b) },
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
    if (element) this.overlay.showHover(element, this.mode === 'select' ? '#2563eb' : '#f59e0b');
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
    this.mode = null;
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
    if (this.mode === 'select') {
      this.selected = element;
      this.mode = null;
    } else if (this.mode === 'measure-anchor') {
      this.anchor = element;
      this.measureTarget = null;
      this.mode = 'measure-target';
    } else {
      this.measureTarget = element;
      this.selected = element;
      this.mode = null;
    }
    this.overlay.clearHover();
    this.refreshOverlay();
    this.notifyStateChange();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.mode) return;
    this.mode = null;
    this.overlay.clearHover();
    this.notifyStateChange();
  };

  private readonly refreshOverlay = (): void => {
    this.overlay.showSelected(this.selected);
    this.overlay.showMeasurement(this.anchor, this.measureTarget);
    this.overlay.showRuler(this.rulerStart, this.rulerEnd);
    this.overlay.showGuides(this.verticalGuides, this.horizontalGuides);
  };

  private elementFromEvent(event: MouseEvent): Element | null {
    const target = event.target;
    if (!(target instanceof Element) || this.overlay.contains(target)) return null;
    return target;
  }

  private requireSelected(): Element {
    if (!this.selected) throw new Error('먼저 페이지에서 요소를 선택하세요.');
    return this.selected;
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
    elementChanges.set(property, { value, priority: style.getPropertyPriority(property), wasPresent: value !== '' });
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
  private readonly ruler: HTMLDivElement;
  private readonly rulerLabel: HTMLDivElement;
  private readonly guides: HTMLDivElement;

  public constructor(document: Document) {
    this.root = document.createElement('div');
    this.root.setAttribute('data-browser-layout-inspector-ui', 'true');
    Object.assign(this.root.style, { position: 'fixed', inset: '0', zIndex: '2147483647', pointerEvents: 'none' });
    this.measureLabel = document.createElement('div');
    Object.assign(this.measureLabel.style, {
      position: 'fixed', display: 'none', maxWidth: '340px', padding: '5px 7px', borderRadius: '4px',
      background: '#172033', color: '#fff', font: '12px/1.35 ui-monospace, SFMono-Regular, monospace', boxShadow: '0 2px 8px rgb(0 0 0 / 0.25)',
    });
    this.ruler = document.createElement('div');
    Object.assign(this.ruler.style, { position: 'fixed', display: 'none', boxSizing: 'border-box', border: '1px dashed #7c3aed', background: 'rgb(124 58 237 / 0.08)' });
    this.rulerLabel = document.createElement('div');
    Object.assign(this.rulerLabel.style, {
      position: 'absolute', left: '-1px', top: '-23px', padding: '4px 6px', borderRadius: '4px', whiteSpace: 'nowrap',
      background: '#6d28d9', color: '#fff', font: '12px/1.25 ui-monospace, SFMono-Regular, monospace', boxShadow: '0 2px 8px rgb(0 0 0 / 0.25)',
    });
    this.ruler.append(this.rulerLabel);
    this.guides = document.createElement('div');
    Object.assign(this.guides.style, { position: 'fixed', inset: '0', pointerEvents: 'none' });
    this.root.append(this.guides, this.hover, this.selected, this.anchor, this.target, this.measureLabel, this.ruler);
    document.documentElement.append(this.root);
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

  public showMeasurement(anchor: Element | null, target: Element | null): void {
    if (!anchor || !anchor.isConnected) this.hide(this.anchor);
    else this.showBox(this.anchor, anchor, '#f59e0b', `A · ${selectorFor(anchor)}`);
    if (!target || !target.isConnected) {
      this.hide(this.target);
      this.measureLabel.style.display = 'none';
      return;
    }
    this.showBox(this.target, target, '#ef4444', `B · ${selectorFor(target)}`);
    if (!anchor || !anchor.isConnected) return;
    const a = anchor.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    this.measureLabel.textContent = `A → B  Δx ${round(b.left - a.left)}px · Δy ${round(b.top - a.top)}px  |  A.right→B.left ${round(b.left - a.right)}px · A.bottom→B.top ${round(b.top - a.bottom)}px`;
    Object.assign(this.measureLabel.style, { display: 'block', left: `${Math.max(8, Math.min(b.left, window.innerWidth - 348))}px`, top: `${Math.max(8, Math.min(b.bottom + 8, window.innerHeight - 52))}px` });
  }

  public showRuler(start: ViewportPoint | null, end: ViewportPoint | null): void {
    if (!start || !end) {
      this.ruler.style.display = 'none';
      return;
    }
    const measurement = rulerMeasurement(start, end);
    Object.assign(this.ruler.style, {
      display: 'block', left: `${Math.min(start.x, end.x)}px`, top: `${Math.min(start.y, end.y)}px`,
      width: `${measurement.width}px`, height: `${measurement.height}px`,
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
      position: 'fixed', display: 'none', boxSizing: 'border-box', border: '2px solid', background: 'rgb(37 99 235 / 0.08)',
      color: '#fff', font: '11px/1.25 ui-monospace, SFMono-Regular, monospace',
    });
    const label = box.ownerDocument.createElement('span');
    label.dataset.role = 'label';
    Object.assign(label.style, { position: 'absolute', left: '-2px', top: '-20px', maxWidth: '330px', padding: '2px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: '#2563eb' });
    box.append(label);
    return box;
  }

  private createGuide(direction: 'vertical' | 'horizontal', value: number): HTMLDivElement {
    const guide = this.guides.ownerDocument.createElement('div');
    guide.setAttribute('data-browser-layout-inspector-guide', direction);
    Object.assign(guide.style, direction === 'vertical'
      ? { position: 'fixed', left: `${value}px`, top: '0', bottom: '0', borderLeft: '1px dashed #d946ef' }
      : { position: 'fixed', left: '0', right: '0', top: `${value}px`, borderTop: '1px dashed #d946ef' });
    return guide;
  }

  private showBox(box: HTMLDivElement, element: Element, color: string, label: string): void {
    const rect = element.getBoundingClientRect();
    const labelElement = box.querySelector('[data-role="label"]') as HTMLSpanElement;
    Object.assign(box.style, { display: 'block', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, borderColor: color, backgroundColor: `${color}16` });
    labelElement.style.background = color;
    labelElement.textContent = `${label} · ${round(rect.width)} × ${round(rect.height)}`;
  }

  private hide(element: HTMLElement): void {
    element.style.display = 'none';
  }
}

function summarize(element: Element): ElementSummary {
  const text = element.textContent?.trim().replace(/\s+/g, ' ') ?? '';
  return { selector: selectorFor(element), tagName: element.tagName.toLowerCase(), text: text ? text.slice(0, 80) : null };
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
    visualViewport: viewport ? { width: viewport.width, height: viewport.height, scale: viewport.scale } : null,
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
    const siblings = current.parentElement ? [...current.parentElement.children].filter((sibling) => sibling.tagName === current!.tagName) : [];
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

function pointFrom(event: MouseEvent, snapToGrid = false): ViewportPoint {
  const point = { x: round(event.clientX), y: round(event.clientY) };
  return snapToGrid ? { x: snap(point.x), y: snap(point.y) } : point;
}

function rulerMeasurement(start: ViewportPoint, end: ViewportPoint): RulerMeasurement {
  const width = round(Math.abs(end.x - start.x));
  const height = round(Math.abs(end.y - start.y));
  return { start, end, width, height, distance: round(Math.hypot(width, height)), angle: round(Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI)) };
}

function snap(value: number): number {
  return Math.round(value / 8) * 8;
}
