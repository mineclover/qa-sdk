// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * store — DKG SQLite 영속화.
 */

export { DkgSqliteStore } from "./dkg-sqlite-store.js";
export type { NodeSource, CliAuditEventInput, CliAuditEventRow } from "./dkg-sqlite-store.js";

// ── Metric-aware snapshot ──
// collectMetrics + metricsToObservations are passed in to avoid store → convergence dependency

export type {
  AddressUsage,
  CoOccurrence,
  EntryUsage,
  MetricValue,
  UsageData,
  VersionUsage,
} from "./usage-types.js";
