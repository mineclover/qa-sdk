import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { warnPortConflict } from "@qa-sdk/core";
import { createLogger } from "./lib/logger.js";
import { AppModule } from "./app.module.js";
import { env } from "./config/env.js";

const logger = createLogger("definition-service");

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  app.enableCors({ origin: env.CORS_ORIGIN });

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info({ port: env.PORT }, "definition-service listening");
  warnPortConflict("definition-service", env.PORT, logger);
}

bootstrap().catch((err) => {
  logger.error({ err }, "definition-service 시작 실패");
  process.exit(1);
});
