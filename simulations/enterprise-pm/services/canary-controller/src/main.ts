// @def.boundary sim-canary-controller
// @def.doc canary-controller-config

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { warnPortConflict } from "@qa-sdk/core";
import { initTelemetry, otelEnvSchema } from "@qa-sdk/otel";
import { createLogger } from "./lib/logger.js";
import { AppModule } from "./app.module.js";
import { env } from "./config/env.js";

const SERVICE_NAME = "sim-canary-controller";
const logger = createLogger(SERVICE_NAME);

async function bootstrap() {
  const otelShutdown = initTelemetry({
    serviceName: SERVICE_NAME,
    env: otelEnvSchema.parse(process.env),
  });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { logger: false },
  );
  app.enableCors({ origin: env.CORS_ORIGIN });
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info(
    {
      port: env.PORT,
      controllerId: env.SIM_CONTROLLER_ID,
      cycleMs: env.SIM_CONTROLLER_CYCLE_MS,
    },
    `${SERVICE_NAME} listening`,
  );
  warnPortConflict(SERVICE_NAME, env.PORT, logger);

  const shutdown = async (signal: string) => {
    logger.info({ signal }, `${SERVICE_NAME} shutting down`);
    await app.close();
    await otelShutdown();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrap().catch((err) => {
  logger.error({ err }, `${SERVICE_NAME} 시작 실패`);
  process.exit(1);
});
