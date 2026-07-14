// @def.boundary sim-audit-browser-api
// @def.doc authorization-ontology-nested-audit-tracing

/**
 * audit-browser-api 단위 테스트 / 시나리오 runner 공통 부팅 헬퍼.
 *
 * 외부에서 이미 생성된 AuditRecorder 인스턴스를 NestJS DI 에 주입하여
 * 동일 DB 를 공유하는 테스트 환경을 조립한다. env 의존 없음 — caller 가 recorder 를
 * 직접 제공 (예: createInMemorySqliteFixture + createSimAuditRecorder 조합).
 *
 * Plan 13 시나리오 runner 의 in-process 모드:
 *   1. scenarios 의 in-process-env 가 fixture 로 공통 recorder 생성
 *   2. pm-api/approval-api 도 동일 recorder 사용 (test-bootstrap 로 주입)
 *   3. audit-browser-api 는 본 helper 로 같은 recorder 주입 → listByRoot 조회 시
 *      pm-api 가 기록한 audit entry 를 실시간으로 본다
 *
 * BFF reduced layer wiring — domain absent:
 *   - AUDIT_RECORDER / AUTHORIZATION_GRAPH_STORE 토큰을 useValue 로 주입하고,
 *     cross-domain query 어댑터 + BFF + controller 만 등록한다.
 *   - 운영 module 의 useFactory (실 DB 연결) 는 호출하지 않는다.
 */

import { Global, Module, type Provider } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { SLICE_LOGGER_PORT, type LoggerPort } from '@qa-sdk/sim-domain-slice-kit';
import { createInMemorySqliteAuthorizationGraphFixture } from '@qa-sdk/sim-authorization-graph-provider/memory-sqlite-fixture';
import type { AuditRecorder } from 'permission-engine';
import type { AuthorizationGraphStore } from 'authorization-ontology';

import { HealthModule } from './health/health.module.js';
import {
  AUDIT_RECORDER,
  GRAPH_RETENTION_INSIGHT_ENDPOINT,
} from './audit-explorer/audit-explorer.module.js';
import { AUTHORIZATION_GRAPH_STORE } from './graph-explorer/graph-explorer.module.js';
import { AuditRecorderQueryPort } from './audit-explorer/application/ports/audit-recorder-query.port.js';
import { GraphSnapshotQueryPort } from './audit-explorer/application/ports/graph-snapshot-query.port.js';
import { GraphRetentionInsightQueryPort } from './audit-explorer/application/ports/graph-retention-insight.port.js';
import { AuditRecorderQueryAdapter } from './audit-explorer/infrastructure/adapters/audit-recorder-query.adapter.js';
import { GraphSnapshotQueryAdapter } from './audit-explorer/infrastructure/adapters/graph-snapshot-query.adapter.js';
import { GraphRetentionInsightHttpAdapter } from './audit-explorer/infrastructure/adapters/graph-retention-insight.adapter.js';
import { createAuditExplorerLogger } from './audit-explorer/infrastructure/logging/audit-explorer.logger.js';
import { AuditTraceBff } from './audit-explorer/presentation/bff/audit-trace.bff.js';
import { AuditTraceController } from './audit-explorer/presentation/bff/audit-trace.controller.js';
import { GraphStoreQueryPort } from './graph-explorer/application/ports/graph-store-query.port.js';
import { GraphStoreQueryAdapter } from './graph-explorer/infrastructure/adapters/graph-store-query.adapter.js';
import {
  GRAPH_RETENTION_HOUSEKEEPING_OPTIONS,
  GraphRetentionHousekeepingService,
  type GraphRetentionHousekeepingOptions,
} from './graph-explorer/infrastructure/housekeeping/graph-retention-housekeeping.service.js';
import { createGraphExplorerLogger } from './graph-explorer/infrastructure/logging/graph-explorer.logger.js';
import { GraphCatalogBff } from './graph-explorer/presentation/bff/graph-catalog.bff.js';
import { GraphCatalogController } from './graph-explorer/presentation/bff/graph-catalog.controller.js';

export interface BootstrapArgs {
  /** 외부에서 이미 생성된 AuditRecorder. null/undefined 불허. */
  recorder: AuditRecorder;
  /** 외부에서 공유하는 authorization graph store. 미주입 시 in-memory 빈 store. */
  graphStore?: AuthorizationGraphStore;
}

