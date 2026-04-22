import { Module } from "@nestjs/common";
import { TaskService } from "./task.service.js";
import { TaskController } from "./task.controller.js";

@Module({
  providers: [TaskService],
  controllers: [TaskController],
  exports: [TaskService],
})
export class TaskModule {}
