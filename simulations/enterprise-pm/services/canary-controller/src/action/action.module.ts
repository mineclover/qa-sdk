// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec 2026-05-02 §7 — ActionExecutor 가 catalog + portRegistry + serviceName 의존.
// spec 2026-05-02 §6 — ActionExecutor 가 ScalePinService + DecisionRingBuffer 의존
//                       (pin 활성화 시 compose --scale SKIP + alert).
//
// CatalogModule 이 SIM_SERVICE_CATALOG / PORT_REGISTRY / SIM_TARGET_SERVICE token 의
// provider 를 등록한다. AdminModule 이 ScalePinService / ScaleStore 를 export.
// CycleModule 이 DecisionRingBuffer 를 export.

import { Module, forwardRef } from "@nestjs/common";
import {
  ActionExecutorService,
  type SimServiceCatalogPort,
  type PortRegistryPort,
} from "./action-executor.service.js";
import { env } from "../config/env.js";
import { AdminModule } from "../admin/admin.module.js";
import { ScalePinService } from "../admin/scale-pin.service.js";
import { CycleModule } from "../cycle/cycle.module.js";
import { DecisionRingBuffer } from "../decision/decision-ring-buffer.js";
import { CatalogModule } from "../catalog/catalog.module.js";
import {
  SIM_SERVICE_CATALOG_TOKEN,
  PORT_REGISTRY_TOKEN,
  SIM_TARGET_SERVICE_TOKEN,
} from "../catalog/tokens.js";

// re-export — 기존 호출부 호환 (catalog/* 모듈에서 import 하던 코드 보존).
export {
  SIM_SERVICE_CATALOG_TOKEN,
  PORT_REGISTRY_TOKEN,
  SIM_TARGET_SERVICE_TOKEN,
};

@Module({
  imports: [CatalogModule, AdminModule, forwardRef(() => CycleModule)],
  providers: [
    {
      provide: ActionExecutorService,
      useFactory: (
        catalog: SimServiceCatalogPort,
        portRegistry: PortRegistryPort,
        serviceName: string,
        pin: ScalePinService,
        ring: DecisionRingBuffer,
      ) =>
        new ActionExecutorService({
          gatewayUrl: env.SIM_GATEWAY_ADMIN_URL,
          composeProject: env.SIM_COMPOSE_PROJECT,
          serviceName,
          catalog,
          portRegistry,
          pin,
          ring,
        }),
      inject: [
        SIM_SERVICE_CATALOG_TOKEN,
        PORT_REGISTRY_TOKEN,
        SIM_TARGET_SERVICE_TOKEN,
        ScalePinService,
        DecisionRingBuffer,
      ],
    },
  ],
  exports: [ActionExecutorService],
})
export class ActionModule {}
