// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { Body, Controller, Get, Inject, Param, Post, Put, UseFilters } from "@nestjs/common";
import { z } from "zod";
import { DomainExceptionFilter } from "@qa-sdk/sim-domain-slice-kit";
import { ResourceUseCase } from "../../application/use-cases/resource.use-case.js";
import { ResourceReadModelQuery } from "../../application/queries/resource-read-model.query.js";
import { ResourceNotFoundException } from "../../domain/resource.exceptions.js";

const createSchema = z.object({
  projectId: z.string().min(1),
  requesterId: z.string().min(1),
  resourceType: z.string().min(1),
  description: z.string().min(1),
});
const statusSchema = z.object({
  status: z.enum(["draft", "submitted", "in_review", "approved", "rejected", "revision_requested"]),
});

@Controller("resource-requests")
@UseFilters(DomainExceptionFilter)
export class ResourceController {
  constructor(
    @Inject(ResourceUseCase) private readonly useCase: ResourceUseCase,
    @Inject(ResourceReadModelQuery) private readonly readModel: ResourceReadModelQuery,
  ) {}

  @Post()
  async create(@Body() body: unknown) {
    const parsed = createSchema.parse(body);
    const id = `rsr_${parsed.projectId}_${parsed.requesterId}_${Date.now().toString(36)}`;
    const r = await this.useCase.create({ id, ...parsed });
    return this.readModel.findDetail(r.id);
  }
  @Get(":id")
  async get(@Param("id") id: string) {
    const r = await this.readModel.findDetail(id);
    if (!r) throw new ResourceNotFoundException(id);
    return r;
  }
  @Put(":id/status")
  async updateStatus(@Param("id") id: string, @Body() body: unknown) {
    const { status } = statusSchema.parse(body);
    await this.useCase.updateStatus({ id, status });
    return this.readModel.findDetail(id);
  }
}
