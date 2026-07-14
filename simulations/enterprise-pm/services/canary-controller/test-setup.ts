// vitest 환경 — env zod 스키마는 services 부팅 시 1회 파싱되므로 테스트 시 미리 채운다.
// NestJS DI는 emitDecoratorMetadata 가 reflect-metadata 폴리필에 의존한다.
import 'reflect-metadata';

process.env.SIM_DB_WRITE_URL ??= 'postgres://test@localhost:5432/test';
process.env.SIM_METRICS_COLLECTOR_URL ??= 'http://localhost:5200';
process.env.QA_INGEST_URL ??= 'http://localhost:3200';
process.env.SIM_AUDIT_RECORDER_URL ??= 'http://localhost:5100';
process.env.SIM_GATEWAY_ADMIN_URL ??= 'http://localhost:8888';
process.env.SIM_CONTROLLER_CONFIG_PATH ??= new URL(
  './controller-config.yaml',
  `file://${process.cwd()}/`,
).pathname;
