// @def.boundary decision-service-spec
// @def.doc decision-service-spec

import { Module } from '@nestjs/common';
import { SchemasController } from './schemas.controller.js';
import { SchemasService } from './schemas.service.js';

@Module({
  controllers: [SchemasController],
  providers: [SchemasService],
  exports: [SchemasService],
})
export class SchemasModule {}
