import { inspectSelectorLayout, type ElementLayoutInspection } from 'browser-layout-inspector';
import type { PageToolController, PageToolState, PageWorkItemId } from './page-tools.js';
import {
  collectPageDomTree,
  extractPageStyles,
  type PageDomTreeNode,
  type PageStyleSnapshot,
} from './page-overview.js';

export interface InspectSelectorRequest {
  readonly type: 'browser-layout-inspector.inspect-selector';
  readonly selector: string;
  readonly referenceSelector?: string;
  readonly computedProperties?: readonly string[];
}

export interface InspectSelectorResponse {
  readonly ok: boolean;
  readonly inspection?: ElementLayoutInspection;
  readonly error?: string;
}

export type PageToolRequest =
  | {
      readonly type: 'browser-layout-inspector.start-picker';
      readonly mode: 'select' | 'auto-select' | 'measure' | 'ruler';
    }
  | { readonly type: 'browser-layout-inspector.focus-work-item'; readonly id: PageWorkItemId }
  | { readonly type: 'browser-layout-inspector.clear-work-item'; readonly id: PageWorkItemId }
  | {
      readonly type: 'browser-layout-inspector.set-work-item-selector';
      readonly id: Exclude<PageWorkItemId, 'ruler'>;
      readonly selector: string;
    }
  | { readonly type: 'browser-layout-inspector.select-tree-node'; readonly selector: string }
  | { readonly type: 'browser-layout-inspector.set-ruler-snap'; readonly enabled: boolean }
  | { readonly type: 'browser-layout-inspector.clear-ruler-guides' }
  | { readonly type: 'browser-layout-inspector.get-state' }
  | {
      readonly type: 'browser-layout-inspector.apply-style';
      readonly property: string;
      readonly value: string;
      readonly priority?: string;
    }
  | { readonly type: 'browser-layout-inspector.remove-style'; readonly property: string }
  | { readonly type: 'browser-layout-inspector.hide-selected' }
  | { readonly type: 'browser-layout-inspector.restore-selected' }
  | { readonly type: 'browser-layout-inspector.restore-all' };

export interface PageToolResponse {
  readonly ok: boolean;
  readonly state?: PageToolState;
  readonly error?: string;
}

export interface PageDomTreeResponse {
  readonly ok: boolean;
  readonly domTree?: PageDomTreeNode | null;
  readonly error?: string;
}

export interface PageStylesResponse {
  readonly ok: boolean;
  readonly pageStyles?: PageStyleSnapshot;
  readonly error?: string;
}

export type PageOverviewRequest =
  | { readonly type: 'browser-layout-inspector.get-dom-tree' }
  | { readonly type: 'browser-layout-inspector.extract-page-styles' };

export type ExtensionRequest = InspectSelectorRequest | PageToolRequest | PageOverviewRequest;
export type ExtensionResponse =
  | InspectSelectorResponse
  | PageToolResponse
  | PageDomTreeResponse
  | PageStylesResponse;

export function isInspectSelectorRequest(message: unknown): message is InspectSelectorRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'browser-layout-inspector.inspect-selector' &&
    typeof (message as { selector?: unknown }).selector === 'string'
  );
}

export function isPageToolRequest(message: unknown): message is PageToolRequest {
  if (typeof message !== 'object' || message === null) return false;
  const value = message as {
    readonly type?: unknown;
    readonly mode?: unknown;
    readonly id?: unknown;
    readonly selector?: unknown;
    readonly enabled?: unknown;
    readonly property?: unknown;
    readonly value?: unknown;
    readonly priority?: unknown;
  };
  switch (value.type) {
    case 'browser-layout-inspector.start-picker':
      return (
        value.mode === 'select' ||
        value.mode === 'auto-select' ||
        value.mode === 'measure' ||
        value.mode === 'ruler'
      );
    case 'browser-layout-inspector.focus-work-item':
    case 'browser-layout-inspector.clear-work-item':
      return (
        value.id === 'selection' ||
        value.id === 'anchor' ||
        value.id === 'target' ||
        value.id === 'ruler'
      );
    case 'browser-layout-inspector.set-work-item-selector':
      return (
        (value.id === 'selection' || value.id === 'anchor' || value.id === 'target') &&
        typeof value.selector === 'string'
      );
    case 'browser-layout-inspector.select-tree-node':
      return typeof value.selector === 'string';
    case 'browser-layout-inspector.get-state':
    case 'browser-layout-inspector.clear-ruler-guides':
    case 'browser-layout-inspector.hide-selected':
    case 'browser-layout-inspector.restore-selected':
    case 'browser-layout-inspector.restore-all':
      return true;
    case 'browser-layout-inspector.set-ruler-snap':
      return typeof value.enabled === 'boolean';
    case 'browser-layout-inspector.apply-style':
      return (
        typeof value.property === 'string' &&
        typeof value.value === 'string' &&
        (value.priority === undefined || typeof value.priority === 'string')
      );
    case 'browser-layout-inspector.remove-style':
      return typeof value.property === 'string';
    default:
      return false;
  }
}

export function inspectRequest(
  message: InspectSelectorRequest,
  document: Document,
): InspectSelectorResponse {
  try {
    return {
      ok: true,
      inspection: inspectSelectorLayout(message.selector, document, {
        referenceSelector: message.referenceSelector,
        computedProperties: message.computedProperties,
      }),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function pageToolRequest(
  message: PageToolRequest,
  controller: PageToolController,
): PageToolResponse {
  try {
    switch (message.type) {
      case 'browser-layout-inspector.start-picker':
        controller.startPicker(message.mode);
        break;
      case 'browser-layout-inspector.focus-work-item':
        controller.focusWorkItem(message.id);
        break;
      case 'browser-layout-inspector.clear-work-item':
        controller.clearWorkItem(message.id);
        break;
      case 'browser-layout-inspector.set-work-item-selector':
        controller.setWorkItemSelector(message.id, message.selector);
        break;
      case 'browser-layout-inspector.select-tree-node':
        controller.selectTreeNode(message.selector);
        break;
      case 'browser-layout-inspector.set-ruler-snap':
        controller.setRulerSnap(message.enabled);
        break;
      case 'browser-layout-inspector.clear-ruler-guides':
        controller.clearRulerGuides();
        break;
      case 'browser-layout-inspector.apply-style':
        controller.applyStyle(message.property, message.value, message.priority);
        break;
      case 'browser-layout-inspector.remove-style':
        controller.removeStyle(message.property);
        break;
      case 'browser-layout-inspector.hide-selected':
        controller.hideSelected();
        break;
      case 'browser-layout-inspector.restore-selected':
        controller.restoreSelected();
        break;
      case 'browser-layout-inspector.restore-all':
        controller.restoreAll();
        break;
      case 'browser-layout-inspector.get-state':
        break;
    }
    return { ok: true, state: controller.state() };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      state: controller.state(),
    };
  }
}

export function isPageOverviewRequest(message: unknown): message is PageOverviewRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    ((message as { readonly type?: unknown }).type === 'browser-layout-inspector.get-dom-tree' ||
      (message as { readonly type?: unknown }).type ===
        'browser-layout-inspector.extract-page-styles')
  );
}

export function pageOverviewRequest(
  message: PageOverviewRequest,
  document: Document,
): PageDomTreeResponse | PageStylesResponse {
  try {
    return message.type === 'browser-layout-inspector.get-dom-tree'
      ? { ok: true, domTree: collectPageDomTree(document) }
      : { ok: true, pageStyles: extractPageStyles(document) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
