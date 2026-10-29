// @def.boundary registry-system
// @def.doc registry-system

import { Module } from '@nestjs/common';
import type { SqlDriver } from 'index-meta-store';
import { SqliteManifestRegistry } from 'pipe-store-sqlite';
import { DATABASE } from '../../database.module.js';
import { env } from '../../config/env.js';
import { InMemoryServiceComponentVersionStore } from '../../stores/in-memory-service-component-version-store.js';
import { SqlServiceComponentVersionStore } from '../../stores/sql-service-component-version-store.js';
import { ManifestController } from './manifest.controller.js';
import { ManifestService } from './manifest.service.js';
import { SERVICE_COMPONENT_VERSION_STORE } from '../services/service-component.service.js';
import { MANIFEST_REGISTRY } from './manifest.service.js';

@Module({
  controllers: [ManifestController],
  providers: [
    {
      provide: MANIFEST_REGISTRY,
      useFactory: () => new SqliteManifestRegistry(env.SQLITE_PATH),
    },
    {
      provide: SERVICE_COMPONENT_VERSION_STORE,
      useFactory: (db?: SqlDriver) =>
        db ? new SqlServiceComponentVersionStore(db) : new InMemoryServiceComponentVersionStore(),
      inject: [{ token: DATABASE, optional: true }],
    },
    ManifestService,
  ],
  exports: [ManifestService],
})
export class ManifestModule {}
