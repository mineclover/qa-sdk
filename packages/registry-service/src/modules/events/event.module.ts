// @def.boundary registry-system
// @def.doc registry-system

import { Module } from '@nestjs/common';
import type { SqlDriver } from 'index-meta-store';
import { DATABASE } from '../../database.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { SqlEventSchemaStore } from '../../stores/sql-event-schema-store.js';
import { EventCatalogController } from './event-catalog.controller.js';
import { EventCatalogService } from './event-catalog.service.js';
import { EventSchemaController } from './event-schema.controller.js';
import { EVENT_SCHEMA_STORE, EventSchemaService } from './event-schema.service.js';

@Module({
  imports: [CatalogModule],
  controllers: [EventSchemaController, EventCatalogController],
  providers: [
    {
      provide: EVENT_SCHEMA_STORE,
      useFactory: (db: SqlDriver) => new SqlEventSchemaStore(db),
      inject: [DATABASE],
    },
    EventSchemaService,
    EventCatalogService,
  ],
  exports: [EventSchemaService, EventCatalogService, EVENT_SCHEMA_STORE],
})
export class EventModule {}
