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
 */

import { Global, Module } from "@nestjs/common";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import type { AuditRecorder } from "permission-engine";
import { HealthModule } from "./health/health.module.js";
import {
  AuditExplorerService,
  AUDIT_RECORDER,
} from "./audit-explorer/audit-explorer.service.js";
import { AuditExplorerController } from "./audit-explorer/audit-explorer.controller.js";

export interface BootstrapArgs {
  /** 외부에서 이미 생성된 AuditRecorder. null/undefined 불허. */
  recorder: AuditRecorder;
}

export interface BootstrapHandle {
  app: NestFastifyApplication;
  close: () => Promise<void>;
}

/**
 * Test 전용 AuditExplorerModule — 운영 module 의 useFactory (실 DB 연결 시도) 를
 * 피하기 위해 외부 recorder 를 useValue 로 직접 주입. AppModule import 하지 않음.
 */
function buildTestAuditExplorerModule(recorder: AuditRecorder) {
  @Global()
  @Module({
    controllers: [AuditExplorerController],
    providers: [
      AuditExplorerService,
      { provide: AUDIT_RECORDER, useValue: recorder },
    ],
    exports: [AuditExplorerService, AUDIT_RECORDER],
  })
  class TestAuditExplorerModule {}
  return TestAuditExplorerModule;
}

function buildTestAppModule(recorder: AuditRecorder) {
  const TestAuditExplorerModule = buildTestAuditExplorerModule(recorder);
  @Module({ imports: [HealthModule, TestAuditExplorerModule] })
  class TestAppModule {}
  return TestAppModule;
}

export async function bootstrapTestAuditBrowserApi(
  args: BootstrapArgs,
): Promise<BootstrapHandle> {
  if (args.recorder === null || args.recorder === undefined) {
    throw new Error(
      "bootstrapTestAuditBrowserApi: recorder required (no fallback)",
    );
  }

  const TestAppModule = buildTestAppModule(args.recorder);
  const moduleRef = await Test.createTestingModule({
    imports: [TestAppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await app.close();
  };

  return { app, close };
}
