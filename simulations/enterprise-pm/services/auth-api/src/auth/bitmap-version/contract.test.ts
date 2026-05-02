// @def.boundary sim-auth-api
// spec §10 Stage 3 row — sim-handles bitmap-version-* ↔ admin endpoint shape.
//
// sim-handles factory가 endpoint 응답을 그대로 소비할 수 있는지 contract 검증.
// sim-handles는 source-only이므로 scenarios 패키지에서 직접 import.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { createBitmapVersionMutator } from "../../../../../scenarios/src/runner/sim-handles/bitmap-version-mutator.js";
import { createBitmapVersionCheck } from "../../../../../scenarios/src/runner/sim-handles/bitmap-version-check.js";
import { AdminBitmapVersionController } from "./admin-bitmap-version.controller.js";
import { BitmapVersionService } from "./bitmap-version.service.js";

describe("contract: sim-handles ↔ admin/bitmap (spec §10)", () => {
  let app: NestFastifyApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const m = await Test.createTestingModule({
      controllers: [AdminBitmapVersionController],
      providers: [BitmapVersionService],
    }).compile();
    app = m.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    await app.listen(0, "127.0.0.1");
    const addr = app.getHttpAdapter().getInstance().server.address();
    if (typeof addr !== "object" || !addr) throw new Error("listen addr unknown");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it("mutator → newVersion 매칭", async () => {
    const r = await createBitmapVersionMutator({ authApiUrl: baseUrl })();
    expect(r.newVersion).toMatch(/^v[1-9][0-9]*$/);
  });

  it("check → expected polling 통과", async () => {
    const cur = (await fetch(`${baseUrl}/admin/bitmap/version`).then((r) =>
      r.json(),
    )) as { version: string };
    const r = await createBitmapVersionCheck({
      authApiUrl: baseUrl,
      pollIntervalMs: 10,
    })(cur.version, 1_000);
    expect(["version-check", "ttl"]).toContain(r.recoveredVia);
  });

  it("응답 키 — POST 4 키 / GET 2 키 (spec §9)", async () => {
    const post = await fetch(`${baseUrl}/admin/bitmap/bump-version`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }).then((r) => r.json());
    expect(Object.keys(post as object).sort()).toEqual(
      ["bumpedAt", "newVersion", "oldVersion", "prefix"].sort(),
    );
    const get = await fetch(`${baseUrl}/admin/bitmap/version`).then((r) =>
      r.json(),
    );
    expect(Object.keys(get as object).sort()).toEqual(
      ["prefix", "version"].sort(),
    );
  });
});
