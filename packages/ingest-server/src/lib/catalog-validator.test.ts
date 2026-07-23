import { describe, expect, it } from 'vitest';
import { createCatalogValidator } from './catalog-validator.js';

describe('CatalogValidator', () => {
  it('recognizes mapping-pack events as known while preserving core-event metadata', () => {
    const validator = createCatalogValidator({
      knownPrefixes: new Set(),
      isCoreEvent: (eventKey) => eventKey === 'page_view',
      isKnownEvent: (eventKey) => eventKey === 'page_view' || eventKey === 'page.view',
    });

    expect(validator.validateEventKey('page.view')).toEqual({
      known: true,
      isCoreEvent: false,
    });
    expect(validator.validateEventKey('page_view')).toEqual({
      known: true,
      isCoreEvent: true,
    });
    expect(validator.validateEventKey('unknown.event')).toEqual({
      known: false,
      isCoreEvent: false,
    });
  });
});
