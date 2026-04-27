// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { Body, Controller, Get, Inject, Param, Post, Put, Query, UseFilters } from "@nestjs/common";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { DomainExceptionFilter } from "@qa-sdk/sim-domain-slice-kit";
import { NotificationUseCase } from "../../application/use-cases/notification.use-case.js";
import {
  NotificationReadModelQuery,
  type NotificationDetailReadModel,
  type NotificationListItemReadModel,
} from "../../application/queries/notification-read-model.query.js";
import { NotificationNotFoundException } from "../../domain/notification.exceptions.js";

const createSchema = z.object({
  recipientUserId: z.string().min(1),
  type: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  idempotencyKey: z.string().optional(),
});

interface NotificationCreatedResponse {
  readonly id: string;
  readonly status: string;
}

/**
 * Notification HTTP controller.
 *
 * - POST /notifications — create
 * - GET  /notifications/:id — detail
 * - GET  /users/:userId/notifications — list (status 필터)
 * - PUT  /notifications/:id/sent | read | failed — 상태 전이
 */
@Controller()
@UseFilters(DomainExceptionFilter)
export class NotificationController {
  constructor(
    @Inject(NotificationUseCase) private readonly useCase: NotificationUseCase,
    @Inject(NotificationReadModelQuery) private readonly readModel: NotificationReadModelQuery,
  ) {}

  @Post("notifications")
  async create(@Body() body: unknown): Promise<NotificationCreatedResponse> {
    const parsed = createSchema.parse(body);
    const id = parsed.idempotencyKey ?? randomUUID();
    const result = await this.useCase.create({
      id,
      recipientUserId: parsed.recipientUserId,
      type: parsed.type,
      title: parsed.title,
      body: parsed.body,
    });
    return { id: result.id, status: result.status };
  }

  @Get("notifications/:id")
  async get(@Param("id") id: string): Promise<NotificationDetailReadModel> {
    const detail = await this.readModel.findDetail(id);
    if (!detail) {
      throw new NotificationNotFoundException(id);
    }
    return detail;
  }

  @Get("users/:userId/notifications")
  async listForUser(
    @Param("userId") userId: string,
    @Query("status") status?: string,
  ): Promise<NotificationListItemReadModel[]> {
    return this.readModel.listForUser(userId, status);
  }

  @Put("notifications/:id/sent")
  async markSent(@Param("id") id: string): Promise<NotificationCreatedResponse> {
    const result = await this.useCase.markSent({ id });
    return { id: result.id, status: result.status };
  }

  @Put("notifications/:id/read")
  async markRead(@Param("id") id: string): Promise<NotificationCreatedResponse> {
    const result = await this.useCase.markRead({ id });
    return { id: result.id, status: result.status };
  }

  @Put("notifications/:id/failed")
  async markFailed(@Param("id") id: string): Promise<NotificationCreatedResponse> {
    const result = await this.useCase.markFailed({ id });
    return { id: result.id, status: result.status };
  }
}
