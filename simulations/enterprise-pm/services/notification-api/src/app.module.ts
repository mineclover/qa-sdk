// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { NotificationDbModule } from "./notification/notification-db.module.js";
import { NOTIFICATION_SLICE_MODULES } from "./notification/notification-slices.registry.js";
import { BitmapCacheModule } from "@qa-sdk/sim-bitmap-cache";
import { env } from "./config/env.js";
import { createLogger } from "./lib/logger.js";
import { createSubscriberLogger } from "./lib/bitmap-cache-logger.js";

@Module({
  imports: [
    HealthModule,
    NotificationDbModule.forRoot(),
    ...NOTIFICATION_SLICE_MODULES,
    BitmapCacheModule.forRoot({
      redisUrl: env.SIM_REDIS_URL,
      publisherEnabled: false,
      listenerEnabled: true,
      publisherName: "sim-notification-api",
      lruMax: 10_000,
      logger: createSubscriberLogger(createLogger("sim-notification-api.bitmap-cache")),
    }),
  ],
})
export class AppModule {}
