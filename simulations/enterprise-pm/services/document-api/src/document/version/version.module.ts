import { Module } from "@nestjs/common";
import { VersionService } from "./version.service.js";
import { VersionController } from "./version.controller.js";

@Module({
  providers: [VersionService],
  controllers: [VersionController],
  exports: [VersionService],
})
export class VersionModule {}
