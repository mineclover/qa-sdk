// @def.boundary sim-canary-controller
// spec 2026-05-02 §6 — DecisionQueryModule wiring smoke test.
// 모듈 컴파일 + DecisionQueryController 해석 + DecisionRingBuffer singleton 보장.

import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { DecisionQueryModule } from './decision-query.module.js';
import { DecisionQueryController } from './decision-query.controller.js';
import { DecisionRingBuffer } from './decision-ring-buffer.js';

describe('DecisionQueryModule wiring (spec §6)', () => {
  it('module compile + controller resolved + ringBuffer singleton', async () => {
    const m = await Test.createTestingModule({ imports: [DecisionQueryModule] })
      .overrideProvider(DecisionRingBuffer)
      .useValue(new DecisionRingBuffer({ maxSize: 50 }))
      .compile();
    expect(m.get(DecisionQueryController)).toBeInstanceOf(DecisionQueryController);
    expect(m.get(DecisionRingBuffer)).toBe(m.get(DecisionRingBuffer));
  });
});
