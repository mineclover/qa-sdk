// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { randomUUID } from "node:crypto";
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseFilters,
} from "@nestjs/common";
import { z } from "zod";
import { DomainExceptionFilter } from "@qa-sdk/sim-domain-slice-kit";
import { TaskUseCase } from "../../application/use-cases/task.use-case.js";
import {
  TaskReadModelQuery,
  type TaskDetailReadModel,
} from "../../application/queries/task-read-model.query.js";
import { TaskDomainException } from "../../domain/index.js";

const createSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  assigneeId: z.string().optional(),
  status: z.enum(["todo", "in_progress", "done", "blocked"]).optional(),
  parentTaskId: z.string().optional(),
});

const updateSchema = createSchema.partial();

/**
 * Task HTTP controller. 기존 routing surface 유지:
 *   - POST /tasks
 *   - GET  /tasks/:id
 *   - GET  /tasks?projectId=...
 *   - GET  /tasks/:id/subtasks
 *   - PUT  /tasks/:id
 *   - DELETE /tasks/:id
 */
@Controller("tasks")
@UseFilters(DomainExceptionFilter)
export class TaskController {
  constructor(
    @Inject(TaskUseCase) private readonly useCase: TaskUseCase,
    @Inject(TaskReadModelQuery) private readonly readModel: TaskReadModelQuery,
  ) {}

  @Post()
  async create(@Body() body: unknown): Promise<TaskDetailReadModel> {
    const parsed = createSchema.parse(body);
    const id = randomUUID();
    return this.useCase.create({
      id,
      projectId: parsed.projectId,
      title: parsed.title,
      assigneeId: parsed.assigneeId,
      status: parsed.status,
      parentTaskId: parsed.parentTaskId,
    });
  }

  @Get(":id/subtasks")
  async subtasks(@Param("id") id: string): Promise<TaskDetailReadModel[]> {
    return this.readModel.listSubtasks(id);
  }

  @Get(":id")
  async get(@Param("id") id: string): Promise<TaskDetailReadModel> {
    const detail = await this.readModel.findDetail(id);
    if (!detail) {
      const err = new TaskDomainException("TASK_NOT_FOUND", `Task not found: ${id}`);
      err.name = "NotFoundError";
      throw err;
    }
    return detail;
  }

  @Get()
  async list(@Query("projectId") projectId: string): Promise<TaskDetailReadModel[]> {
    if (!projectId) throw new NotFoundException("projectId query required");
    return this.readModel.listByProject(projectId);
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() body: unknown): Promise<TaskDetailReadModel> {
    const patch = updateSchema.parse(body);
    return this.useCase.update({
      id,
      patch: {
        projectId: patch.projectId,
        title: patch.title,
        assigneeId: patch.assigneeId,
        status: patch.status,
        parentTaskId: patch.parentTaskId,
      },
    });
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<{ status: "deleted" }> {
    await this.useCase.delete({ id });
    return { status: "deleted" };
  }
}
