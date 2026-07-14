import { describe, expect, it } from 'vitest';
import { createPromoGridComposition } from './presets.js';
import {
  findCaptionById,
  findLayerById,
  findSequenceById,
  findTimeSpanById,
  findTransitionById,
  resolveMotionTransitionWindow,
} from './query.js';

const composition = createPromoGridComposition();

describe('findXxxById', () => {
  it('finds layer by id', () => {
    expect(findLayerById(composition, 'chip')?.label).toBe('Chip');
  });

  it('finds sequence by id', () => {
    expect(findSequenceById(composition, 'intro')?.title).toBe('Intro');
  });

  it('finds caption by id', () => {
    expect(findCaptionById(composition, 'cap-1')?.tone).toBe('neutral');
  });

  it('finds transition by id', () => {
    expect(findTransitionById(composition, 'intro-cards')?.style).toBe('crossfade');
  });

  it('returns undefined for nonexistent id', () => {
    expect(findLayerById(composition, 'nonexistent')).toBeUndefined();
    expect(findSequenceById(composition, 'nonexistent')).toBeUndefined();
    expect(findCaptionById(composition, 'nonexistent')).toBeUndefined();
    expect(findTransitionById(composition, 'nonexistent')).toBeUndefined();
  });
});

describe('findTimeSpanById', () => {
  it('finds layer as MotionTimeSpan', () => {
    const span = findTimeSpanById(composition, 'layer', 'chip');
    expect(span).toMatchObject({ id: 'chip', startMs: 0, durationMs: 1800 });
  });

  it('finds sequence as MotionTimeSpan', () => {
    const span = findTimeSpanById(composition, 'sequence', 'cards');
    expect(span).toMatchObject({ id: 'cards', startMs: 1700, durationMs: 2800 });
  });

  it('finds caption as MotionTimeSpan', () => {
    const span = findTimeSpanById(composition, 'caption', 'cap-2');
    expect(span).toMatchObject({ id: 'cap-2', startMs: 1820, durationMs: 1040 });
  });

  it('returns undefined for nonexistent id regardless of kind', () => {
    expect(findTimeSpanById(composition, 'layer', 'nonexistent')).toBeUndefined();
    expect(findTimeSpanById(composition, 'sequence', 'nonexistent')).toBeUndefined();
    expect(findTimeSpanById(composition, 'caption', 'nonexistent')).toBeUndefined();
  });
});

describe('resolveMotionTransitionWindow', () => {
  it('resolves normal transition window', () => {
    const transition = findTransitionById(composition, 'intro-cards')!;
    const window = resolveMotionTransitionWindow(composition, transition);

    // intro-cards: toSequence=cards starts at 1700, durationMs=360
    expect(window.boundaryMs).toBe(1700);
    expect(window.durationMs).toBe(360);
    expect(window.startMs).toBe(1700 - 360);
    expect(window.maxDurationMs).toBe(1700); // fromSequence intro: 0 ~ 1700
  });

  it('clamps duration to maxDurationMs when exceeding sequence boundary', () => {
    // intro: 0~1700, cards: 1700~4500 — transition 최대 1700ms
    const transition = { ...findTransitionById(composition, 'intro-cards')!, durationMs: 9999 };
    const window = resolveMotionTransitionWindow(composition, transition);

    expect(window.durationMs).toBe(window.maxDurationMs);
    expect(window.startMs).toBe(0); // 1700 - 1700
  });

  it('returns zero duration when from-sequence ends before to-sequence starts', () => {
    // from=cards (1700~4500), to=intro (0~1700) — boundary 0, from 끝(4500) > boundary(0)
    const transition = {
      ...findTransitionById(composition, 'intro-cards')!,
      fromSequenceId: 'cards',
      toSequenceId: 'intro',
    };
    const window = resolveMotionTransitionWindow(composition, transition);

    expect(window.maxDurationMs).toBe(0);
    expect(window.durationMs).toBe(0);
  });
});
