// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec 2026-05-02 §7 — ActionExecutor 가 catalog + portRegistry + serviceName 의존.
// AppModule 이 SIM_SERVICE_CATALOG_TOKEN / PORT_REGISTRY_TOKEN / SIM_TARGET_SERVICE_TOKEN
// 3종 token 의 provider 를 등록한다 (Task 1b.11).

import { Module } from "@nestjs/common";
import {
  ActionExecutorService,
  type SimServiceCatalogPort,
  type PortRegistryPort,
} from "./action-executor.service.js";
import { env } from "../config/env.js";

export const SIM_SERVICE_CATALOG_TOKEN = Symbol("SIM_SERVICE_CATALOG");
export const PORT_REGISTRY_TOKEN = Symbol("PORT_REGISTRY");
export const SIM_TARGET_SERVICE_TOKEN = Symbol("SIM_TARGET_SERVICE");

@Module({
  providers: [
    {
      provide: ActionExecutorService,
      useFactory: (
        catalog: SimServiceCatalogPort,
        portRegistry: PortRegistryPort,
        serviceName: string,
      ) =>
        new ActionExecutorService({
          gatewayUrl: env.SIM_GATEWAY_ADMIN_URL,
          composeProject: env.SIM_COMPOSE_PROJECT,
          serviceName,
          catalog,
          portRegistry,
        }),
      inject: [
        SIM_SERVICE_CATALOG_TOKEN,
        PORT_REGISTRY_TOKEN,
        SIM_TARGET_SERVICE_TOKEN,
      ],
    },
  ],
  exports: [ActionExecutorService],
})
export class ActionModule {}
