import { closeClient, createDb, getClient, type Db } from "../../db/client.js";

const tableSetupStatements = [
  `create table if not exists "qa_sessions" (
    "session_id" text primary key,
    "scenario_id" text,
    "labels" jsonb,
    "started_at" timestamp with time zone not null default now(),
    "closed_at" timestamp with time zone
  )`,
  `create table if not exists "traces" (
    "trace_id" text primary key,
    "session_id" text references "qa_sessions"("session_id"),
    "service_name" text,
    "record_count" integer not null default 0,
    "first_timestamp" timestamp with time zone,
    "last_timestamp" timestamp with time zone,
    "reconstructed" boolean not null default false,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
  )`,
  `create table if not exists "event_records" (
    "log_id" text primary key,
    "trace_id" text not null references "traces"("trace_id"),
    "span_id" text not null,
    "parent_span_id" text,
    "timestamp" timestamp with time zone not null,
    "record_kind" text not null,
    "event_key" text not null,
    "event_version" text not null,
    "span_name" text,
    "start_time" timestamp with time zone,
    "end_time" timestamp with time zone,
    "status_code" text,
    "payload_format" text not null,
    "payload_encoding" text not null,
    "payload_masking_applied" boolean not null,
    "payload_masked_fields" jsonb not null,
    "payload" jsonb,
    "registry_warning" text,
    "qa_session_id" text,
    "created_at" timestamp with time zone not null default now()
  )`,
  `create table if not exists "transmissions" (
    "transmission_id" text primary key,
    "sent_at" timestamp with time zone not null,
    "owner_type" text not null,
    "owner_id" text not null,
    "service_name" text not null,
    "sdk_name" text not null,
    "sdk_version" text not null,
    "platform" text not null,
    "env" text not null,
    "record_count" integer not null,
    "received_at" timestamp with time zone not null default now()
  )`,
  `create table if not exists "runtime_graphs" (
    "trace_id" text primary key references "traces"("trace_id"),
    "graph" jsonb not null,
    "node_count" integer not null,
    "edge_count" integer not null,
    "built_at" timestamp with time zone not null default now()
  )`,
  `create table if not exists "verdict_reports" (
    "id" text primary key,
    "scenario_id" text not null,
    "trace_id" text not null references "traces"("trace_id"),
    "qa_session_id" text,
    "overall_verdict" text not null,
    "report" jsonb not null,
    "computed_at" timestamp with time zone not null default now(),
    constraint "verdict_reports_scenario_trace_key" unique ("scenario_id", "trace_id")
  )`,
  `create table if not exists "dead_letter_queue" (
    "id" text primary key,
    "trace_id" text not null references "traces"("trace_id"),
    "phase" text not null,
    "error_message" text not null,
    "attempt_count" integer not null default 0,
    "last_attempted_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "resolved_at" timestamp with time zone
  )`,
];

let testDb: Db | null = null;
let testDatabaseUrl: string | null = null;
let schemaSetupPromise: Promise<void> | null = null;

export const hasTestDatabaseUrl = Boolean(process.env.DATABASE_URL);

function getTestDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for store integration tests.");
  }

  return databaseUrl;
}

async function hasRequiredTables(databaseUrl: string) {
  const client = getClient(databaseUrl);
  const [row] = await client<{
    qa_sessions_table: string | null;
    traces_table: string | null;
    event_records_table: string | null;
    transmissions_table: string | null;
    runtime_graphs_table: string | null;
    verdict_reports_table: string | null;
    dead_letter_queue_table: string | null;
  }[]>`
    select
      to_regclass('public.qa_sessions')::text as qa_sessions_table,
      to_regclass('public.traces')::text as traces_table,
      to_regclass('public.event_records')::text as event_records_table,
      to_regclass('public.transmissions')::text as transmissions_table,
      to_regclass('public.runtime_graphs')::text as runtime_graphs_table,
      to_regclass('public.verdict_reports')::text as verdict_reports_table,
      to_regclass('public.dead_letter_queue')::text as dead_letter_queue_table
  `;

  return (
    row?.qa_sessions_table !== null &&
    row?.traces_table !== null &&
    row?.event_records_table !== null &&
    row?.transmissions_table !== null &&
    row?.runtime_graphs_table !== null &&
    row?.verdict_reports_table !== null &&
    row?.dead_letter_queue_table !== null
  );
}

async function ensureSchema(databaseUrl: string) {
  if (await hasRequiredTables(databaseUrl)) {
    return;
  }

  const client = getClient(databaseUrl);
  for (const statement of tableSetupStatements) {
    await client.unsafe(statement);
  }
}

export async function createTestDb() {
  const databaseUrl = getTestDatabaseUrl();

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
  const databaseUrl = getTestDatabaseUrl();
  await ensureSchema(databaseUrl);

  const client = getClient(databaseUrl);
  await client.unsafe(
    'truncate table "dead_letter_queue", "event_records", "runtime_graphs", "verdict_reports", "transmissions", "traces", "qa_sessions" restart identity cascade',
  );
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
