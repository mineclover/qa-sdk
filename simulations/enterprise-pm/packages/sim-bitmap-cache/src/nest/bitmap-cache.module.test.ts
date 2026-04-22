// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { BitmapCacheModule } from "./bitmap-cache.module.js";
import { BitmapCacheService } from "../cache-service.js";

describe("BitmapCacheModule (NestJS dynamic)", () => {
  it("forRoot — provider 미활성화 시 BitmapCacheService 주입 + no connect", async () => {
    // publisherEnabled=false, listenerEnabled=false → Redis connect 시도 안 함.
    const moduleRef = await Test.createTestingModule({
      imports: [
        BitmapCacheModule.forRoot({
          redisUrl: "redis://127.0.0.1:6399",
          publisherEnabled: false,
          listenerEnabled: false,
          publisherName: "test",
          logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        }),
      ],
    }).compile();

    const svc = moduleRef.get(BitmapCacheService);
    expect(svc).toBeDefined();
    expect(svc.publisher).toBeUndefined();
    expect(svc.subscriber).toBeUndefined();

    await moduleRef.close();
  });
});
