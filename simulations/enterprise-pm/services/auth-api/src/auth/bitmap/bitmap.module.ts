// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Module } from "@nestjs/common";
import { z } from "zod";
import {
  BitmapIssuerService,
  BITMAP_ISSUER_CONFIG,
  type BitmapIssuerConfig,
} from "./bitmap-issuer.service.js";
import { BitmapController } from "./bitmap.controller.js";

const bitmapEnvSchema = z.object({
  SIM_BITMAP_SECRET: z.string().default("dev-only-bitmap-secret-32-bytes-min!"),
  SIM_BITMAP_TTL_MS: z.coerce.number().int().positive().default(3600_000),
});

@Module({
  providers: [
    BitmapIssuerService,
    {
      provide: BITMAP_ISSUER_CONFIG,
      useFactory: (): BitmapIssuerConfig => {
        const e = bitmapEnvSchema.parse(process.env);
        return {
          secret: new TextEncoder().encode(e.SIM_BITMAP_SECRET),
          ttlMs: e.SIM_BITMAP_TTL_MS,
          issuer: "sim-auth-api",
          version: "v1",
        };
      },
    },
  ],
  controllers: [BitmapController],
  exports: [BitmapIssuerService],
})
export class BitmapModule {}
