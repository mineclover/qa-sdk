// @def.boundary ingest-system
// @def.doc ingest-system

import { Hono } from "hono";
import type { Logger } from "pino";
import { describe, expect, it, vi } from "vitest";
import { createErrorHandler } from "./error-handler.js";
import { requestId } from "./request-id.js";

describe("createErrorHandler", () => {
  it("logs unknown errors with err and requestId while returning a generic 500", async () => {
    const logger = {
      error: vi.fn(),
    } as unknown as Logger;
    const app = new Hono();

    app.use("*", requestId);
    app.get("/boom", () => {
      throw new Error("database password is wrong");
    });
    app.onError(createErrorHandler(logger));

    const response = await app.request("/boom", {
      headers: {
        "x-request-id": "req_ingest_123",
      },
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "internal server error",
      },
    });
    expect(logger.error).toHaveBeenCalledWith(
      {
        err: expect.any(Error),
        requestId: "req_ingest_123",
      },
      "unhandled error",
    );
  });
});
