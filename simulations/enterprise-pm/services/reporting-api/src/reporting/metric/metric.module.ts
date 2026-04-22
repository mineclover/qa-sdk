import { Module } from "@nestjs/common";
import { MetricService } from "./metric.service.js";
import { MetricController } from "./metric.controller.js";

@Module({
  providers: [MetricService],
  controllers: [MetricController],
  exports: [MetricService],
})
export class MetricModule {}
