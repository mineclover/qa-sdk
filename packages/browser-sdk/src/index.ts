export { QaMonitor, createQaMonitor, createQaMonitorAsync } from "./monitor.js";
export { BeaconTransport } from "./transport.js";
export type { QaMonitorConfig, AutoCaptureConfig, MonitorSession, MonitorStatus } from "./types.js";

// ── Re-exports for standalone browser usage ──
// 브라우저에서 단일 번들(`qa-browser-sdk.js`)만으로 전체 기능 사용 가능

// ID 생성
export {
  newTransmissionId, newLogId, newTraceId, newSpanId, newQaSessionId,
} from "@qa-sdk/core";

// ServiceBootConfig 파생
export type { ServiceBootConfig } from "@qa-sdk/core";
export {
  toTransmissionSource, toTransmissionBuild, toServiceDims,
  catalogEnvToBuildEnv, buildEnvToCatalogEnv,
} from "@qa-sdk/core";

// ── 좌표 인코딩 (browser-codec 단일 출처) ──
// viz-3d의 browser-codec을 소스 참조 (상대 경로 — vite alias 경유)
export { encode, decode, track, decodeContext } from "../../viz-3d/src/adapter/browser-codec.js";
export type { BrowserCatalog, BrowserPrefixDef, BrowserDimDef, EncodeResult } from "../../viz-3d/src/adapter/browser-codec.js";
export { BROWSER_CATALOG } from "../../viz-3d/src/adapter/demo-catalog-browser.js";
