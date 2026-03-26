import { Module } from "@nestjs/common";
import { IntentsController } from "./intents.controller.js";
import { IntentsService } from "./intents.service.js";

@Module({
  controllers: [IntentsController],
  providers: [IntentsService],
  exports: [IntentsService],
})
export class IntentsModule {}
