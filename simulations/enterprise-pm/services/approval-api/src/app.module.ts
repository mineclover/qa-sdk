// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { ApprovalDbModule } from "./approval/approval-db.module.js";
import { BudgetModule } from "./approval/budget/budget.module.js";
import { ResourceModule } from "./approval/resource/resource.module.js";
import { TimeOffModule } from "./approval/timeoff/timeoff.module.js";
import { ExpenseModule } from "./approval/expense/expense.module.js";

@Module({
  imports: [
    HealthModule,
    ApprovalDbModule.forRoot(),
    BudgetModule,
    ResourceModule,
    TimeOffModule,
    ExpenseModule,
  ],
})
export class AppModule {}
