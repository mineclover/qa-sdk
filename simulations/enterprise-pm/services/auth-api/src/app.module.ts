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
  ],
})
export class AppModule {}
