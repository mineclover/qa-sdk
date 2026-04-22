// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

export {
  BitmapLruCache,
  makeKey,
  parseKey,
  type BitmapLruCacheOptions,
} from "./lru-cache.js";

export {
  BitmapInvalidationPublisher,
  type BitmapInvalidationPublisherOptions,
} from "./publisher.js";

export {
  BitmapInvalidationSubscriber,
  type BitmapInvalidationSubscriberOptions,
  type SubscriberLogger,
} from "./subscriber.js";

export {
  BitmapCacheService,
  type BitmapCacheServiceOptions,
} from "./cache-service.js";

export {
  invalidationMessageSchema,
  serializeMessage,
  parseMessage,
  INVALIDATION_CHANNEL,
  type InvalidationMessage,
  type Scope,
  type Reason,
} from "./message.js";

export {
  BitmapCacheModule,
  type BitmapCacheModuleOptions,
} from "./nest/bitmap-cache.module.js";
