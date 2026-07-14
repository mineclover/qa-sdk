// @def.boundary sim-approval-api
// @def.doc authorization-ontology-bitmap-pipeline

import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import {
  ApprovalDbModule,
  APPROVAL_DB_INSTANCE,
  APPROVAL_REPOSITORY,
  type ApprovalDbInstanceHandle,
} from './approval/approval-db.module.js';
import { APPROVAL_SLICE_MODULES } from './approval/approval-slices.registry.js';
import { AccessCheckerModule } from './auth-deps/access-checker.module.js';
import { BitmapCacheModule } from '@qa-sdk/sim-bitmap-cache';
import { env } from './config/env.js';
import { createLogger } from './lib/logger.js';
import { createSubscriberLogger } from './lib/bitmap-cache-logger.js';
import type { ApprovalRepository } from './approval/shared/port.js';
import { OutboxAdminModule } from './admin/outbox-admin.module.js';

@Module({
  imports: [
    HealthModule,
    ApprovalDbModule.forRoot(),
    AccessCheckerModule.forRootAsync({
      inject: [APPROVAL_DB_INSTANCE, APPROVAL_REPOSITORY],
      useFactory: (...args: unknown[]) => {
        const handle = args[0] as ApprovalDbInstanceHandle;
        const repo = args[1] as ApprovalRepository;
        return { dialect: handle.dialect, db: handle.db, repo };
      },
    }),
    ...APPROVAL_SLICE_MODULES,
    OutboxAdminModule,
    BitmapCacheModule.forRoot({
      redisUrl: env.SIM_REDIS_URL,
      publisherEnabled: false,
      listenerEnabled: true,
      publisherName: 'sim-approval-api',
      lruMax: 10_000,
      logger: createSubscriberLogger(createLogger('sim-approval-api.bitmap-cache')),
    }),
  ],
})
export class AppModule {}
