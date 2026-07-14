// @def.boundary sim-canary-controller
// spec 2026-05-02 §5 — CycleScheduler 와 DecisionRingBuffer wiring 정합 검증.
//
// 본 wiring 테스트는 export 정합만 확인한다. history 필드 제거의 실질 검증
// (runCycle 본체에서 ringBuffer.recentSafetyHistory(10) 사용, append 호출 등)은
// D-stage-9 Task 9.13 cycle-flow 통합 테스트가 담당한다.
//
// Plan defect note: 초안 plan 의 `Object.getOwnPropertyDescriptor(prototype, "history")`
// 단언은 class 인스턴스 필드를 관측하지 못하므로 (필드는 prototype 이 아닌 instance 에 있음)
// red 단계에서 항상 통과한다. 따라서 export 존재 단언으로 대체한다.

import { describe, it, expect } from 'vitest';
import { CycleSchedulerService } from './cycle-scheduler.service.js';
import { DecisionRingBuffer } from '../decision/decision-ring-buffer.js';

describe('CycleSchedulerService — ring buffer wiring (spec §5)', () => {
  it('CycleSchedulerService 와 DecisionRingBuffer 가 wiring 된 상태로 export 됨', () => {
    expect(typeof CycleSchedulerService).toBe('function');
    expect(DecisionRingBuffer).toBeDefined();
  });
});
