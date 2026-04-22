// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { AuthDbModule } from "./auth/auth-db.module.js";
import { UserModule } from "./auth/user/user.module.js";
import { DepartmentModule } from "./auth/department/department.module.js";
import { RoleModule } from "./auth/role/role.module.js";
import { RoleAssignmentModule } from "./auth/role-assignment/role-assignment.module.js";
import { BitmapModule } from "./auth/bitmap/bitmap.module.js";
import { AuthenticateModule } from "./auth/authenticate/authenticate.module.js";
import { BitmapCacheModule } from "@qa-sdk/sim-bitmap-cache";
import { env } from "./config/env.js";

@Module({
  imports: [
    HealthModule,
    AuthDbModule.forRoot(),
    UserModule,
    DepartmentModule,
    RoleModule,
    RoleAssignmentModule,
    BitmapModule,
    AuthenticateModule,
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
