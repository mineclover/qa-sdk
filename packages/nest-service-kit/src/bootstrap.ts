// @def.boundary nest-service-bootstrap
// @def.doc nest-service-bootstrap

import { NestFactory } from "@nestjs/core";
import type { Type } from "@nestjs/common";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { initTelemetry, otelEnvSchema, type OtelEnv } from "@qa-sdk/otel";
import { warnPortConflict } from "@qa-sdk/core";
import { createConsoleServiceLogger, type ServiceLogger } from "./logger.js";

export interface BootstrapNestServiceOptions {
  rootModule: Type<unknown>;
  serviceName: string;
  port: number;
  host?: string;
  corsOrigin?: string;
  logger?: ServiceLogger;
  telemetryEnv?: OtelEnv;
  useWebSocketAdapter?: boolean;
  configureApp?: (app: NestFastifyApplication) => Promise<void> | void;
  startedMeta?: Record<string, unknown>;
}

export interface BootstrapNestServiceResult {
  app: NestFastifyApplication;
  close(signal?: string): Promise<void>;
}

export async function bootstrapNestService(
  options: BootstrapNestServiceOptions,
): Promise<BootstrapNestServiceResult> {
  const logger = options.logger ?? createConsoleServiceLogger(options.serviceName);
  const shutdownTelemetry = initTelemetry({
    serviceName: options.serviceName,
    env: options.telemetryEnv ?? otelEnvSchema.parse(process.env),
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    options.rootModule,
    new FastifyAdapter(),
    { logger: false },
  );
  app.enableShutdownHooks();

  if (options.corsOrigin) {
    app.enableCors({ origin: options.corsOrigin });
  }
  if (options.useWebSocketAdapter) {
    const { WsAdapter } = await import("@nestjs/platform-ws");
    app.useWebSocketAdapter(new WsAdapter(app));
  }

  await options.configureApp?.(app);
  await app.listen({ port: options.port, host: options.host ?? "0.0.0.0" });

  logger.info(
    {
      port: options.port,
      ...(options.startedMeta ?? {}),
    },
    `${options.serviceName} listening`,
  );
  warnPortConflict(options.serviceName, options.port, {
    warn(message: string) {
      logger.warn({}, message);
    },
  });

  const close = async (signal?: string) => {
    logger.info(signal ? { signal } : {}, `${options.serviceName} shutting down`);
    await app.close();
    await shutdownTelemetry();
  };

  process.once("SIGINT", () => void close("SIGINT"));
  process.once("SIGTERM", () => void close("SIGTERM"));

  return { app, close };
}
