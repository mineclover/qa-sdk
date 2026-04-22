// @def.boundary sim-document-api
// @def.doc authorization-ontology-bitmap-pipeline

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { DocumentDbModule } from "./document/document-db.module.js";
import { DocumentModule } from "./document/document/document.module.js";
import { VersionModule } from "./document/version/version.module.js";
import { CommentModule } from "./document/comment/comment.module.js";
import { BitmapCacheModule } from "@qa-sdk/sim-bitmap-cache";
import { env } from "./config/env.js";
import { createLogger } from "./lib/logger.js";
import { createSubscriberLogger } from "./lib/bitmap-cache-logger.js";

@Module({
  imports: [
    HealthModule,
    DocumentDbModule.forRoot(),
    DocumentModule,
    VersionModule,
    CommentModule,
    BitmapCacheModule.forRoot({
      redisUrl: env.SIM_REDIS_URL,
      publisherEnabled: false,
      listenerEnabled: true,
      publisherName: "sim-document-api",
      lruMax: 10_000,
      logger: createSubscriberLogger(createLogger("sim-document-api.bitmap-cache")),
    }),
  ],
})
export class AppModule {}
