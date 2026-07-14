// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { describe, expect, it } from 'vitest';
import type { ScenarioSpec } from '@qa-sdk/core';
import { InMemoryScenarioSpecStore } from './scenario-spec.adapter.js';

function buildSpec(overrides: Partial<ScenarioSpec> = {}): ScenarioSpec {
  return {
    scenario_id: 'sc-1',
    version: '1.0.0',
    domain: 'checkout',
    steps: [{ id: 's1', event_key: 'page_view', required: true, kind: 'sequence' }],
    ...overrides,
  };
}

describe('InMemoryScenarioSpecStore', () => {
  describe('upsert + findById', () => {
    it('returns null for an unknown scenario_id', async () => {
      const store = new InMemoryScenarioSpecStore();
      expect(await store.findById('nonexistent')).toBeNull();
    });

    it('stores and retrieves a spec by id', async () => {
      const store = new InMemoryScenarioSpecStore();
      const spec = buildSpec();
      await store.upsert(spec);
      expect(await store.findById('sc-1')).toEqual(spec);
    });

    it('overwrites an existing spec on re-upsert', async () => {
      const store = new InMemoryScenarioSpecStore();
      await store.upsert(buildSpec({ version: '1.0.0' }));
      await store.upsert(buildSpec({ version: '2.0.0' }));
      expect((await store.findById('sc-1'))?.version).toBe('2.0.0');
    });

    it('returns a structuredClone so mutations do not affect the store', async () => {
      const store = new InMemoryScenarioSpecStore();
      const spec = buildSpec();
      await store.upsert(spec);
      const retrieved = await store.findById('sc-1');
      retrieved!.version = 'mutated';
      expect((await store.findById('sc-1'))?.version).toBe('1.0.0');
    });
  });

  describe('findAll', () => {
    it('returns empty array when no specs stored', async () => {
      const store = new InMemoryScenarioSpecStore();
      expect(await store.findAll()).toEqual([]);
    });

    it('returns all stored specs', async () => {
      const store = new InMemoryScenarioSpecStore();
      await store.upsert(buildSpec({ scenario_id: 'sc-1' }));
      await store.upsert(buildSpec({ scenario_id: 'sc-2' }));
      const all = await store.findAll();
      expect(all).toHaveLength(2);
    });

    it('respects the limit parameter', async () => {
      const store = new InMemoryScenarioSpecStore();
      await store.upsert(buildSpec({ scenario_id: 'sc-1' }));
      await store.upsert(buildSpec({ scenario_id: 'sc-2' }));
      await store.upsert(buildSpec({ scenario_id: 'sc-3' }));
      expect(await store.findAll(2)).toHaveLength(2);
    });
  });

  describe('findByDomain', () => {
    it('filters specs by domain', async () => {
      const store = new InMemoryScenarioSpecStore();
      await store.upsert(buildSpec({ scenario_id: 'sc-1', domain: 'checkout' }));
      await store.upsert(buildSpec({ scenario_id: 'sc-2', domain: 'checkout' }));
      await store.upsert(buildSpec({ scenario_id: 'sc-3', domain: 'login' }));

      const checkoutSpecs = await store.findByDomain('checkout');
      expect(checkoutSpecs).toHaveLength(2);
      expect(checkoutSpecs.every((s) => s.domain === 'checkout')).toBe(true);
    });

    it('returns empty array when no specs match domain', async () => {
      const store = new InMemoryScenarioSpecStore();
      await store.upsert(buildSpec({ domain: 'checkout' }));
      expect(await store.findByDomain('login')).toEqual([]);
    });

    it('respects the limit parameter', async () => {
      const store = new InMemoryScenarioSpecStore();
      await store.upsert(buildSpec({ scenario_id: 'sc-1', domain: 'checkout' }));
      await store.upsert(buildSpec({ scenario_id: 'sc-2', domain: 'checkout' }));
      await store.upsert(buildSpec({ scenario_id: 'sc-3', domain: 'checkout' }));
      expect(await store.findByDomain('checkout', 2)).toHaveLength(2);
    });
  });

  describe('remove', () => {
    it('returns false for an unknown scenario_id', async () => {
      const store = new InMemoryScenarioSpecStore();
      expect(await store.remove('nonexistent')).toBe(false);
    });

    it('removes the spec and returns true', async () => {
      const store = new InMemoryScenarioSpecStore();
      await store.upsert(buildSpec());
      expect(await store.remove('sc-1')).toBe(true);
      expect(await store.findById('sc-1')).toBeNull();
    });

    it('does not affect other specs', async () => {
      const store = new InMemoryScenarioSpecStore();
      await store.upsert(buildSpec({ scenario_id: 'sc-1' }));
      await store.upsert(buildSpec({ scenario_id: 'sc-2' }));
      await store.remove('sc-1');
      expect(await store.findById('sc-2')).not.toBeNull();
    });
  });
});
