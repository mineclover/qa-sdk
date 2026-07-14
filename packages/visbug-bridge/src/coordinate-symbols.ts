import type { DomRefSymbol } from './types.js';

export type CoordinateLocateResult =
  | string
  | number
  | {
      readonly address?: string | number;
      readonly id?: string | number;
      readonly nodeId?: string | number;
      readonly selector?: string;
    }
  | null
  | undefined;

export interface CoordinateLocator {
  locateElement(element: Element): CoordinateLocateResult;
}

export interface DomRefSymbolResolverOptions {
  readonly rlsc?: CoordinateLocator;
  readonly qaCoord?: CoordinateLocator;
}

export function createDomRefSymbolResolver(
  opts: DomRefSymbolResolverOptions,
): (element: Element) => DomRefSymbol[] {
  return (element) => {
    const symbols: DomRefSymbol[] = [];
    const rlsc = locateToSymbol('rlsc', opts.rlsc, element, 90);
    if (rlsc) symbols.push(rlsc);
    const qaCoord = locateToSymbol('qa-coord', opts.qaCoord, element, 88);
    if (qaCoord) symbols.push(qaCoord);
    return symbols;
  };
}

function locateToSymbol(
  kind: 'rlsc' | 'qa-coord',
  locator: CoordinateLocator | undefined,
  element: Element,
  stability: number,
): DomRefSymbol | null {
  if (!locator) return null;
  try {
    const result = locator.locateElement(element);
    const normalized = normalizeLocateResult(result);
    if (!normalized) return null;
    return {
      kind,
      value: normalized.value,
      matchCount: 1,
      stability,
      provenance: `${kind}.locateElement:${normalized.source}`,
    };
  } catch {
    return null;
  }
}

function normalizeLocateResult(
  result: CoordinateLocateResult,
): { value: string; source: string } | null {
  if (result == null) return null;
  if (typeof result === 'string' || typeof result === 'number') {
    return { value: String(result), source: 'value' };
  }
  if (result.address != null) return { value: String(result.address), source: 'address' };
  if (result.id != null) return { value: String(result.id), source: 'id' };
  if (result.nodeId != null) return { value: String(result.nodeId), source: 'nodeId' };
  if (result.selector) return { value: result.selector, source: 'selector' };
  return null;
}
