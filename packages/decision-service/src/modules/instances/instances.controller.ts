import { Body, Controller, Get, Inject, Param, Post, Query, NotFoundException } from "@nestjs/common";
import { InstancesService, type FlowInstanceRecord } from "./instances.service.js";

@Controller("instances")
export class InstancesController {
  constructor(@Inject(InstancesService) private readonly instances: InstancesService) {}

  @Get()
  list(@Query("limit") limit?: string, @Query("offset") offset?: string) {
    return {
      instances: this.instances.list(
        limit ? Number(limit) : 50,
        offset ? Number(offset) : 0,
      ),
    };
  }

  @Get(":id")
  get(@Param("id") id: string) {
    const instance = this.instances.get(id);
    if (!instance) throw new NotFoundException(`인스턴스 ${id} 없음`);
    return instance;
  }

  @Get("schema/:schemaId")
  findBySchema(@Param("schemaId") schemaId: string, @Query("limit") limit?: string) {
    return {
      instances: this.instances.findBySchema(schemaId, limit ? Number(limit) : 50),
    };
  }

  @Post()
  save(@Body() body: FlowInstanceRecord) {
    return this.instances.save(body);
  }
}
