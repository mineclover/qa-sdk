import { Module } from "@nestjs/common";
import { ExpenseService } from "./expense.service.js";
import { ExpenseController } from "./expense.controller.js";

@Module({
  providers: [ExpenseService],
  controllers: [ExpenseController],
  exports: [ExpenseService],
})
export class ExpenseModule {}
