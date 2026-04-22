// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query } from "@nestjs/common";
import { z } from "zod";
import { TaskService } from "./task.service.js";

const createSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  assigneeId: z.string().optional(),
  status: z.enum(["todo", "in_progress", "done", "blocked"]).optional(),
  parentTaskId: z.string().optional(),
});

@Controller("tasks")
export class TaskController {
  constructor(private readonly svc: TaskService) {}

  @Post()
  async create(@Body() body: unknown) {
    return this.svc.create(createSchema.parse(body));
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const t = await this.svc.find(id);
    if (!t) throw new NotFoundException(`Task not found: ${id}`);
    return t;
  }

  @Get()
  async list(@Query("projectId") projectId: string) {
    if (!projectId) throw new NotFoundException("projectId query required");
    return this.svc.listByProject(projectId);
  }

  @Get(":id/subtasks")
  async subtasks(@Param("id") id: string) {
    return this.svc.listSubtasks(id);
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() body: unknown) {
    return this.svc.update(id, createSchema.partial().parse(body));
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.svc.delete(id);
    return { status: "deleted" };
  }
}
