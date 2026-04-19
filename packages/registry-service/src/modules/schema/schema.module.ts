// @def.boundary registry-system
// @def.doc registry-system

import { Module } from "@nestjs/common";
import { SchemaController } from "./schema.controller.js";
import { SchemaService } from "./schema.service.js";

@Module({
  controllers: [SchemaController],
  providers: [SchemaService],
})
export class SchemaModule {}
