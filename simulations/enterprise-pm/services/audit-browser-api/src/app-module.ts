// @def.boundary sim-audit-browser-api
// @def.doc authorization-ontology-nested-audit-tracing

/**
 * AppModule + audit-browser 슬라이스 외부 재노출.
 *
 * 본 파일은 exports["./app-module"] entry point. Plan 13a in-process-env 가
 * `@qa-sdk/sim-audit-browser-api/app-module` 로 dynamic import.
 *
 * BFF reduced layer — domain entity / write use-case 미노출. 외부 컴포저는
 * AuditTraceBff / GraphCatalogBff 와 토큰만 알면 충분.
 */
export { AppModule } from "./app.module.js";
export {
  AuditExplorerSliceModule,
  AUDIT_RECORDER,
  GRAPH_RETENTION_INSIGHT_ENDPOINT,
} from "./audit-explorer/audit-explorer.module.js";
export { GraphExplorerSliceModule, AUTHORIZATION_GRAPH_STORE } from "./graph-explorer/graph-explorer.module.js";
export { AUDIT_BROWSER_SLICE_MODULES } from "./audit-browser-slices.registry.js";
export { AuditTraceBff } from "./audit-explorer/presentation/bff/audit-trace.bff.js";
export { GraphCatalogBff } from "./graph-explorer/presentation/bff/graph-catalog.bff.js";
