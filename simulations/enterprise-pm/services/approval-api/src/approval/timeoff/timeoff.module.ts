import { Module } from "@nestjs/common";
import { TimeOffService } from "./timeoff.service.js";
import { TimeOffController } from "./timeoff.controller.js";

@Module({
  providers: [TimeOffService],
  controllers: [TimeOffController],
  exports: [TimeOffService],
})
export class TimeOffModule {}
