import { afterEach, describe, expect, it, vi } from "vitest";
import pino, { type Destination } from "./index.js";

function createDestination(): { destination: Destination; writes: string[] } {
  const writes: string[] = [];
  return {
    destination: {
      write(message: string) {
        writes.push(message);
      },
    },
    writes,
  };
}

function parseLine(line: string): Record<string, unknown> {
  return JSON.parse(line) as Record<string, unknown>;
}

describe("pino", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("filters out debug logs when the logger level is info", () => {
    const { destination, writes } = createDestination();
    const logger = pino({ level: "info" }, destination);

    logger.debug("hidden");

    expect(writes).toHaveLength(0);

    logger.info("visible");

    expect(writes).toHaveLength(1);
    expect(parseLine(writes[0])).toMatchObject({
      level: "info",
      msg: "visible",
    });
  });

  it("writes structured JSON output with level, time, and msg fields", () => {
    const now = 1_710_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    const { destination, writes } = createDestination();
    const logger = pino({ level: "info" }, destination);

    logger.info("structured log");

    expect(writes).toHaveLength(1);
    expect(writes[0].endsWith("\n")).toBe(true);
    expect(parseLine(writes[0])).toMatchObject({
      level: "info",
      time: now,
      msg: "structured log",
    });
  });

  it("merges child bindings with inherited parent bindings", () => {
    const { destination, writes } = createDestination();
    const logger = pino(
      {
        base: {
          service: "registry-server",
        },
        level: "info",
      },
      destination,
    );

    logger.child({ requestId: "req-123" }).info({ route: "/health" }, "handled");

    expect(writes).toHaveLength(1);
    expect(parseLine(writes[0])).toMatchObject({
      service: "registry-server",
      requestId: "req-123",
      route: "/health",
      level: "info",
      msg: "handled",
    });
  });

  it("serializes error objects with type, message, and stack fields", () => {
    const { destination, writes } = createDestination();
    const logger = pino({ level: "error" }, destination);
    const error = new TypeError("boom");

    logger.error(error, "request failed");

    expect(writes).toHaveLength(1);
    expect(parseLine(writes[0])).toMatchObject({
      level: "error",
      msg: "request failed",
      err: {
        type: "TypeError",
        message: "boom",
      },
    });
    expect(parseLine(writes[0]).err).toEqual(
      expect.objectContaining({
        stack: expect.stringContaining("TypeError: boom"),
      }),
    );
  });

  it("does not write any output at silent level", () => {
    const { destination, writes } = createDestination();
    const logger = pino({ level: "silent" }, destination);

    logger.info("ignored");
    logger.error(new Error("ignored too"));
    logger.fatal("ignored as well");

    expect(writes).toHaveLength(0);
  });
});
