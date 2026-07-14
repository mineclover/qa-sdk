// @def.boundary sim-canary-controller
// spec 2026-05-02 §6 — DecisionQueryModule.
// CycleModule 이 DecisionRingBuffer 를 export 하므로 imports 만 추가하면 module-level
// singleton 을 그대로 공유한다. controller 만 새로 등록한다.

import { Module } from '@nestjs/common';
import { CycleModule } from '../cycle/cycle.module.js';
import { DecisionQueryController } from './decision-query.controller.js';

@Module({
  imports: [CycleModule],
  controllers: [DecisionQueryController],
})
export class DecisionQueryModule {}
