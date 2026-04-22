#!/usr/bin/env tsx
/**
 * Enterprise PM 시뮬 — seed 데이터 적용 runner
 *
 * 사용:
 *   pnpm sim:seed         — 실제 적용 (트랜잭션 + 커밋)
 *   pnpm sim:seed:dry     — SQL 파일만 출력, 실행 없음
 *
 * 의존:
 *   - .env.sim (sops decrypt 후 평문)
 *   - Plan 11a 완료 (sim.department/role/user/role_assignment 테이블 존재)
 *
 * 본 runner는 schema-agnostic — SQL 파일을 그대로 실행만 한다.
 * 테이블 DDL은 Plan 11a/Drizzle migration이 담당.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import postgres from "postgres";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SIM_ROOT = resolve(SCRIPT_DIR, "..");

// ── 환경 변수 로드 ──
const envPath = resolve(SIM_ROOT, ".env.sim");
loadEnv({ path: envPath });

const required = [
  "QA_PG_HOST",
  "QA_PG_PORT",
  "QA_PG_DATABASE",
  "QA_PG_USER",
  "QA_PG_PASSWORD",
  "QA_PG_SCHEMA",
] as const;

for (const key of required) {
  if (!process.env[key]) {
    console.error(`[seed] 환경 변수 ${key} 누락 — .env.sim 점검 (${envPath})`);
    process.exit(1);
  }
}

const isDryRun = process.env.SIM_SEED_DRY_RUN === "true";

// ── 호스트/도커 차이 흡수 ──
// .env.sim의 QA_PG_HOST=qa-sdk-db는 docker network 안용. 호스트에서 실행 시 localhost + 5434.
const isInsideDocker = process.env.SIM_INSIDE_DOCKER === "true";
const pgHost = isInsideDocker
  ? process.env.QA_PG_HOST!
  : process.env.QA_PG_HOST_OVERRIDE ?? "localhost";
const pgPort = isInsideDocker
  ? Number(process.env.QA_PG_PORT)
  : Number(process.env.QA_PG_PORT_OVERRIDE ?? 5434);

// ── seed 파일 순서 (FK 의존성 순) ──
const SEED_FILES = [
  "departments.sql",
  "roles.sql",
  "users.sql",
  "role-assignments.sql",
] as const;

async function main() {
  console.log("==> Enterprise PM seed runner");
  console.log(`    PG host: ${pgHost}:${pgPort}`);
  console.log(`    PG db:   ${process.env.QA_PG_DATABASE}`);
  console.log(`    PG user: ${process.env.QA_PG_USER}`);
  console.log(`    schema:  ${process.env.QA_PG_SCHEMA}`);
  console.log(`    mode:    ${isDryRun ? "DRY RUN (no execution)" : "APPLY"}`);
  console.log("");

  const sqlFiles: { name: string; content: string }[] = [];
  for (const fname of SEED_FILES) {
    const fpath = resolve(SCRIPT_DIR, fname);
    const content = await readFile(fpath, "utf-8");
    sqlFiles.push({ name: fname, content });
    console.log(`    loaded: ${fname} (${content.split("\n").length} lines)`);
  }
  console.log("");

  if (isDryRun) {
    console.log("==> DRY RUN — SQL 파일만 출력, 실행 없음");
    for (const { name, content } of sqlFiles) {
      console.log(`\n--- ${name} ---`);
      console.log(content);
    }
    console.log("\n✓ dry run 완료 — 실제 적용은 pnpm sim:seed");
    return;
  }

  // ── PG 연결 ──
  const sql = postgres({
    host: pgHost,
    port: pgPort,
    database: process.env.QA_PG_DATABASE!,
    user: process.env.QA_PG_USER!,
    password: process.env.QA_PG_PASSWORD!,
    max: 1,
    onnotice: (notice) => console.log(`[pg notice] ${notice.message}`),
  });

  try {
    // ── 사전 점검 — 테이블 존재 확인 ──
    const requiredTables = ["department", "role", "user", "role_assignment"];
    const present = await sql<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = ${process.env.QA_PG_SCHEMA!}
        AND table_name = ANY(${requiredTables})
    `;
    const presentNames = new Set(present.map((r) => r.table_name));
    const missing = requiredTables.filter((t) => !presentNames.has(t));
    if (missing.length > 0) {
      console.error(`\n⚠ 다음 테이블이 ${process.env.QA_PG_SCHEMA} schema에 없습니다: ${missing.join(", ")}`);
      console.error(`   Plan 11a (도메인 모델)가 먼저 완료되어야 합니다.`);
      console.error(`   현재 단계에서는 dry run으로만 검증: pnpm sim:seed:dry`);
      process.exit(2);
    }

    // ── 트랜잭션 ──
    console.log("==> 트랜잭션 시작");
    await sql.begin(async (tx) => {
      // search_path를 sim schema로 고정
      await tx`SET LOCAL search_path TO ${sql(process.env.QA_PG_SCHEMA!)}, public`;

      for (const { name, content } of sqlFiles) {
        console.log(`    적용: ${name}`);
        // postgres.js의 unsafe — 사용자 입력 아님 (정적 SQL 파일)
        await tx.unsafe(content);
      }
    });

    console.log("\n==> 카운트 검증");
    const counts = await sql<
      { table_name: string; count: number }[]
    >`
      SELECT 'department' AS table_name, COUNT(*)::int AS count FROM ${sql(process.env.QA_PG_SCHEMA!)}.department
      UNION ALL SELECT 'role',            COUNT(*)::int FROM ${sql(process.env.QA_PG_SCHEMA!)}.role
      UNION ALL SELECT 'user',            COUNT(*)::int FROM ${sql(process.env.QA_PG_SCHEMA!)}."user"
      UNION ALL SELECT 'role_assignment', COUNT(*)::int FROM ${sql(process.env.QA_PG_SCHEMA!)}.role_assignment
    `;
    for (const row of counts) {
      console.log(`    ${row.table_name.padEnd(20)} ${row.count}`);
    }

    console.log("\n✓ seed 적용 완료");
  } catch (err) {
    console.error("\n⚠ seed 실패:", err);
    throw err;
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
