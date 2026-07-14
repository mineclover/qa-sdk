// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * 테스트 주소 인코딩/디코딩 — buildTestAddress, parseTestAddress
 */

import { describe, it, expect } from 'vitest';
import { buildTestAddress, parseTestAddress } from './test-tracking.js';

describe('테스트 주소', () => {
  it('buildTestAddress — phase 없음 (하위 호환)', () => {
    expect(buildTestAddress(1, 3, '소비', undefined, 2)).toBe('test:1:3:소비:2');
  });

  it('buildTestAddress — phase 포함', () => {
    expect(buildTestAddress(1, 3, '소비', 'arrange', 2)).toBe('test:1:3:소비:arrange:2');
  });

  it('parseTestAddress — 4세그먼트 (하위 호환)', () => {
    const parsed = parseTestAddress('test:1:3:소비:2');
    expect(parsed).toEqual({ scopeIndex: 1, aspectIndex: 3, facet: '소비', seq: 2 });
    expect(parsed!.phase).toBeUndefined();
  });

  it('parseTestAddress — 5세그먼트 (phase 포함)', () => {
    const parsed = parseTestAddress('test:1:3:소비:arrange:2');
    expect(parsed).toEqual({
      scopeIndex: 1,
      aspectIndex: 3,
      facet: '소비',
      phase: 'arrange',
      seq: 2,
    });
  });

  it('parseTestAddress — 라운드트립 (phase 포함)', () => {
    const addr = buildTestAddress(2, 5, '생산', 'assert-primary', 7);
    const parsed = parseTestAddress(addr);
    expect(parsed).toEqual({
      scopeIndex: 2,
      aspectIndex: 5,
      facet: '생산',
      phase: 'assert-primary',
      seq: 7,
    });
  });

  it('parseTestAddress — 잘못된 형식 → null', () => {
    expect(parseTestAddress('invalid')).toBeNull();
  });

  it('parseTestAddress — 잘못된 phase → phase undefined', () => {
    const parsed = parseTestAddress('test:1:3:소비:invalid-phase:2');
    expect(parsed).not.toBeNull();
    expect(parsed!.phase).toBeUndefined();
    expect(parsed!.facet).toBe('소비');
    expect(parsed!.seq).toBe(2);
  });
});
