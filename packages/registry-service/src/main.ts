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
  const app = await NestFactory.create<NestFastifyApplication>(
    RuntimeModule,
    new FastifyAdapter(),
  );

  app.enableCors({ origin: env.CORS_ORIGIN });
  app.useWebSocketAdapter(new WsAdapter(app));

  await app.listen({ port: env.PORT, host: "0.0.0.0" });

  const serviceConfig = createServiceBootConfig("registry-service");
  logger.info({
    port: env.PORT,
    service: `${serviceConfig.namespace}/${serviceConfig.name}`,
    env: serviceConfig.env,
    region: serviceConfig.region,
  }, "registry-service Nest listening");
  warnPortConflict("registry-service", env.PORT, logger);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  bootstrapNestApp().catch((error) => {
    logger.error("Failed to start registry-service Nest app", error);
    process.exit(1);
  });
}
