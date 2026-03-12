import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pino from "pino";
import { createApp } from "../../app.js";
import { closeClient, createDb, getClient, type Db } from "../../db/client.js";

const packageRoot = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const testEnvPath = resolve(packageRoot, ".env.test");
const migrationPath = resolve(
  packageRoot,
  "drizzle/0000_kind_doctor_octopus.sql",
);

let testDb: Db | null = null;
let testDatabaseUrl: string | null = null;
let schemaSetupPromise: Promise<void> | null = null;

const parseEnvValue = (source: string, key: string) => {
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const currentKey = line.slice(0, separatorIndex).trim();
    if (currentKey !== key) {
      continue;
    }

    const value = line.slice(separatorIndex + 1).trim();
    return value.replace(/^(['"])(.*)\1$/, "$2");
  }

  return undefined;
};

const getTestDatabaseUrl = async () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const envFile = await readFile(testEnvPath, "utf8");
  const databaseUrl = parseEnvValue(envFile, "DATABASE_URL");
  if (!databaseUrl) {
    throw new Error(`DATABASE_URL is missing from ${testEnvPath}`);
  }

  process.env.DATABASE_URL = databaseUrl;
  return databaseUrl;
};

const hasRequiredTables = async (databaseUrl: string) => {
  const client = getClient(databaseUrl);
  const [row] = await client<{
    services_table: string | null;
    service_events_table: string | null;
  }[]>`
    select
      to_regclass('public.services')::text as services_table,
      to_regclass('public.service_events')::text as service_events_table
  `;

  return row?.services_table !== null && row?.service_events_table !== null;
};

const ensureSchema = async (databaseUrl: string) => {
  if (await hasRequiredTables(databaseUrl)) {
    return;
  }

  const migrationSql = await readFile(migrationPath, "utf8");
  const statements = migrationSql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);

  const client = getClient(databaseUrl);
  for (const statement of statements) {
    await client.unsafe(statement);
  }
};

export async function createTestDb() {
  const databaseUrl = await getTestDatabaseUrl();

  if (!testDb || testDatabaseUrl !== databaseUrl) {
    testDb = createDb(databaseUrl);
    testDatabaseUrl = databaseUrl;
    schemaSetupPromise = null;
  }

  if (!schemaSetupPromise) {
    schemaSetupPromise = ensureSchema(databaseUrl);
  }

  await schemaSetupPromise;
  return testDb;
}

export async function cleanupDb() {
  const databaseUrl = await getTestDatabaseUrl();
  await ensureSchema(databaseUrl);

  const client = getClient(databaseUrl);
  await client.unsafe(
    'TRUNCATE TABLE "service_events", "services" RESTART IDENTITY CASCADE',
  );
}

export async function createTestApp() {
  const db = await createTestDb();
  return createApp(db, {
    logger: pino({ level: "silent" }),
  });
}

export async function closeTestDb() {
  if (!testDatabaseUrl) {
    return;
  }

  const databaseUrl = testDatabaseUrl;
  testDb = null;
  testDatabaseUrl = null;
  schemaSetupPromise = null;
  await closeClient(databaseUrl);
}
