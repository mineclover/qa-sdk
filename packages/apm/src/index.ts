// ── ApmLogger ───────────────────────────────────────────
export { ApmLogger, createApmLogger } from "./apm-logger.js";
export type { ApmLoggerConfig } from "./config.js";

// ── Address Ranges ──────────────────────────────────────
export { buildAddressRanges } from "./address-ranges.js";
export type { AddressRangeQuery } from "./address-ranges.js";

// ── Re-exports from weighted-index ──────────────────────
export { createBinder, PrefixCodec, calcAddressRanges } from "weighted-index";
export type { PartialBinder, CoordConstraint } from "weighted-index";
