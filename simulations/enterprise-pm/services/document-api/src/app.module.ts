// @def.boundary sim-document-api
// @def.doc authorization-ontology-bitmap-pipeline

import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { DocumentDbModule } from './document/document-db.module.js';
import { DOCUMENT_SLICE_MODULES } from './document/document-slices.registry.js';
import { BitmapCacheModule } from '@qa-sdk/sim-bitmap-cache';
import { env } from './config/env.js';
import { createLogger } from './lib/logger.js';
import { createSubscriberLogger } from './lib/bitmap-cache-logger.js';

@Module({
  imports: [
    HealthModule,
    DocumentDbModule.forRoot(),
    ...DOCUMENT_SLICE_MODULES,
    BitmapCacheModule.forRoot({
      redisUrl: env.SIM_REDIS_URL,
      publisherEnabled: false,
      listenerEnabled: true,
      publisherName: 'sim-document-api',
      lruMax: 10_000,
      logger: createSubscriberLogger(createLogger('sim-document-api.bitmap-cache')),
    }),
  ],
})
export class AppModule {}
