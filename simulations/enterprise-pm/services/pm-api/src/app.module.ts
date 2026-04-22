// @def.boundary sim-pm-api
// @def.doc authorization-ontology-bitmap-pipeline

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { PmDbModule } from "./pm/pm-db.module.js";
import { ProjectModule } from "./pm/project/project.module.js";
import { TaskModule } from "./pm/task/task.module.js";
import { MemberModule } from "./pm/member/member.module.js";
import { BitmapCacheModule } from "@qa-sdk/sim-bitmap-cache";
import { env } from "./config/env.js";
import { createLogger } from "./lib/logger.js";
import { createSubscriberLogger } from "./lib/bitmap-cache-logger.js";

@Module({
  imports: [
    HealthModule,
    PmDbModule.forRoot(),
    ProjectModule,
    TaskModule,
    MemberModule,
    BitmapCacheModule.forRoot({
      redisUrl: env.SIM_REDIS_URL,
      publisherEnabled: false,
      listenerEnabled: true,
      publisherName: "sim-pm-api",
      lruMax: 10_000,
      logger: createSubscriberLogger(createLogger("sim-pm-api.bitmap-cache")),
    }),
  ],
})
export class AppModule {}
