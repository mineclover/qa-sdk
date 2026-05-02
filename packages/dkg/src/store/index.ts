// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * store — DKG SQLite 영속화.
 */

export { DkgSqliteStore } from "./dkg-sqlite-store.js";
export type { NodeSource, CliAuditEventInput, CliAuditEventRow } from "./dkg-sqlite-store.js";

// ── Metric-aware snapshot ──
// collectMetrics + metricsToObservations are passed in to avoid store → convergence dependency

export type { MetricValue } from "@qa-sdk/convergence";
