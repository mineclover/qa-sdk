import { describe, expect, it, vi } from 'vitest';

vi.mock('gsap', () => {
  type TargetLike = {
    style?: Record<string, string>;
    dataset?: Record<string, string>;
    textContent?: string;
    [key: string]: unknown;
  };

  function applySet(
    targets: TargetLike | readonly TargetLike[],
    vars: Record<string, unknown>,
  ): void {
    const list = Array.isArray(targets) ? targets : [targets];
    for (const target of list) {
      if (!target || typeof target !== 'object') continue;
      if (vars.clearProps === 'all' && target.style) {
        for (const key of Object.keys(target.style)) {
          delete target.style[key];
        }
      }
      for (const [key, value] of Object.entries(vars)) {
        if (key === 'clearProps') continue;
        if (
          target.style &&
          ['filter', 'boxShadow', 'background', 'borderColor', 'color'].includes(key)
        ) {
          target.style[key] = String(value);
          continue;
        }
        target[key] = value;
      }
    }
  }

  class MockTimeline {
    private timeSeconds = 0;
    private pausedState: boolean;
    private durationSeconds = 0;

    constructor(
      private readonly options: {
        paused?: boolean;
        repeat?: number;
        onUpdate?: () => void;
        onComplete?: () => void;
      },
    ) {
      this.pausedState = options.paused ?? false;
    }

    paused(): boolean {
      return this.pausedState;
    }

    play(): this {
      this.pausedState = false;
      this.options.onUpdate?.();
      return this;
    }

    pause(): this {
      this.pausedState = true;
      return this;
    }

    restart(): this {
      this.timeSeconds = 0;
      this.pausedState = false;
      this.options.onUpdate?.();
      return this;
    }

    time(value?: number, suppressEvents?: boolean): number | this {
      if (value === undefined) return this.timeSeconds;
      this.timeSeconds = value;
      if (!suppressEvents) {
        this.options.onUpdate?.();
      }
      if (this.durationSeconds > 0 && value >= this.durationSeconds) {
        this.options.onComplete?.();
      }
      return this;
    }

    timeScale(_value: number): this {
      return this;
    }

    repeat(_value: number): this {
      return this;
    }

    progress(): number {
      if (this.durationSeconds <= 0) return 0;
      return Math.min(this.timeSeconds / this.durationSeconds, 1);
    }

    kill(): this {
      this.pausedState = true;
      return this;
    }

    set(target: TargetLike, vars: Record<string, unknown>, _position?: number): this {
      applySet(target, vars);
      return this;
    }

    fromTo(
      _target: TargetLike,
      _fromVars: Record<string, unknown>,
      toVars: Record<string, unknown>,
      position = 0,
    ): this {
      const duration = typeof toVars.duration === 'number' ? toVars.duration : 0;
      this.durationSeconds = Math.max(this.durationSeconds, position + duration);
      return this;
    }

    to(_target: TargetLike, vars: Record<string, unknown>, position = 0): this {
      const duration = typeof vars.duration === 'number' ? vars.duration : 0;
      this.durationSeconds = Math.max(this.durationSeconds, position + duration);
      return this;
    }
  }

  const mockGsap = {
    timeline: (options: {
      paused?: boolean;
      repeat?: number;
      onUpdate?: () => void;
      onComplete?: () => void;
    }) => new MockTimeline(options),
    set: applySet,
  };

  return {
    default: mockGsap,
    gsap: mockGsap,
  };
});

import { resolveMotionComposition } from './model.js';
import { createPromoGridComposition } from './presets.js';
import { createMotionDomStageAdapter, createMotionPlayer } from './runtime.js';

type MockElement = HTMLElement & {
  style: Record<string, string>;
  dataset: Record<string, string>;
  textContent: string;
};

function createMockElement(attrs: Record<string, string> = {}): MockElement {
  return {
    style: {},
    dataset: {},
    textContent: '',
    getAttribute(name: string) {
      return attrs[name] ?? null;
    },
    querySelectorAll() {
      return [];
    },
  } as unknown as MockElement;
}

function createStageRoot(children: readonly MockElement[]): MockElement {
  const root = createMockElement();
  root.querySelectorAll = () => children;
  return root;
}

