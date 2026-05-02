// @def.boundary decision-service-spec
// @def.doc decision-service-spec

import { Body, Controller, Delete, Get, Inject, Param, Post, NotFoundException } from "@nestjs/common";
import { SchemasService } from "./schemas.service.js";

@Controller("schemas")
export class SchemasController {
  constructor(@Inject(SchemasService) private readonly schemas: SchemasService) {}

  @Get()
  list() {
    return { schemas: this.schemas.list() };
  }

  @Get(":schemaId")
  get(@Param("schemaId") schemaId: string) {
    const schema = this.schemas.get(schemaId);
    if (!schema) throw new NotFoundException(`스키마 ${schemaId} 없음`);
    return schema;
  }

  @Post()
  register(@Body() body: {
    schemaId: string;
    name: string;
    description?: string;
    version?: string;
    gates: { id: string; label: string; weight: string; phase: string; branches: { id: string; label: string }[] }[];
    outcomes?: { id: string; label: string }[];
    meta?: Record<string, unknown>;
  }) {
    return this.schemas.register(body);
  }

  @Delete(":schemaId")
  delete(@Param("schemaId") schemaId: string) {
    const deleted = this.schemas.delete(schemaId);
    if (!deleted) throw new NotFoundException(`스키마 ${schemaId} 없음`);
    return { ok: true };
  }
}
