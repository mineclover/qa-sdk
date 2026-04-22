import { Module } from "@nestjs/common";
import { BudgetService } from "./budget.service.js";
import { BudgetController } from "./budget.controller.js";
import { BudgetAccessService } from "./budget-access.service.js";

@Module({
  providers: [BudgetService, BudgetAccessService],
  controllers: [BudgetController],
  exports: [BudgetService, BudgetAccessService],
})
export class BudgetModule {}
