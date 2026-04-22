import { Module } from "@nestjs/common";
import { RoleService } from "./role.service.js";
import { RoleController } from "./role.controller.js";

@Module({
  providers: [RoleService],
  controllers: [RoleController],
  exports: [RoleService],
})
export class RoleModule {}
