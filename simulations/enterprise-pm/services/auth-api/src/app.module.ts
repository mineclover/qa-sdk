// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { AuthDbModule } from "./auth/auth-db.module.js";
import { AUTH_SLICE_MODULES } from "./auth/auth-slices.registry.js";
import { BitmapCacheModule } from "@qa-sdk/sim-bitmap-cache";
import { env } from "./config/env.js";

@Module({
  imports: [
    HealthModule,
    AuthDbModule.forRoot(),
    ...AUTH_SLICE_MODULES,
    // §5 Invalidation Publisher — 권한 변경 시 pub/sub 메시지 발행.
    BitmapCacheModule.forRoot({
      redisUrl: env.SIM_REDIS_URL,
      publisherEnabled: true,
      listenerEnabled: false,
      publisherName: "sim-auth-api",
    }),
  ],
})
export class AppModule {}
