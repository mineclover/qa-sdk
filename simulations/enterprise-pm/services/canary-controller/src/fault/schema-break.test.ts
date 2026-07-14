// @def.boundary sim-canary-controller
// @def.doc canary-controller-config

import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaBreakFault, type SchemaBreakStore } from './schema-break.js';

class InMem implements SchemaBreakStore {
  state: { active: boolean; fieldName: string | null } = {
    active: false,
    fieldName: null,
  };
  async setBreak(f: string) {
    this.state = { active: true, fieldName: f };
  }
  async clearBreak() {
    this.state = { active: false, fieldName: null };
  }
  async readBreak() {
    return this.state;
  }
}

describe('SchemaBreakFault (시나리오 #10)', () => {
  let s: InMem, f: SchemaBreakFault;
  beforeEach(() => {
    s = new InMem();
    f = new SchemaBreakFault(s);
  });
  it('enable writes required field marker', async () => {
    await f.enable({ fieldName: 'v2.required.tenantTier' });
    expect((await s.readBreak()).active).toBe(true);
    expect((await s.readBreak()).fieldName).toBe('v2.required.tenantTier');
  });
  it('disable clears marker + reset is idempotent', async () => {
    await f.enable({ fieldName: 'v2.required.tenantTier' });
    await f.disable();
    expect((await s.readBreak()).active).toBe(false);
    await f.reset();
    await f.reset();
    expect((await s.readBreak()).active).toBe(false);
  });
  it('rejects enable without fieldName', async () => {
    await expect(f.enable({})).rejects.toThrow();
  });
});