export interface BootstrapHandle {
  app: NestFastifyApplication;
  close: () => Promise<void>;
}

/**
 * Test 전용 audit-explorer 슬라이스 모듈 — 운영 module 의 useFactory (실 DB 연결) 를
 * 피하기 위해 외부 recorder/graph-store 를 useValue 로 직접 주입.
 */
function buildTestAuditExplorerSliceModule(
  recorder: AuditRecorder,
  graphStore: AuthorizationGraphStore,
) {
  const auditExplorerLoggerProvider: Provider = {
    provide: SLICE_LOGGER_PORT,
    useFactory: (): LoggerPort => createAuditExplorerLogger(),
  };
  const recorderQueryProvider: Provider = {
    provide: AuditRecorderQueryPort,
    useValue: new AuditRecorderQueryAdapter(recorder),
  };
  const graphSnapshotQueryProvider: Provider = {
    provide: GraphSnapshotQueryPort,
    useValue: new GraphSnapshotQueryAdapter(graphStore),
  };
  const insightQueryProvider: Provider = {
    provide: GraphRetentionInsightQueryPort,
    useValue: new GraphRetentionInsightHttpAdapter(undefined),
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

  @Global()
  @Module({
    providers: [
      { provide: AUDIT_RECORDER, useValue: recorder },
      { provide: GRAPH_RETENTION_INSIGHT_ENDPOINT, useValue: undefined },
      auditExplorerLoggerProvider,
      recorderQueryProvider,
      graphSnapshotQueryProvider,
      insightQueryProvider,
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
  class TestAuditExplorerSliceModule {}
  return TestAuditExplorerSliceModule;
}

function buildTestGraphExplorerSliceModule(graphStore: AuthorizationGraphStore) {
  const graphStoreQueryProvider: Provider = {
    provide: GraphStoreQueryPort,
    useValue: new GraphStoreQueryAdapter(graphStore),
  };
  const loggerProvider: Provider = {
    provide: SLICE_LOGGER_PORT,
    useFactory: (): LoggerPort => createGraphExplorerLogger(),
  };
  const housekeepingOptionsProvider: Provider = {
    provide: GRAPH_RETENTION_HOUSEKEEPING_OPTIONS,
    useValue: { runOnBoot: false } satisfies GraphRetentionHousekeepingOptions,
  };
  const bffProvider: Provider = {
    provide: GraphCatalogBff,
    useFactory: (graphs: GraphStoreQueryPort, logger: LoggerPort) =>
      new GraphCatalogBff(graphs, logger),
    inject: [GraphStoreQueryPort, SLICE_LOGGER_PORT],
  };

  @Global()
  @Module({
    providers: [
      { provide: AUTHORIZATION_GRAPH_STORE, useValue: graphStore },
      graphStoreQueryProvider,
      loggerProvider,
      housekeepingOptionsProvider,
      GraphRetentionHousekeepingService,
      bffProvider,
    ],
    controllers: [GraphCatalogController],
    exports: [GraphStoreQueryPort, GraphCatalogBff, AUTHORIZATION_GRAPH_STORE],
  })
  class TestGraphExplorerSliceModule {}
  return TestGraphExplorerSliceModule;
}

function buildTestAppModule(recorder: AuditRecorder, graphStore: AuthorizationGraphStore) {
  const TestAuditExplorerSliceModule = buildTestAuditExplorerSliceModule(recorder, graphStore);
  const TestGraphExplorerSliceModule = buildTestGraphExplorerSliceModule(graphStore);
  @Module({
    imports: [HealthModule, TestGraphExplorerSliceModule, TestAuditExplorerSliceModule],
  })
  class TestAppModule {}
  return TestAppModule;
}

export async function bootstrapTestAuditBrowserApi(args: BootstrapArgs): Promise<BootstrapHandle> {
  if (args.recorder === null || args.recorder === undefined) {
    throw new Error('bootstrapTestAuditBrowserApi: recorder required (no fallback)');
  }

  const graphFixture = args.graphStore
    ? null
    : await createInMemorySqliteAuthorizationGraphFixture();
  const TestAppModule = buildTestAppModule(args.recorder, args.graphStore ?? graphFixture!.store);
  const moduleRef = await Test.createTestingModule({
    imports: [TestAppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await app.close();
    graphFixture?.close();
  };

  return { app, close };
}
