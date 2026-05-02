// @def.boundary registry-system
// @def.doc registry-system

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  UseFilters,
} from "@nestjs/common";
import { badRequest } from "../../lib/errors.js";
import { PrefixExceptionFilter } from "../prefixes/prefix.exception-filter.js";
import { SchemaService } from "./schema.service.js";

@UseFilters(new PrefixExceptionFilter())
@Controller("schema")
export class SchemaController {
  constructor(@Inject(SchemaService) private readonly schemas: SchemaService) {}

  @HttpCode(201)
  @Post("import")
  importSchema(@Body() body: unknown) {
    return this.schemas.importSchema(body);
  }

  @Get("export")
  exportSchema(@Query("versionId") versionId?: string) {
    return this.schemas.exportSchema(versionId);
  }

  @Get("diff")
  diff(@Query("from") fromVersionId?: string, @Query("to") toVersionId?: string) {
    if (!fromVersionId || !toVersionId) {
      throw badRequest("from, to 필수");
    }
    return this.schemas.diff(fromVersionId, toVersionId);
  }
}
