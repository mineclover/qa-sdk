import { Module } from "@nestjs/common";
import { RoleAssignmentService } from "./role-assignment.service.js";
import { RoleAssignmentController } from "./role-assignment.controller.js";

@Module({
  providers: [RoleAssignmentService],
  controllers: [RoleAssignmentController],
  exports: [RoleAssignmentService],
})
export class RoleAssignmentModule {}
