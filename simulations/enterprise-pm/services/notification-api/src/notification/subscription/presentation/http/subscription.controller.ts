// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

import { Body, Controller, Delete, Get, Inject, Param, Post, Put, UseFilters } from "@nestjs/common";
import { z } from "zod";
import { DomainExceptionFilter } from "@qa-sdk/sim-domain-slice-kit";
import { SubscriptionUseCase } from "../../application/use-cases/subscription.use-case.js";
import {
  SubscriptionReadModelQuery,
  type SubscriptionDetailReadModel,
} from "../../application/queries/subscription-read-model.query.js";

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
@UseFilters(DomainExceptionFilter)
export class SubscriptionController {
  constructor(
    @Inject(SubscriptionUseCase) private readonly useCase: SubscriptionUseCase,
    @Inject(SubscriptionReadModelQuery) private readonly readModel: SubscriptionReadModelQuery,
  ) {}

  @Post("subscriptions")
  async create(@Body() body: unknown) {
    return this.useCase.create(createSchema.parse(body));
  }

  @Get("users/:userId/subscriptions")
  async listForUser(@Param("userId") userId: string): Promise<SubscriptionDetailReadModel[]> {
    return this.readModel.listForUser(userId);
  }

  @Put("subscriptions/:userId/:eventType/active")
  async setActive(
    @Param("userId") userId: string,
    @Param("eventType") eventType: string,
    @Body() body: unknown,
  ) {
    const { isActive } = activeSchema.parse(body);
    return this.useCase.setActive({ userId, eventType, isActive });
  }

  @Delete("subscriptions/:userId/:eventType")
  async remove(
    @Param("userId") userId: string,
    @Param("eventType") eventType: string,
  ) {
    await this.useCase.delete({ userId, eventType });
    return { status: "deleted" };
  }
}
