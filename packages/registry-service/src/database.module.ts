// @def.boundary registry-system
// @def.doc registry-system

import { Global, Module } from '@nestjs/common';
import type { SqlDriver } from 'index-meta-store';
import { env } from './config/env.js';
import { createRegistryDatabaseDriver } from './bootstrap/stores.js';

/** DI 토큰 — 문자열 (ESM 호환) */
export const DATABASE = 'DATABASE';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: async (): Promise<SqlDriver> => createRegistryDatabaseDriver(env.SQLITE_PATH),
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
