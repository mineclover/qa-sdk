/**
 * propagation — Registry 발행/활성화.
 */

export type { RegistryPort } from "./registry-port.js";
export { InMemoryRegistry } from "./registry-port.js";
export { RegistryHttpClient } from "./registry-http-client.js";
export { publishSpec } from "./publish.js";
export type { PublishInput, PublishResult } from "./publish.js";
export { seal, activateAndPropagate } from "./lifecycle.js";
export type { SealInput, ActivateInput, ActivateResult } from "./lifecycle.js";
export type { VersionNotification } from "./types.js";
export { checkActivationReadiness } from "./activation-gate.js";
export type { ActivationDiagnostic, ActivationGateResult } from "./activation-gate.js";
export {
  latestVersionKey,
  nextVersionKey,
  bumpVersionString,
  createAxisVersion,
} from "./axis-version-builder.js";
export { addEntryToCatalog } from "./catalog-mutator.js";
export type { CatalogMutationResult } from "./catalog-mutator.js";
export { executeEntryAdd, EntryAddError } from "./entry-add-executor.js";
export type { EntryAddResult, EntryAddOptions } from "./entry-add-executor.js";
