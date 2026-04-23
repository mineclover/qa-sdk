// @def.boundary nest-service-bootstrap
// @def.doc nest-service-bootstrap

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createAppMock,
  initTelemetryMock,
  otelParseMock,
  warnPortConflictMock,
  wsAdapterCtor,
} = vi.hoisted(() => ({
  createAppMock: vi.fn(),
  initTelemetryMock: vi.fn(),
  otelParseMock: vi.fn(),
  warnPortConflictMock: vi.fn(),
  wsAdapterCtor: vi.fn(),
}));

vi.mock("@nestjs/core", () => ({
  NestFactory: {
    create: createAppMock,
  },
}));

vi.mock("@nestjs/platform-fastify", () => ({
  FastifyAdapter: class FastifyAdapter {},
}));

vi.mock("@nestjs/platform-ws", () => ({
  WsAdapter: wsAdapterCtor,
}));

vi.mock("@qa-sdk/otel", () => ({
  initTelemetry: initTelemetryMock,
  otelEnvSchema: {
    parse: otelParseMock,
  },
}));

vi.mock("@qa-sdk/core", () => ({
  warnPortConflict: warnPortConflictMock,
}));

import { bootstrapNestService } from "./bootstrap.js";

function createMockApp() {
  return {
    enableShutdownHooks: vi.fn(),
    enableCors: vi.fn(),
    useWebSocketAdapter: vi.fn(),
    listen: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
}

describe("bootstrapNestService", () => {
  let processOnce: ReturnType<typeof vi.spyOn<typeof process, "once">>;

  beforeEach(() => {
    processOnce = vi.spyOn(process, "once");
    vi.clearAllMocks();
    processOnce.mockImplementation(() => process);
    otelParseMock.mockReturnValue({ OTEL_ENABLED: true });
  });

  afterEach(() => {
    processOnce.mockRestore();
  });

  it("boots a Fastify Nest service and wires shutdown hooks", async () => {
    const app = createMockApp();
    const shutdownTelemetry = vi.fn(async () => undefined);
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    createAppMock.mockResolvedValue(app);
    initTelemetryMock.mockReturnValue(shutdownTelemetry);

    const result = await bootstrapNestService({
      rootModule: class RootModule {},
      serviceName: "sample-service",
      port: 4400,
      corsOrigin: "*",
      logger,
    });

    expect(initTelemetryMock).toHaveBeenCalledOnce();
    expect(createAppMock).toHaveBeenCalledOnce();
    expect(app.enableShutdownHooks).toHaveBeenCalledOnce();
    expect(app.enableCors).toHaveBeenCalledWith({ origin: "*" });
    expect(app.listen).toHaveBeenCalledWith({ port: 4400, host: "0.0.0.0" });
    expect(processOnce).toHaveBeenNthCalledWith(1, "SIGINT", expect.any(Function));
    expect(processOnce).toHaveBeenNthCalledWith(2, "SIGTERM", expect.any(Function));
    expect(logger.info).toHaveBeenCalledWith({ port: 4400 }, "sample-service listening");

    const conflictLogger = warnPortConflictMock.mock.calls[0]?.[2] as { warn: (message: string) => void };
    expect(conflictLogger).toBeTruthy();
    conflictLogger.warn("port conflict");
    expect(logger.warn).toHaveBeenCalledWith({}, "port conflict");

    await result.close("SIGTERM");
    expect(logger.info).toHaveBeenLastCalledWith({ signal: "SIGTERM" }, "sample-service shutting down");
    expect(app.close).toHaveBeenCalledOnce();
    expect(shutdownTelemetry).toHaveBeenCalledOnce();
  });

  it("installs the WebSocket adapter only when requested", async () => {
    const app = createMockApp();
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const wsAdapter = { kind: "ws-adapter" };

    createAppMock.mockResolvedValue(app);
    initTelemetryMock.mockReturnValue(vi.fn(async () => undefined));
    wsAdapterCtor.mockReturnValue(wsAdapter);

    await bootstrapNestService({
      rootModule: class RootModule {},
      serviceName: "sample-service",
      port: 4401,
      logger,
      useWebSocketAdapter: true,
    });

    expect(wsAdapterCtor).toHaveBeenCalledWith(app);
    expect(app.useWebSocketAdapter).toHaveBeenCalledWith(wsAdapter);
  });
});
