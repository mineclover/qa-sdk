import { Hono } from "hono";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../lib/errors.js";
import { errorHandler } from "../../middleware/error-handler.js";

function createTestApp() {
  const app = new Hono();

  app.get("/service-not-found", () => {
    throw new AppError(
      "SERVICE_NOT_FOUND",
      "service mobile_app was not found",
      404,
    );
  });

  app.get("/service-conflict", () => {
    throw new AppError(
      "SERVICE_NAME_CONFLICT",
      "service mobile_app already exists",
      409,
    );
  });

  app.get("/invalid-input", (c) => {
    z
      .object({
        body: z.object({
          service_name: z.string().min(1),
          version: z.number().int(),
        }),
      })
      .parse({
        body: {
          service_name: "",
          version: "1",
        },
      });

    return c.json({ ok: true });
  });

  app.get("/internal-error", () => {
    throw new Error("database password is wrong");
  });

  app.onError(errorHandler);

  return app;
}

describe("errorHandler", () => {
  it("returns a 404 payload for SERVICE_NOT_FOUND AppError", async () => {
    const response = await createTestApp().request("/service-not-found");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "SERVICE_NOT_FOUND",
        message: "service mobile_app was not found",
      },
    });
  });

  it("returns a 409 payload for SERVICE_NAME_CONFLICT AppError", async () => {
    const response = await createTestApp().request("/service-conflict");

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "SERVICE_NAME_CONFLICT",
        message: "service mobile_app already exists",
      },
    });
  });

  it("returns INVALID_INPUT with joined field paths for ZodError", async () => {
    const response = await createTestApp().request("/invalid-input");
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: {
        code: "INVALID_INPUT",
      },
    });
    expect(body.error.message).toContain("body.service_name");
    expect(body.error.message).toContain("body.version");
  });

  it("returns INTERNAL_ERROR with a generic 500 response for unknown errors", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await createTestApp().request("/internal-error");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "internal server error",
      },
    });

    consoleError.mockRestore();
  });

  it("does not leak internal error details for unknown errors", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await createTestApp().request("/internal-error");
    const body = await response.json();

    expect(body.error.message).toBe("internal server error");
    expect(JSON.stringify(body)).not.toContain("database password is wrong");

    consoleError.mockRestore();
  });
});
