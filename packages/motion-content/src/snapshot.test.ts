import { describe, expect, it } from 'vitest';
import { resolveMotionComposition } from './model.js';
import { createPromoGridComposition } from './presets.js';
import { createMotionDebugSnapshot, resolveMotionAssetSnapshots } from './snapshot.js';

function snapshotAt(timeMs: number) {
  const composition = resolveMotionComposition(createPromoGridComposition());
  return createMotionDebugSnapshot(composition, timeMs, resolveMotionAssetSnapshots(composition));
}

describe('createMotionDebugSnapshot', () => {
  it('detects no active cues at time 0 before any layer starts', () => {
    // 모든 아이템의 startMs >= 0이므로 time 0에서는 chip(0~1800), intro(0~1700) 등이 active
    const snapshot = snapshotAt(0);
    expect(snapshot.activeSequenceIds).toContain('intro');
    expect(snapshot.activeLayerIds).toContain('chip');
  });

  it('detects enter phase at layer start', () => {
    // headline 시작 직후 (startMs=120, enter durationMs=640)
    const snapshot = snapshotAt(130);
    const headline = snapshot.active.layers.find((l) => l.id === 'headline');
    expect(headline).toBeDefined();
    expect(headline!.phase).toBe('enter');
  });

  it('detects hold phase after enter completes', () => {
    // headline: startMs=120, enter 640ms → hold at 800
    const snapshot = snapshotAt(800);
    const headline = snapshot.active.layers.find((l) => l.id === 'headline');
    expect(headline!.phase).toBe('hold');
  });

  it('detects exit phase near layer end', () => {
    // chip: startMs=0, durationMs=1800, exit durationMs=280 → exit starts at ~1520
    const snapshot = snapshotAt(1600);
    const chip = snapshot.active.layers.find((l) => l.id === 'chip');
    expect(chip!.phase).toBe('exit');
  });

  it('returns no active layers/sequences past composition end', () => {
    const snapshot = snapshotAt(7000); // composition durationMs=6600
    expect(snapshot.activeSequenceIds).toHaveLength(0);
    expect(snapshot.activeLayerIds).toHaveLength(0);
    expect(snapshot.activeCaptionId).toBeNull();
  });

  it('detects active caption within its time window', () => {
    // cap-1: startMs=60, durationMs=1460 → 60~1520
    const snapshot = snapshotAt(500);
    expect(snapshot.activeCaptionId).toBe('cap-1');
    expect(snapshot.active.caption).toMatchObject({
      id: 'cap-1',
      tone: 'neutral',
    });
    expect(snapshot.active.caption!.remainingMs).toBe(1520 - 500);
  });

  it('returns null caption between caption windows', () => {
    // cap-1 ends at 1520, cap-2 starts at 1820 → gap at 1600
    const snapshot = snapshotAt(1600);
    expect(snapshot.activeCaptionId).toBeNull();
    expect(snapshot.active.caption).toBeNull();
  });

  it('detects active transitions at boundary', () => {
    // intro-cards: boundary=1700, durationMs=360 → active 1340~1700
    const snapshot = snapshotAt(1500);
    expect(snapshot.timing.activeTransitionIds).toContain('intro-cards');
  });

  it('computes next cue boundary correctly', () => {
    const snapshot = snapshotAt(0);
    // time 0 — 가장 가까운 다음 boundary는 cap-1 start (60)
    expect(snapshot.timing.nextCueChangeMs).toBe(60);
    expect(snapshot.timing.timeToNextCueMs).toBe(60);
  });
});
