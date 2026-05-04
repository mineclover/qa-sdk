// @def.boundary sim-audit-browser-api
// audit-recorder write — POST /v1/decisions endpoint.

import { Module } from "@nestjs/common";
import { RecorderWriteController } from "./recorder-write.controller.js";

@Module({
  controllers: [RecorderWriteController],
})
export class RecorderWriteModule {}
