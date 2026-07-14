// @def.boundary sim-canary-controller
// spec 2026-05-02 §6 — admin module: compose-proxy + scale (3 endpoint).
// Plan: docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/A-stage-1b-admin-and-fault.md Task 1b.8
//
// 본 모듈은 4 endpoint (compose/replicas + scale/pin GET·POST + scale/replicas) 를 wire 한다.
// ScaleStore / ScalePinService 는 singleton — controller (본 모듈) 와 ActionExecutor (Task
// 1b.10) 가 같은 인스턴스를 inject 받는다.

import { Module } from '@nestjs/common';
import {
  AdminComposeProxyController,
  COMPOSE_EXEC_TOKEN,
  SIM_COMPOSE_PROJECT_TOKEN,
} from './compose-proxy.controller.js';
import { AdminScaleController } from './scale.controller.js';
import { ScaleStore } from './scale-store.js';
import { ScalePinService } from './scale-pin.service.js';
import { dockerComposeExec } from './compose-exec.default.js';
import { env } from '../config/env.js';

@Module({
  controllers: [AdminComposeProxyController, AdminScaleController],
  providers: [
    ScaleStore,
    {
      provide: ScalePinService,
      useFactory: (store: ScaleStore) => new ScalePinService(store),
      inject: [ScaleStore],
    },
    { provide: COMPOSE_EXEC_TOKEN, useValue: dockerComposeExec },
    { provide: SIM_COMPOSE_PROJECT_TOKEN, useValue: env.SIM_COMPOSE_PROJECT },
  ],
  exports: [ScaleStore, ScalePinService, COMPOSE_EXEC_TOKEN, SIM_COMPOSE_PROJECT_TOKEN],
})
export class AdminModule {}
