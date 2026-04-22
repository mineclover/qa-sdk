// @def.boundary sim-audit-browser-api
// @def.doc authorization-ontology-nested-audit-tracing

import { Global, Module } from "@nestjs/common";
import {
  AuditExplorerService,
  AUDIT_RECORDER,
} from "./audit-explorer.service.js";
import { AuditExplorerController } from "./audit-explorer.controller.js";
import { createAuditRecorder } from "audit-recorder-store";
import { InMemoryAuditRecorder } from "permission-engine";
import { env } from "../config/env.js";

/**
 * AUDIT_RECORDER provider:
 *   - QA_DB_DIALECT=pg|sqlite + 연결 정보 set → createAuditRecorder(real adapter)
 *   - 미 set → InMemoryAuditRecorder (테스트·부트스트랩 편의)
 *
 * 실제 DB 연결은 Plan 15x migration/boot 단계에서 주입. 본 모듈은 팩토리 본인의
 * async factory만 책임.
 */
@Global()
@Module({
  controllers: [AuditExplorerController],
  providers: [
    AuditExplorerService,
    {
      provide: AUDIT_RECORDER,
      useFactory: async () => {
        // 본 시뮬은 DB 연결 없음(env.QA_DB_DIALECT가 'memory' 등)이면 InMemory.
        // DB 어댑터 활성화는 시나리오 실행 스크립트에서 createConnection 후 주입으로 확장.
        const dialect = (
          env as unknown as { QA_DB_DIALECT?: string }
        ).QA_DB_DIALECT;
        if (dialect === "sqlite" || dialect === "pg") {
          // NOTE: 실 DB connection 주입은 Plan 15 migration 이후 별도 주입 지점 보강.
          // 여기서는 placeholder로 InMemory 반환 (no fallback 원칙 — dialect set이지만
          // db instance 없음을 감지하면 예외).
          throw new Error(
            `AuditExplorerModule: dialect=${dialect} 설정되었으나 db instance 미주입. ` +
              `상위 모듈에서 audit-recorder-store.createAuditRecorder를 직접 주입하세요.`,
          );
        }
        return new InMemoryAuditRecorder();
      },
    },
  ],
  exports: [AuditExplorerService],
})
export class AuditExplorerModule {}
