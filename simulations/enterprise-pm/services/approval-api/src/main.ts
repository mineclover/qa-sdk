// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { warnPortConflict } from "@qa-sdk/core";
import { initTelemetry, otelEnvSchema } from "@qa-sdk/otel";
import { createLogger } from "./lib/logger.js";
import { AppModule } from "./app.module.js";
import { env } from "./config/env.js";
import { VersionStampInterceptor } from "./lib/version-stamp.interceptor.js";

const SERVICE_NAME = "sim-approval-api";
const logger = createLogger(SERVICE_NAME);

async function bootstrap() {
  // 1. OTel 부팅 (NestFactory 이전 — HttpInstrumentation이 모든 라우트 포착)
  const otelShutdown = initTelemetry({
    serviceName: SERVICE_NAME,
    env: otelEnvSchema.parse(process.env),
  });

  // 2. NestJS Fastify 부팅
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    // ExceptionFilter 가 catch 한 unhandled error 가 surface 되도록 error/warn level 만
    // NestJS console logger 활성화. 도메인 로깅은 createLogger() pino 가 담당.
    { logger: ["error", "warn"] },
  );
  // 단계 8(Plan C) — 모든 응답에 x-service-version 첨부. spec 02 §4.1.
  app.useGlobalInterceptors(new VersionStampInterceptor());
  app.enableCors({ origin: env.CORS_ORIGIN });

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info(
    { port: env.PORT, dialect: env.QA_DB_DIALECT, ingestUrl: env.QA_INGEST_URL ?? null },
    `${SERVICE_NAME} listening`,
  );
  warnPortConflict(SERVICE_NAME, env.PORT, logger);

  // 3. graceful shutdown — OTel SDK도 함께 닫음
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
