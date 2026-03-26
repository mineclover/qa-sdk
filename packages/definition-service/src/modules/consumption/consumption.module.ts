import { Module } from "@nestjs/common";
import { ConsumptionController } from "./consumption.controller.js";
import { ConsumptionService } from "./consumption.service.js";

@Module({
  controllers: [ConsumptionController],
  providers: [ConsumptionService],
  exports: [ConsumptionService],
})
export class ConsumptionModule {}
