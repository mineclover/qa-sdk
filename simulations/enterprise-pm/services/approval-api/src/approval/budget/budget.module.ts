import { Module } from "@nestjs/common";
import { BudgetService } from "./budget.service.js";
import { BudgetController } from "./budget.controller.js";

@Module({
  providers: [BudgetService],
  controllers: [BudgetController],
  exports: [BudgetService],
})
export class BudgetModule {}
