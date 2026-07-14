// @def.boundary weighted-index-system
// @def.doc weighted-index-system

import { describe, expect, it } from 'vitest';
import { renderHexBar } from './hex-bar.js';

describe('renderHexBar', () => {
  it('renders a normal layout when values fit', () => {
    const html = renderHexBar('ok', 4, [
      { type: 'prefix', chars: 2, value: 0xab },
      { type: 'index', chars: 2, value: 0x1 },
    ]);

    expect(html).toContain('hex-layout-status');
    expect(html).not.toContain('overflow');
  });

  it('marks overflow when a field value exceeds allocated chars', () => {
    const html = renderHexBar('overflow', 4, [{ type: 'prefix', chars: 2, value: 0xabc }]);

    expect(html).toContain('hex-layout-overflow');
    expect(html).toContain('overflow');
  });
});
