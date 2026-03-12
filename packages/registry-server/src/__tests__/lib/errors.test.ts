import { describe, expect, it } from "vitest";
import { AppError, conflict, notFound } from "../../lib/errors.js";

describe("AppError", () => {
  it("stores the code, message, and status code", () => {
    const error = new AppError("INVALID_INPUT", "invalid request", 422);

    expect(error.code).toBe("INVALID_INPUT");
    expect(error.message).toBe("invalid request");
    expect(error.statusCode).toBe(422);
  });

  it("builds 404 and 409 helpers with the expected status codes", () => {
    const missing = notFound("SERVICE_NOT_FOUND", "service missing");
    const duplicate = conflict(
      "SERVICE_NAME_CONFLICT",
      "service already exists",
    );

    expect(missing).toBeInstanceOf(AppError);
    expect(missing.statusCode).toBe(404);
    expect(duplicate).toBeInstanceOf(AppError);
    expect(duplicate.statusCode).toBe(409);
  });
});
