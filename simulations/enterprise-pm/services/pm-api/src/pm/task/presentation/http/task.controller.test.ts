// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { TaskController } from "./task.controller.js";
import { TaskUseCase } from "../../application/use-cases/task.use-case.js";
import { TaskReadModelQuery } from "../../application/queries/task-read-model.query.js";
import { TaskDomainException } from "../../domain/index.js";
import { mapDomainErrorToHttp } from "@qa-sdk/sim-domain-slice-kit";

async function build({
  useCase,
  readModel,
}: {
  useCase: Partial<TaskUseCase>;
  readModel: Partial<TaskReadModelQuery>;
}) {
  const moduleRef = await Test.createTestingModule({
    controllers: [TaskController],
    providers: [
      { provide: TaskUseCase, useValue: useCase },
      { provide: TaskReadModelQuery, useValue: readModel },
    ],
  }).compile();
  return moduleRef.get(TaskController);
}

describe("TaskController", () => {
  it("POST /tasks — 응답 shape", async () => {
    const detail = {
      id: "tsk_1",
      projectId: "prj_1",
      title: "Demo",
      assigneeId: null,
      status: "todo",
      parentTaskId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const useCase = { create: vi.fn(async () => detail) };
    const controller = await build({ useCase, readModel: {} });
    const res = await controller.create({ projectId: "prj_1", title: "Demo" });
    expect(res.title).toBe("Demo");
    expect(useCase.create).toHaveBeenCalled();
  });

  it("GET /tasks/:id — readModel.findDetail 호출", async () => {
    const detail = {
      id: "tsk_1",
      projectId: "prj_1",
      title: "Demo",
      assigneeId: null,
      status: "todo",
      parentTaskId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const controller = await build({
      useCase: {},
      readModel: { findDetail: vi.fn(async () => detail) },
    });
    expect(await controller.get("tsk_1")).toEqual(detail);
  });

  it("GET /tasks/:id 미존재 → NotFoundError 도메인 예외", async () => {
    const controller = await build({
      useCase: {},
      readModel: { findDetail: vi.fn(async () => null) },
    });
    await expect(controller.get("missing")).rejects.toMatchObject({
      name: "NotFoundError",
      code: "TASK_NOT_FOUND",
    });
  });

  it("PUT /tasks/:id — useCase.update 호출", async () => {
    const detail = {
      id: "tsk_1",
      projectId: "prj_1",
      title: "Updated",
      assigneeId: null,
      status: "in_progress",
      parentTaskId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    const useCase = { update: vi.fn(async () => detail) };
    const controller = await build({ useCase, readModel: {} });
    const res = await controller.update("tsk_1", { title: "Updated", status: "in_progress" });
    expect(res.title).toBe("Updated");
  });

  it("GET /tasks/:id/subtasks — readModel.listSubtasks 호출", async () => {
    const subs = [
      {
        id: "tsk_c",
        projectId: "prj_1",
        title: "Child",
        assigneeId: null,
        status: "todo",
        parentTaskId: "tsk_1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const controller = await build({
      useCase: {},
      readModel: { listSubtasks: vi.fn(async () => subs) },
    });
    expect(await controller.subtasks("tsk_1")).toEqual(subs);
  });

  it("도메인 예외가 mapDomainErrorToHttp 로 표준 페이로드 매핑", () => {
    const err = new TaskDomainException("TASK_NOT_FOUND", "missing");
    err.name = "NotFoundError";
    const { status } = mapDomainErrorToHttp(err, "trc_x");
    expect(status).toBe(404);
  });
});
