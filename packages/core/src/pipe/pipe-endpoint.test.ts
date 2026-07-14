// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, it, expect } from 'vitest';
import {
  isPortRef,
  toEndpointArray,
  normalizePortRefs,
  normalizeEndpointPipeIds,
  endpointIdentity,
} from './pipe-endpoint.js';

describe('isPortRef', () => {
  it('string → false', () => {
    expect(isPortRef('pipeA')).toBe(false);
  });

  it('PortRef → true', () => {
    expect(isPortRef({ pipeId: 'pipeA' })).toBe(true);
    expect(isPortRef({ pipeId: 'pipeA', portId: 'out' })).toBe(true);
  });
});

describe('toEndpointArray', () => {
  it('string → [string]', () => {
    expect(toEndpointArray('pipeA')).toEqual(['pipeA']);
  });

  it('string[] → 그대로', () => {
    expect(toEndpointArray(['pipeA', 'pipeB'])).toEqual(['pipeA', 'pipeB']);
  });

  it('PortRef → [PortRef]', () => {
    expect(toEndpointArray({ pipeId: 'pipeA' })).toEqual([{ pipeId: 'pipeA' }]);
  });

  it('PortRef[] → 그대로', () => {
    const refs = [{ pipeId: 'pipeA' }, { pipeId: 'pipeB', portId: 'out' }];
    expect(toEndpointArray(refs)).toEqual(refs);
  });
});

describe('normalizeEndpointPipeIds', () => {
  it('string → [pipeId]', () => {
    expect(normalizeEndpointPipeIds('pipeA')).toEqual(['pipeA']);
  });

  it('PortRef → [pipeId]', () => {
    expect(normalizeEndpointPipeIds({ pipeId: 'pipeA', portId: 'out' })).toEqual(['pipeA']);
  });

  it('혼합 배열 → pipeId 목록', () => {
    expect(normalizeEndpointPipeIds(['pipeA', 'pipeB'])).toEqual(['pipeA', 'pipeB']);
  });
});

describe('endpointIdentity', () => {
  it('string → 그대로', () => {
    expect(endpointIdentity('pipeA')).toBe('pipeA');
  });

  it('PortRef portId 없음 → pipeId만', () => {
    expect(endpointIdentity({ pipeId: 'pipeA' })).toBe('pipeA');
  });

  it('PortRef portId undefined → pipeId만', () => {
    expect(endpointIdentity({ pipeId: 'pipeA', portId: undefined })).toBe('pipeA');
  });

  it('PortRef portId 있음 → pipeId#portId', () => {
    expect(endpointIdentity({ pipeId: 'pipeA', portId: 'out' })).toBe('pipeA#out');
  });
});
