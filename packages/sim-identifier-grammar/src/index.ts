// sim-identifier-grammar — 시뮬 식별자 합성/역분해/검증 grammar 진입점.
// 자세한 정의는 spec: docs/superpowers/specs/2026-04-28-canary-scaling/03-identifier-grammar.md

export {
  buildServicePrefix,
  parseServicePrefix,
  ServicePrefixSchema,
  SERVICE_PREFIX_NAMESPACES,
  SERVICE_PREFIX_CATEGORIES,
  type ServicePrefix,
  type ServicePrefixNamespace,
  type ServicePrefixCategory,
} from "./service-prefix.js";

export {
  buildVersionTag,
  parseVersionTag,
  VersionTagSchema,
  VERSION_TAG_STATES,
  type VersionTag,
  type VersionTagState,
} from "./version-tag.js";

export {
  buildImageTag,
  parseImageTag,
  IMAGE_REGISTRIES,
  type ImageTag,
  type ImageRegistry,
} from "./image-tag.js";

export {
  buildHttpHeader,
  parseHttpHeader,
  HttpHeaderSchema,
  HttpHeaderNameSchema,
  HEADER_DOMAINS,
  type HttpHeader,
  type HeaderDomain,
} from "./http-header.js";

export { buildEventName, parseEventName, type EventName } from "./event-name.js";

export {
  buildSchemaHash,
  verifySchemaHash,
  type SchemaHashInput,
  type CanonicalShape,
} from "./schema-hash.js";

export {
  buildDecisionId,
  parseDecisionId,
  DecisionIdSchema,
  DECISION_PASSES,
  type DecisionId,
  type DecisionPass,
} from "./decision-id.js";

export {
  buildCycleId,
  parseCycleId,
  CycleIdInputSchema,
  CycleIdStringSchema,
  type CycleId,
} from "./cycle-id.js";

export {
  buildLabelKey,
  parseLabelKey,
  LabelKeySchema,
  LabelKeyStringSchema,
  LABEL_KEYS,
  type LabelKey,
  type LabelKeyName,
} from "./label-key.js";

export {
  buildPubsubChannel,
  parsePubsubChannel,
  PubSubChannelSchema,
  PubSubChannelNameSchema,
  PUBSUB_TOPICS,
  type PubSubChannel,
  type PubsubTopic,
} from "./pubsub-channel.js";

export {
  buildBitmapCacheKey,
  parseBitmapCacheKey,
  BitmapCacheKeySchema,
  BITMAP_SCOPES,
  type BitmapCacheKey,
  type BitmapScope,
} from "./cache-key.js";

export {
  buildIdempotencyKey,
  parseIdempotencyKey,
  IdempotencyKeySchema,
  type IdempotencyKey,
  type IdempotencyKeyInput,
} from "./idempotency-key.js";