describe('motion runtime', () => {
  it('maps stage nodes through the adapter and applies resolved assets', () => {
    const headline = createMockElement({ 'data-motion-id': 'headline' });
    const subline = createMockElement({ 'data-motion-id': 'subline' });
    const hero = createMockElement({ 'data-motion-id': 'hero' });
    const chip = createMockElement({ 'data-motion-id': 'chip' });
    const caption = createMockElement();
    const stageRoot = createStageRoot([headline, subline, hero, chip]);
    const adapter = createMotionDomStageAdapter({ stageRoot, captionElement: caption });
    const composition = resolveMotionComposition(createPromoGridComposition(), {
      headline: 'Runtime headline',
      accent: '#00ffaa',
    });

    const player = createMotionPlayer(adapter, composition);

    expect(headline.textContent).toBe('Runtime headline');
    expect(hero.style.borderColor).toBe('#00ffaa');
    expect(chip.style.background).toBe('#00ffaa');

    player.destroy();

    expect(hero.style.borderColor).toBeUndefined();
    expect(chip.style.background).toBeUndefined();
    expect(caption.textContent).toBe('');
  });

  it('clamps transport boundaries and mirrors them in snapshots', () => {
    const caption = createMockElement();
    const stageRoot = createStageRoot([
      createMockElement({ 'data-motion-id': 'hero' }),
      createMockElement({ 'data-motion-id': 'chip' }),
      createMockElement({ 'data-motion-id': 'headline' }),
      createMockElement({ 'data-motion-id': 'subline' }),
      createMockElement({ 'data-motion-id': 'card-a' }),
      createMockElement({ 'data-motion-id': 'card-b' }),
      createMockElement({ 'data-motion-id': 'card-c' }),
      createMockElement({ 'data-motion-id': 'outro' }),
    ]);
    const adapter = createMotionDomStageAdapter({ stageRoot, captionElement: caption });
    const player = createMotionPlayer(
      adapter,
      resolveMotionComposition(createPromoGridComposition('flash')),
    );

    expect(player.snapshot().transport).toEqual({
      playing: false,
      currentTimeMs: 0,
      durationMs: 6600,
      loop: false,
      playbackRate: 1,
    });

    player.seek(-120);
    expect(player.snapshot().transport.currentTimeMs).toBe(0);

    player.setPlaybackRate(0);
    expect(player.snapshot().transport.playbackRate).toBe(1);

    player.play();
    player.seek(9_999);
    expect(player.snapshot().transport).toMatchObject({
      currentTimeMs: 6600,
      playing: false,
      loop: false,
    });

    player.setLoop(true);
    player.play();
    player.seek(4_800);
    expect(player.snapshot().transport).toMatchObject({
      currentTimeMs: 4800,
      playing: true,
      loop: true,
      playbackRate: 1,
    });
    expect(player.snapshot().activeCaptionId).toBe('cap-4');
    expect(caption.textContent).toBe('Transition 이후 CTA를 outro sequence로 분리한다.');
    expect(caption.dataset['tone']).toBe('warning');

    player.pause();
    expect(player.snapshot().transport.playing).toBe(false);

    player.restart();
    expect(player.snapshot().transport).toMatchObject({
      currentTimeMs: 0,
      playing: true,
    });
  });

  it('fires onTimeUpdate callback on play and seek', () => {
    const caption = createMockElement();
    const stageRoot = createStageRoot([
      createMockElement({ 'data-motion-id': 'hero' }),
      createMockElement({ 'data-motion-id': 'chip' }),
      createMockElement({ 'data-motion-id': 'headline' }),
      createMockElement({ 'data-motion-id': 'subline' }),
    ]);
    const adapter = createMotionDomStageAdapter({ stageRoot, captionElement: caption });

    const timeUpdates: number[] = [];
    const player = createMotionPlayer(
      adapter,
      resolveMotionComposition(createPromoGridComposition()),
      {
        onTimeUpdate(timeMs) {
          timeUpdates.push(timeMs);
        },
      },
    );

    player.play();
    expect(timeUpdates.length).toBeGreaterThan(0);

    const before = timeUpdates.length;
    player.seek(3000);
    expect(timeUpdates.length).toBeGreaterThan(before);

    player.destroy();
  });

  it('fires onComplete when non-loop playback reaches end', () => {
    const caption = createMockElement();
    const stageRoot = createStageRoot([
      createMockElement({ 'data-motion-id': 'hero' }),
      createMockElement({ 'data-motion-id': 'chip' }),
      createMockElement({ 'data-motion-id': 'headline' }),
      createMockElement({ 'data-motion-id': 'subline' }),
      createMockElement({ 'data-motion-id': 'card-a' }),
      createMockElement({ 'data-motion-id': 'card-b' }),
      createMockElement({ 'data-motion-id': 'card-c' }),
      createMockElement({ 'data-motion-id': 'outro' }),
    ]);
    const adapter = createMotionDomStageAdapter({ stageRoot, captionElement: caption });

    let completed = false;
    const player = createMotionPlayer(
      adapter,
      resolveMotionComposition(createPromoGridComposition()),
      {
        onComplete() {
          completed = true;
        },
      },
    );

    // 비루프 상태에서 끝까지 seek → onComplete 발화
    player.play();
    player.seek(6600);
    expect(completed).toBe(true);

    // 루프 켜면 끝까지 가도 onComplete 미발화
    completed = false;
    player.setLoop(true);
    player.seek(6600);
    expect(completed).toBe(false);

    player.destroy();
  });

  it('sets destroyed flag and silently ignores calls after destroy', () => {
    const caption = createMockElement();
    const stageRoot = createStageRoot([createMockElement({ 'data-motion-id': 'headline' })]);
    const adapter = createMotionDomStageAdapter({ stageRoot, captionElement: caption });
    const player = createMotionPlayer(
      adapter,
      resolveMotionComposition(createPromoGridComposition()),
    );

    expect(player.destroyed).toBe(false);
    player.destroy();
    expect(player.destroyed).toBe(true);

    // destroy 후 호출해도 에러 없이 무시
    player.play();
    player.pause();
    player.seek(1000);
    player.setLoop(true);
    player.setPlaybackRate(2);
    player.restart();
    player.destroy(); // 이중 destroy도 안전
  });
});
