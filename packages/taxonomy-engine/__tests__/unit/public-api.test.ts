import { describe, it, expect } from 'vitest';
import * as api from '../../src/index.js';

describe('public API', () => {
  it('필수 함수 export', () => {
    expect(typeof api.parse).toBe('function');
    expect(typeof api.validate).toBe('function');
    expect(typeof api.parseRef).toBe('function');
    expect(typeof api.resolveRef).toBe('function');
    expect(typeof api.indexAxis).toBe('function');
    expect(typeof api.packCoordinate).toBe('function');
    expect(typeof api.unpackCoordinate).toBe('function');
    expect(typeof api.codegen).toBe('function');
    expect(typeof api.TaxonomyRegistry).toBe('function');
  });
});
