import { Module } from "@nestjs/common";
import { DepartmentService } from "./department.service.js";
import { DepartmentController } from "./department.controller.js";

@Module({
  providers: [DepartmentService],
  controllers: [DepartmentController],
  exports: [DepartmentService],
})
export class DepartmentModule {}
