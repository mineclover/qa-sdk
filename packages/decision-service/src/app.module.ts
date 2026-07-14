// @def.boundary decision-service-spec
// @def.doc decision-service-spec

import { Module } from '@nestjs/common';
import { DatabaseModule } from './database.module.js';
import { HealthController } from './health.controller.js';
import { SchemasModule } from './modules/schemas/schemas.module.js';
import { InstancesModule } from './modules/instances/instances.module.js';
import { LinksModule } from './modules/links/links.module.js';

@Module({
  imports: [DatabaseModule, SchemasModule, InstancesModule, LinksModule],
  controllers: [HealthController],
})
export class AppModule {}
