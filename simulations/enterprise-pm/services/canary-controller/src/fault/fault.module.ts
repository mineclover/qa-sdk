// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// fault-injector NestJS 모듈 — 4종 fault + Registry + admin-router 단일 진입점.
// Stage 10에서는 in-memory 임시 store로 admin endpoint를 즉시 호출 가능하게 만든다.
// Stage 11 시나리오 runner는 본 모듈을 통해 fault 토글하고 실제 측정 표면(audit-recorder,
// pg replica, metrics-collector gauge)에 주입은 시나리오 작업 시 별도 어댑터로 대체된다.

import {
  Injectable,
  Module,
  type OnModuleDestroy,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { FaultInjector } from "./fault-injector.js";
import {
  AdminFaultController,
  FAULT_INJECTOR_TOKEN,
} from "./admin-fault.controller.js";
import type { Fault, FaultKind } from "./types.js";
import {
  SchemaBreakFault,
  type SchemaBreakStore,
} from "./schema-break.js";
import {
  AuditAnomalyFault,
  type AuditAnomalyStore,
} from "./audit-anomaly.js";
import {
  ReplicationLagFault,
  type PgQueryRunner,
} from "./replication-lag.js";
import {
  DbPoolPressureFault,
  type DbPoolGaugeStore,
} from "./db-pool-pressure.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("sim-canary-controller:fault");

// ---- Stage 10 in-memory placeholder stores ------------------------------------------------
// Stage 11 시나리오 runner가 실제 audit-recorder/pg/metrics-collector 어댑터로 대체.

class InMemorySchemaBreakStore implements SchemaBreakStore {
  private state: { active: boolean; fieldName: string | null } = {
    active: false,
    fieldName: null,
  };
  async setBreak(fieldName: string) {
    this.state = { active: true, fieldName };
  }
  async clearBreak() {
    this.state = { active: false, fieldName: null };
  }
  async readBreak() {
    return { ...this.state };
  }
}

class InMemoryAuditAnomalyStore implements AuditAnomalyStore {
  rows: Array<{ severity: string; reason: string; recordedAt: number }> = [];
  async appendAnomaly(r: (typeof this.rows)[number]) {
    this.rows.push(r);
  }
  async clearInjected() {
    this.rows = [];
  }
}

class NoOpPgQueryRunner implements PgQueryRunner {
  constructor(private readonly label: string) {}
  async query(sql: string, params: unknown[]) {
    logger.debug(
      { label: this.label, sql, params },
      "no-op pg query (Stage 11에서 실제 PG 어댑터로 교체)",
    );
  }
}

class InMemoryDbPoolGaugeStore implements DbPoolGaugeStore {
  state = new Map<string, { active: number; max: number }>();
  async setForcedUtilization(svc: string, active: number, max: number) {
    this.state.set(svc, { active, max });
  }
  async clear(svc?: string) {
    if (svc) this.state.delete(svc);
    else this.state.clear();
  }
}

// ---- FaultInjector wiring ------------------------------------------------------------------

@Injectable()
export class FaultInjectorLifecycle
  implements OnModuleDestroy, OnApplicationShutdown
{
  constructor(private readonly injector: FaultInjector) {}
  async onModuleDestroy() {
    // controller 라이프사이클 종료 시 누수 방지 — spec 05 §3 시나리오 종료 후 reset.
    await this.injector.resetAll();
  }
  async onApplicationShutdown() {
    await this.injector.resetAll();
  }
}

@Module({
  controllers: [AdminFaultController],
  providers: [
    {
      provide: FaultInjector,
      useFactory: () => {
        const registry: Record<FaultKind, Fault> = {
          "schema-break": new SchemaBreakFault(new InMemorySchemaBreakStore()),
          "audit-anomaly": new AuditAnomalyFault(
            new InMemoryAuditAnomalyStore(),
          ),
          "replication-lag": new ReplicationLagFault(
            new NoOpPgQueryRunner("primary"),
            new NoOpPgQueryRunner("replica"),
          ),
          "db-pool-pressure": new DbPoolPressureFault(
            new InMemoryDbPoolGaugeStore(),
          ),
        };
        return new FaultInjector(registry);
      },
    },
    {
      provide: FAULT_INJECTOR_TOKEN,
      useExisting: FaultInjector,
    },
    FaultInjectorLifecycle,
  ],
  exports: [FaultInjector],
})
export class FaultModule {}
