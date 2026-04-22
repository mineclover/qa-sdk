// @def.boundary sim-approval-api
// @def.doc authorization-ontology-bitmap-pipeline

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import {
  ApprovalDbModule,
  APPROVAL_DB_INSTANCE,
  type ApprovalDbInstanceHandle,
} from "./approval/approval-db.module.js";
import { BudgetModule } from "./approval/budget/budget.module.js";
import { ResourceModule } from "./approval/resource/resource.module.js";
import { TimeOffModule } from "./approval/timeoff/timeoff.module.js";
import { ExpenseModule } from "./approval/expense/expense.module.js";
import { AccessCheckerModule } from "./auth-deps/access-checker.module.js";
import { BitmapCacheModule } from "@qa-sdk/sim-bitmap-cache";
import { env } from "./config/env.js";
import { createLogger } from "./lib/logger.js";
import { createSubscriberLogger } from "./lib/bitmap-cache-logger.js";

@Module({
  imports: [
    HealthModule,
    ApprovalDbModule.forRoot(),
    AccessCheckerModule.forRootAsync({
      inject: [APPROVAL_DB_INSTANCE],
      useFactory: (...args: unknown[]) => {
        const handle = args[0] as ApprovalDbInstanceHandle;
        return { dialect: handle.dialect, db: handle.db };
      },
    }),
    BudgetModule,
    ResourceModule,
    TimeOffModule,
    ExpenseModule,
    BitmapCacheModule.forRoot({
      redisUrl: env.SIM_REDIS_URL,
      publisherEnabled: false,
      listenerEnabled: true,
      publisherName: "sim-approval-api",
      lruMax: 10_000,
      logger: createSubscriberLogger(createLogger("sim-approval-api.bitmap-cache")),
    }),
  ],
})
export class AppModule {}
