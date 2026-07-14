// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec 01-decision-model §6 — PG advisory lock 기반 active/standby singleton.
//
// db-bootstrap을 사용하지 않는 이유: advisory lock은 PG 세션 스코프이므로
// connection lifetime을 service가 직접 소유해야 한다 (lock 보유 동안 connection 유지).

import { Injectable, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import postgres, { type Sql } from 'postgres';
import { createLogger } from '../lib/logger.js';

export interface AdvisoryLockConfig {
  pgUrl: string;
  lockKey: string;
}

@Injectable()
export class AdvisoryLockService implements OnModuleInit, OnModuleDestroy {
  private sql!: Sql;
  private holding = false;
  private readonly logger = createLogger('sim-canary-controller:lock');

  constructor(private readonly cfg: AdvisoryLockConfig) {}

  async onModuleInit() {
    this.sql = postgres(this.cfg.pgUrl, { max: 1, onnotice: () => {} });
  }

  async onModuleDestroy() {
    try {
      if (this.holding) await this.release();
    } finally {
      await this.sql?.end();
    }
  }

  async tryAcquire(): Promise<boolean> {
    if (this.holding) return true;
    const rows = await this.sql<
      { ok: boolean }[]
    >`SELECT pg_try_advisory_lock(hashtextextended(${this.cfg.lockKey}, 0)) AS ok`;
    const ok = Boolean(rows[0]?.ok);
    if (ok) {
      this.holding = true;
      this.logger.info({ lockKey: this.cfg.lockKey }, 'advisory lock acquired');
    }
    return ok;
  }

  async release(): Promise<void> {
    if (!this.holding) return;
    await this.sql`SELECT pg_advisory_unlock(hashtextextended(${this.cfg.lockKey}, 0))`;
    this.holding = false;
  }

  isHolding(): boolean {
    return this.holding;
  }
}
