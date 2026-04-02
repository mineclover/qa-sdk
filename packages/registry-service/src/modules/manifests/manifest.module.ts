import { Module } from "@nestjs/common";
import { SqliteManifestRegistry } from "pipe-store-sqlite";
import { env } from "../../config/env.js";
import { ManifestController } from "./manifest.controller.js";
import { ManifestService } from "./manifest.service.js";
import { MANIFEST_REGISTRY } from "./manifest.service.js";

@Module({
  controllers: [ManifestController],
  providers: [
    {
      provide: MANIFEST_REGISTRY,
      useFactory: () => new SqliteManifestRegistry(env.SQLITE_PATH),
    },
    ManifestService,
  ],
  exports: [ManifestService],
})
export class ManifestModule {}
