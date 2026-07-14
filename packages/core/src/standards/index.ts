// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

// ── CloudEvents ────────────────────────────────────────
export type { CloudEvent, EventRecordLike, ManifestRef } from './cloud-events.js';
export {
  toCloudEvent,
  fromCloudEvent,
  serializeCloudEvent,
  deserializeCloudEvent,
  toCloudEventBatch,
  fromCloudEventBatch,
} from './cloud-events.js';

// ── AsyncAPI ──────────────────────────────────────────
export type { AsyncApiOptions, AsyncApiSpec } from './asyncapi-gen.js';
export { generateAsyncApi, asyncApiToYaml, asyncApiToJson } from './asyncapi-gen.js';
