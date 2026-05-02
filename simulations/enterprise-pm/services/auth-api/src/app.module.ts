// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { AuthDbModule } from "./auth/auth-db.module.js";
import { AUTH_SLICE_MODULES } from "./auth/auth-slices.registry.js";
import { BitmapSliceModule } from "./auth/bitmap/bitmap.module.js";
import { BitmapCacheModule } from "@qa-sdk/sim-bitmap-cache";
import { buildBitmapIssuerConfig, env } from "./config/env.js";

/**
 * BitmapSliceModule 은 forRoot(config) 가 유일한 진입점이므로 registry 의
 * 정적 spread 에서 제외하고 service 부팅부에서 명시적으로 주입한다.
 * (registry 파일은 Phase 0 산출물 — 본 변경은 app 단에서 흡수.)
 */
const STATIC_SLICE_MODULES = AUTH_SLICE_MODULES.filter(
  (m) => m !== BitmapSliceModule,
);

@Module({
  imports: [
    HealthModule,
    AuthDbModule.forRoot(),
    ...STATIC_SLICE_MODULES,
    BitmapSliceModule.forRoot(buildBitmapIssuerConfig(env)),
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
