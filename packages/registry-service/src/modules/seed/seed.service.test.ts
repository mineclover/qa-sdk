import "reflect-metadata";
import { afterEach, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { RuntimeModule } from "../../runtime.module.js";
import {
  createNestTestApp,
  request,
  json,
} from "../../test/nest-helpers.js";

const apps: NestFastifyApplication[] = [];

afterEach(async () => {
  while (apps.length > 0) {
    await apps.pop()!.close();
  }
});

describe("SeedModule (Nest runtime)", () => {
  it("seeds catalog, axis profiles, endpoints, and leaves prefixes empty on startup", async () => {
    const app = await createNestTestApp({ imports: [RuntimeModule] });
    apps.push(app);

    const catalogsResponse = await request(app, "GET", "/catalogs");
    expect(catalogsResponse.statusCode).toBe(200);
    const catalogs = json<Array<{ id: string }>>(catalogsResponse);
    expect(catalogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "demo" }),
        expect.objectContaining({ id: "definition" }),
      ]),
    );

    const prefixesResponse = await request(app, "GET", "/prefixes");
    expect(prefixesResponse.statusCode).toBe(200);
    expect(json<unknown[]>(prefixesResponse)).toEqual([]);

    const axesResponse = await request(app, "GET", "/catalogs/demo/axes");
    expect(axesResponse.statusCode).toBe(200);
    expect(json<Array<{ id: string }>>(axesResponse).length).toBeGreaterThan(0);

    const endpointsResponse = await request(app, "GET", "/api/endpoints?catalog=demo");
    expect(endpointsResponse.statusCode).toBe(200);
    expect(json<Array<{ namespace: string; svcName: string }>>(endpointsResponse).length).toBeGreaterThan(0);
  });
});
