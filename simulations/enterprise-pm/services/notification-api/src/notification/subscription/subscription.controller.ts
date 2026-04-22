// @def.boundary sim-notification-api
// @def.doc sim-erp-pm-design

import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";
import { z } from "zod";
import { SubscriptionService } from "./subscription.service.js";

const createSchema = z.object({
  userId: z.string().min(1),
  eventType: z.string().min(1),
  channel: z.enum(["in_app", "email"]),
  isActive: z.boolean().optional(),
});

const activeSchema = z.object({
  isActive: z.boolean(),
});

@Controller()
export class SubscriptionController {
  constructor(private readonly svc: SubscriptionService) {}

  @Post("subscriptions")
  async create(@Body() body: unknown) {
    return this.svc.create(createSchema.parse(body));
  }

  @Get("users/:userId/subscriptions")
  async listForUser(@Param("userId") userId: string) {
    return this.svc.listForUser(userId);
  }

  @Put("subscriptions/:userId/:eventType/active")
  async setActive(
    @Param("userId") userId: string,
    @Param("eventType") eventType: string,
    @Body() body: unknown,
  ) {
    const { isActive } = activeSchema.parse(body);
    return this.svc.setActive(userId, eventType, isActive);
  }

  @Delete("subscriptions/:userId/:eventType")
  async remove(
    @Param("userId") userId: string,
    @Param("eventType") eventType: string,
  ) {
    await this.svc.delete(userId, eventType);
    return { status: "deleted" };
  }
}
