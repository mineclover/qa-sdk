// @def.boundary sim-canary-controller
// @def.doc canary-controller-config

import { Module } from "@nestjs/common";
import { AdvisoryLockService } from "./advisory-lock.service.js";
import { env } from "../config/env.js";

@Module({
  providers: [
    {
      provide: AdvisoryLockService,
      useFactory: () =>
        new AdvisoryLockService({
          pgUrl: env.SIM_DB_WRITE_URL,
          lockKey: "sim-canary-controller",
        }),
    },
  ],
  exports: [AdvisoryLockService],
})
export class AdvisoryLockModule {}
