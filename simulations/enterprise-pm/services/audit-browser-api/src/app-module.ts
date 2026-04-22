// @def.boundary sim-audit-browser-api
// @def.doc authorization-ontology-nested-audit-tracing

/**
 * AppModule / AuditExplorerModule 외부 재노출.
 *
 * 본 파일은 exports["./app-module"] entry point. Plan 13a in-process-env 가
 * `@qa-sdk/sim-audit-browser-api/app-module` 로 dynamic import.
 */
export { AppModule } from "./app.module.js";
export { AuditExplorerModule } from "./audit-explorer/audit-explorer.module.js";
export {
  AuditExplorerService,
  AUDIT_RECORDER,
} from "./audit-explorer/audit-explorer.service.js";
