import type { PageToolState } from './page-tools.js';

/**
 * Versioned, JSON-safe snapshot for exchanging a measurement with another tool.
 * It deliberately contains only the current page-tool state, never extension runtime data.
 */
export interface BrowserLayoutInspectorExchangeV1 {
  readonly schemaVersion: 'browser-layout-inspector.exchange.v1';
  readonly exportedAt: string;
  readonly environment: PageToolState['environment'];
  readonly selected: PageToolState['selected'];
  readonly inspection: PageToolState['inspection'];
  readonly elementMeasurement: PageToolState['measurement'];
  readonly ruler: PageToolState['ruler'];
  readonly rulerSnapEnabled: boolean;
  readonly guides: PageToolState['guides'];
  readonly changedElementCount: number;
}

export function createLayoutExchange(state: PageToolState, exportedAt = new Date().toISOString()): BrowserLayoutInspectorExchangeV1 {
  return {
    schemaVersion: 'browser-layout-inspector.exchange.v1',
    exportedAt,
    environment: state.environment,
    selected: state.selected,
    inspection: state.inspection,
    elementMeasurement: state.measurement,
    ruler: state.ruler,
    rulerSnapEnabled: state.rulerSnapEnabled,
    guides: state.guides,
    changedElementCount: state.changedElementCount,
  };
}

/** Formats the exchange artifact with a trailing newline for a stable text-file representation. */
export function formatLayoutExchangeJson(state: PageToolState): string {
  return `${JSON.stringify(createLayoutExchange(state), null, 2)}\n`;
}
