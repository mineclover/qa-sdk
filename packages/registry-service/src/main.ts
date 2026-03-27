import { initTelemetry } from "@qa-sdk/otel";
import "dotenv/config";
import "reflect-metadata";
import { pathToFileURL } from "node:url";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { WsAdapter } from "@nestjs/platform-ws";
import { createServiceBootConfig, warnPortConflict } from "@qa-sdk/core";
import { env } from "./config/env.js";
import { createLogger } from "./lib/logger.js";
import { RuntimeModule } from "./runtime.module.js";

const logger = createLogger("registry-service");

export async function bootstrapNestApp() {
  // OTel은 NestFactory.create() 전에 초기화 — HTTP instrumentation이 서버를 감지하려면 선행 필수
  const shutdownTelemetry = initTelemetry({ serviceName: "registry-service", env });

  const app = await NestFactory.create<NestFastifyApplication>(
    RuntimeModule,
    new FastifyAdapter(),
  );

  app.enableCors({ origin: env.CORS_ORIGIN });
  app.useWebSocketAdapter(new WsAdapter(app));

  app.enableShutdownHooks();

  await app.listen({ port: env.PORT, host: "0.0.0.0" });

  const serviceConfig = createServiceBootConfig("registry-service");
  logger.info({
    port: env.PORT,
    service: `${serviceConfig.namespace}/${serviceConfig.name}`,
    env: serviceConfig.env,
    region: serviceConfig.region,
    otel: env.OTEL_ENABLED,
  }, "registry-service Nest listening");
  warnPortConflict("registry-service", env.PORT, logger);

  // graceful shutdown 시 OTel flush
  const signals = ["SIGINT", "SIGTERM"] as const;
  for (const signal of signals) {
    process.once(signal, async () => {
      await app.close();
      await shutdownTelemetry();
    });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  bootstrapNestApp().catch((error) => {
    logger.error("Failed to start registry-service Nest app", error);
    process.exit(1);
  });
}
