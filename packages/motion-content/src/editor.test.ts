import { describe, expect, it } from 'vitest';
import { createMotionDebugSnapshot, resolveMotionAssetSnapshots } from './editor.js';
import { resolveMotionComposition } from './model.js';
import { createPromoGridComposition } from './presets.js';

describe('motion editor diagnostics', () => {
  it('exposes resolved asset diffs and missing targets', () => {
    const composition = resolveMotionComposition(createPromoGridComposition(), {
      headline: 'Diagnostics headline',
      accent: '#00ffaa',
    });

    const snapshots = resolveMotionAssetSnapshots(composition, {
      'accent-chip': false,
    });

    expect(snapshots.find((asset) => asset.id === 'headline')).toMatchObject({
      value: 'Diagnostics headline',
      defaultValue: 'GSAP Motion Canvas',
      changed: true,
      targetFound: true,
    });
    expect(snapshots.find((asset) => asset.id === 'accent-chip')).toMatchObject({
      property: 'background',
      value: '#00ffaa',
      defaultValue: '#f08f20',
      changed: true,
      targetFound: false,
    });
  });

  it('captures active cues and next timing boundary', () => {
    const composition = resolveMotionComposition(createPromoGridComposition());
    const snapshot = createMotionDebugSnapshot(
      composition,
      1600,
      resolveMotionAssetSnapshots(composition),
    );

    expect(snapshot.activeSequenceIds).toEqual(['intro']);
    expect(snapshot.activeLayerIds).toEqual(['chip', 'headline', 'subline']);
    expect(snapshot.active.layers.find((layer) => layer.id === 'chip')?.phase).toBe('exit');
    expect(snapshot.active.layers.find((layer) => layer.id === 'headline')?.phase).toBe('hold');
    expect(snapshot.active.caption).toBeNull();
    expect(snapshot.timing.activeTransitionIds).toEqual(['intro-cards']);
    expect(snapshot.timing.nextCueChangeMs).toBe(1700);
    expect(snapshot.timing.timeToNextCueMs).toBe(100);
    expect(snapshot.timing.nextCueLabel).toBe('sequence:intro:end');
  });
});
