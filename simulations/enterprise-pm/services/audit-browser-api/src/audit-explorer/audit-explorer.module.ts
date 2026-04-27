// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

import { Global, Module, type Provider } from "@nestjs/common";
import {
  SLICE_LOGGER_PORT,
  type LoggerPort,
} from "@qa-sdk/sim-domain-slice-kit";
import { createSimAuditRecorder } from "@qa-sdk/sim-audit-recorder-provider";
import { AUDIT_ENTRIES_DDL } from "audit-recorder-store";
import { createConnection } from "db-bootstrap";
import type { AuditRecorder } from "permission-engine";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { AuthorizationGraphStore } from "authorization-ontology";

import { env } from "../config/env.js";
import { AuditRecorderQueryPort } from "./application/ports/audit-recorder-query.port.js";
import { GraphSnapshotQueryPort } from "./application/ports/graph-snapshot-query.port.js";
import { GraphRetentionInsightQueryPort } from "./application/ports/graph-retention-insight.port.js";
import { AuditRecorderQueryAdapter } from "./infrastructure/adapters/audit-recorder-query.adapter.js";
import { GraphSnapshotQueryAdapter } from "./infrastructure/adapters/graph-snapshot-query.adapter.js";
import { GraphRetentionInsightHttpAdapter } from "./infrastructure/adapters/graph-retention-insight.adapter.js";
import { createAuditExplorerLogger } from "./infrastructure/logging/audit-explorer.logger.js";
import { AuditTraceBff } from "./presentation/bff/audit-trace.bff.js";
import { AuditTraceController } from "./presentation/bff/audit-trace.controller.js";
import { AUTHORIZATION_GRAPH_STORE } from "../graph-explorer/graph-explorer.module.js";

/**
 * 외부 인스턴스 토큰 — test-bootstrap 가 같은 토큰으로 useValue 주입.
 *
 * BFF 슬라이스는 자기 aggregate 가 없으므로 audit-recorder 인스턴스를 외부에서
 * 주입받아 cross-domain query 어댑터에 위임한다.
 */
export const AUDIT_RECORDER = Symbol.for(
  "sim-audit-browser-api/audit-explorer/AuditRecorder",
);

/**
 * 외부 ingest URL 토큰 — graph retention insight HTTP 어댑터에 주입.
 * 미설정 시 어댑터가 fail-open (null 반환).
 */
export const GRAPH_RETENTION_INSIGHT_ENDPOINT = Symbol.for(
  "sim-audit-browser-api/audit-explorer/GraphRetentionInsightEndpoint",
);

const auditRecorderProvider: Provider = {
  provide: AUDIT_RECORDER,
  useFactory: async (): Promise<AuditRecorder> => {
    const connection = await createConnection(
      env.QA_DB_DIALECT === "sqlite"
        ? { dialect: "sqlite", sqlitePath: env.QA_SQLITE_PATH }
        : {
            dialect: "pg",
            pgHost: env.QA_PG_HOST!,
            pgPort: env.QA_PG_PORT!,
            pgDatabase: env.QA_PG_DATABASE!,
            pgUser: env.QA_PG_USER!,
            pgPassword: env.QA_PG_PASSWORD!,
            pgSchema: env.QA_PG_SCHEMA ?? "sim",
          },
    );
    // SQLite 경로는 DDL 자동 적용 (in-memory 부팅 대비).
    if (connection.dialect === "sqlite") {
      const raw = (connection.db as BetterSQLite3Database as unknown as {
        $client: { exec: (sql: string) => void };
      }).$client;
      if (raw && typeof raw.exec === "function") {
        raw.exec(AUDIT_ENTRIES_DDL);
      }
    }
    return createSimAuditRecorder({
      dialect: connection.dialect,
      db: connection.db,
    });
  },
};

const recorderQueryProvider: Provider = {
  provide: AuditRecorderQueryPort,
  useFactory: (recorder: AuditRecorder) => new AuditRecorderQueryAdapter(recorder),
  inject: [AUDIT_RECORDER],
};

const graphSnapshotQueryProvider: Provider = {
  provide: GraphSnapshotQueryPort,
  useFactory: (store: AuthorizationGraphStore) => new GraphSnapshotQueryAdapter(store),
  inject: [AUTHORIZATION_GRAPH_STORE],
};

const insightEndpointProvider: Provider = {
  provide: GRAPH_RETENTION_INSIGHT_ENDPOINT,
  useValue: env.QA_INGEST_URL,
};

const insightQueryProvider: Provider = {
  provide: GraphRetentionInsightQueryPort,
  useFactory: (ingestUrl?: string) => new GraphRetentionInsightHttpAdapter(ingestUrl),
  inject: [GRAPH_RETENTION_INSIGHT_ENDPOINT],
};

const loggerProvider: Provider = {
  provide: SLICE_LOGGER_PORT,
  useFactory: (): LoggerPort => createAuditExplorerLogger(),
};

const bffProvider: Provider = {
  provide: AuditTraceBff,
  useFactory: (
    recorders: AuditRecorderQueryPort,
    graphs: GraphSnapshotQueryPort,
    insights: GraphRetentionInsightQueryPort,
    logger: LoggerPort,
  ) => new AuditTraceBff(recorders, graphs, insights, logger),
  inject: [
    AuditRecorderQueryPort,
    GraphSnapshotQueryPort,
    GraphRetentionInsightQueryPort,
    SLICE_LOGGER_PORT,
  ],
};

/**
 * Audit Explorer 슬라이스의 NestJS 모듈 (BFF 슬라이스).
 *
 * BFF 위상 — reduced layer (domain absent):
 *   - aggregate / write 없음, cross-domain read 만 합성
 *   - cross-domain ports: AuditRecorderQueryPort, GraphSnapshotQueryPort,
 *     GraphRetentionInsightQueryPort
 *   - SLICE_LOGGER_PORT 를 본 모듈 안에서 직접 provide
 *   - AUDIT_RECORDER 외부 인스턴스 토큰 (test override 가능)
 *   - GraphSnapshotQueryAdapter 는 graph-explorer 슬라이스의 AUTHORIZATION_GRAPH_STORE
 *     를 in-process 위임 (별도 서비스 분리 시 HTTP client 로 교체)
 */
@Global()
@Module({
  providers: [
    auditRecorderProvider,
    recorderQueryProvider,
    graphSnapshotQueryProvider,
    insightEndpointProvider,
    insightQueryProvider,
    loggerProvider,
    bffProvider,
  ],
  controllers: [AuditTraceController],
  exports: [
    AuditRecorderQueryPort,
    GraphSnapshotQueryPort,
    GraphRetentionInsightQueryPort,
    AuditTraceBff,
    AUDIT_RECORDER,
  ],
})
export class AuditExplorerSliceModule {}
