// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { PmDbModule } from "./pm/pm-db.module.js";
import { ProjectModule } from "./pm/project/project.module.js";
import { TaskModule } from "./pm/task/task.module.js";
import { MemberModule } from "./pm/member/member.module.js";

@Module({
  imports: [HealthModule, PmDbModule.forRoot(), ProjectModule, TaskModule, MemberModule],
})
export class AppModule {}
