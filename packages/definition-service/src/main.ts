import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module.js";
import { env } from "./config/env.js";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  app.enableCors({ origin: env.CORS_ORIGIN });

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  console.log(`[definition-service] listening on :${env.PORT}`);
}

bootstrap().catch((err) => {
  console.error("[definition-service] 시작 실패", err);
  process.exit(1);
});
