import { describe, expect, it } from 'vitest';
import {
  applyMotionTemplate,
  createMotionStageNodeTarget,
  resolveMotionComposition,
  resolveMotionCompositionV2,
} from './model.js';
import type { MotionCompositionDefV2 } from './model.js';
import { createPromoGridComposition } from './presets.js';

describe('motion composition model', () => {
  it('resolves overrides while keeping parameter defaults as the SSOT', () => {
    const composition = resolveMotionComposition(createPromoGridComposition('lift'), {
      headline: 'Override headline',
      accent: '#00ffaa',
      unknown: 'ignored',
    });

    expect(composition.values).toMatchObject({
      headline: 'Override headline',
      subline: 'Scene · Sequence · Caption · Transition',
      accent: '#00ffaa',
      transitionStyle: 'crossfade',
    });
    expect(composition.values['unknown']).toBeUndefined();
  });

  it('renders templates with empty fallback and standardizes stage-node targets', () => {
    expect(createMotionStageNodeTarget('hero')).toEqual({
      kind: 'stage-node',
      nodeId: 'hero',
    });
    expect(
      applyMotionTemplate('{{headline}} / {{missing}}', {
        headline: 'Motion Canvas',
      }),
    ).toBe('Motion Canvas / ');
  });

  it('defines a v2 composition where scenes own relative placements and may overlap', () => {
    const composition = resolveMotionCompositionV2({
      id: 'promo-v2',
      title: 'Promo V2',
      description: 'targets와 scenes를 분리한 composition',
      durationMs: 3200,
      parameters: [],
      assets: [],
      targets: [
        {
          id: 'hero',
          target: createMotionStageNodeTarget('hero'),
          content: { type: 'dom' },
        },
        {
          id: 'badge',
          target: createMotionStageNodeTarget('badge'),
          content: { type: 'svg', viewBox: '0 0 24 24' },
        },
      ],
      scenes: [
        {
          id: 'intro',
          title: 'Intro',
          startMs: 0,
          durationMs: 1800,
          layers: [
            {
              targetId: 'hero',
              startMs: 0,
              durationMs: 1200,
              enter: { kind: 'fade', durationMs: 280 },
              exit: { kind: 'slide-left', durationMs: 220, amount: 32 },
            },
          ],
          sequences: [
            {
              id: 'intro-seq',
              title: 'Hero hold',
              startMs: 0,
              durationMs: 1200,
              targetIds: ['hero'],
              layers: [{ targetId: 'hero', role: 'content', zIndex: 1 }],
              captionIds: ['cap-1'],
            },
          ],
          captions: [
            {
              id: 'cap-1',
              text: 'Scene relative caption',
              startMs: 160,
              durationMs: 720,
              tone: 'accent',
            },
          ],
        },
        {
          id: 'overlap',
          title: 'Overlap',
          startMs: 900,
          durationMs: 1400,
          layers: [
            {
              targetId: 'badge',
              startMs: 120,
              durationMs: 700,
              enter: { kind: 'scale-pop', durationMs: 240, amount: 0.92 },
            },
          ],
          sequences: [
            {
              id: 'badge-seq',
              title: 'Badge reveal',
              startMs: 0,
              durationMs: 800,
              targetIds: ['badge'],
              layers: [{ targetId: 'badge', role: 'accent', zIndex: 3 }],
            },
          ],
          captions: [],
        },
      ],
    } satisfies MotionCompositionDefV2);

    expect(composition.values).toEqual({});
    expect(composition.targets.map((target) => target.id)).toEqual(['hero', 'badge']);
    expect(composition.scenes[0]?.layers[0]).toMatchObject({
      targetId: 'hero',
      startMs: 0,
      durationMs: 1200,
    });
    expect(composition.scenes[0]?.sequences[0]?.targetIds).toEqual(['hero']);
    expect(composition.scenes[1]?.startMs).toBeLessThan(
      (composition.scenes[0]?.startMs ?? 0) + (composition.scenes[0]?.durationMs ?? 0),
    );
  });
});
