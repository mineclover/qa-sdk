// @def.boundary sim-canary-controller
// @def.doc canary-controller-config

import { Module } from "@nestjs/common";
import { ActionExecutorService } from "./action-executor.service.js";
import { env } from "../config/env.js";

@Module({
  providers: [
    {
      provide: ActionExecutorService,
      useFactory: () =>
        new ActionExecutorService({
          gatewayUrl: env.SIM_GATEWAY_ADMIN_URL,
          composeProject: env.SIM_COMPOSE_PROJECT,
        }),
    },
  ],
  exports: [ActionExecutorService],
})
export class ActionModule {}
