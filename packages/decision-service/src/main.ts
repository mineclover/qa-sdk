import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { env } from "./config/env.js";
import { createLogger } from "./lib/logger.js";
import { AppModule } from "./app.module.js";

const logger = createLogger("decision-service");

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  app.enableCors({ origin: env.CORS_ORIGIN });
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info({ port: env.PORT }, "decision-service listening");
}

bootstrap().catch((error) => {
  logger.error({ err: error }, "decision-service 시작 실패");
  process.exit(1);
});
