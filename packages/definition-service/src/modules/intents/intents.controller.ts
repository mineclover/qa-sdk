// @def.doc definition-service

import { Controller, Get, Post, Put, Delete, Inject, Param, Query, Body, NotFoundException } from "@nestjs/common";
import { IntentsService } from "./intents.service.js";

@Controller("intents")
export class IntentsController {
  constructor(@Inject(IntentsService) private readonly intents: IntentsService) {}

  @Get(":prefixId")
  list(@Param("prefixId") prefixId: string) {
    const intents = this.intents.listByPrefix(prefixId);
    return { prefixId, intents, total: intents.length };
  }

  @Get(":prefixId/resolve")
  resolve(@Param("prefixId") prefixId: string, @Query("dims") dims: string = "") {
    const { address, matched } = this.intents.resolve(prefixId, dims);
    return { prefixId, address, matched, total: matched.length };
  }

  @Post(":prefixId")
  create(
    @Param("prefixId") prefixId: string,
    @Body() body: { slice: Record<string, string>; intent: string; observationGoal?: string; owner?: string },
  ) {
    const id = this.intents.create(prefixId, body.slice, body.intent, body.observationGoal, body.owner);
    return { id, prefixId };
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() body: { intent?: string; observationGoal?: string; owner?: string }) {
    this.intents.update(Number(id), body);
    return { ok: true, id: Number(id) };
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    const deleted = this.intents.remove(Number(id));
    if (!deleted) throw new NotFoundException(`의도 ${id} 없음`);
    return { ok: true, id: Number(id) };
  }
}
