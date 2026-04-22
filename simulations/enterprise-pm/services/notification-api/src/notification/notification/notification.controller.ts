// @def.boundary sim-notification-api
// @def.doc sim-erp-pm-design

import { Body, Controller, Get, NotFoundException, Param, Post, Put, Query } from "@nestjs/common";
import { z } from "zod";
import { NotificationService } from "./notification.service.js";
import type { NotificationStatus } from "../shared/types.js";

const createSchema = z.object({
  recipientUserId: z.string().min(1),
  type: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
});

@Controller()
export class NotificationController {
  constructor(private readonly svc: NotificationService) {}

  @Post("notifications")
  async create(@Body() body: unknown) {
    return this.svc.create(createSchema.parse(body));
  }

  @Get("notifications/:id")
  async get(@Param("id") id: string) {
    const n = await this.svc.find(id);
    if (!n) throw new NotFoundException(`Notification not found: ${id}`);
    return n;
  }

  @Get("users/:userId/notifications")
  async listForUser(@Param("userId") userId: string, @Query("status") status: string) {
    const s = status as NotificationStatus | undefined;
    return this.svc.listForUser(userId, s);
  }

  @Put("notifications/:id/sent")
  async markSent(@Param("id") id: string) {
    return this.svc.markSent(id);
  }

  @Put("notifications/:id/read")
  async markRead(@Param("id") id: string) {
    return this.svc.markRead(id);
  }

  @Put("notifications/:id/failed")
  async markFailed(@Param("id") id: string) {
    return this.svc.markFailed(id);
  }
}
