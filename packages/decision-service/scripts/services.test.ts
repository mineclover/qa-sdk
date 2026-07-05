import "reflect-metadata";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../src/db/schema.ts";
import { HealthController } from "../src/health.controller.ts";
import { SchemasService } from "../src/modules/schemas/schemas.service.ts";
import { InstancesService } from "../src/modules/instances/instances.service.ts";
import { LinksService } from "../src/modules/links/links.service.ts";

function applyMigration(db: Database.Database, path: string): void {
  const sql = readFileSync(path, "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of sql) db.exec(statement);
}

const rawDb = new Database(":memory:");
applyMigration(rawDb, join(import.meta.dirname, "..", "drizzle", "20260328020445_initial", "migration.sql"));
applyMigration(rawDb, join(import.meta.dirname, "..", "drizzle", "20260328162408_rename_context_columns", "migration.sql"));
const db = drizzle({ client: rawDb, schema });

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response("missing", { status: 404 });

try {
  const health = new HealthController();
  assert.deepEqual(health.health(), { status: "ok", service: "decision-service" });

  const schemas = new SchemasService(db);
  const registered = schemas.register({
    schemaId: "coordinate-design",
    name: "Coordinate Design",
    gates: [
      {
        id: "axis-definition",
        label: "Axis definition",
        weight: "core",
        phase: "strategic",
        branches: [{ id: "accept", label: "Accept" }],
      },
    ],
    outcomes: [{ id: "approved", label: "Approved" }],
    meta: { source: "smoke" },
  });
  assert.equal(registered.schemaId, "coordinate-design");
  assert.equal(registered.version, "v1");
  assert.equal(schemas.get("coordinate-design")?.gates[0]?.id, "axis-definition");
  assert.equal(schemas.list().length, 1);

  const updated = schemas.register({
    schemaId: "coordinate-design",
    name: "Coordinate Design Updated",
    version: "v2",
    gates: registered.gates,
  });
  assert.equal(updated.name, "Coordinate Design Updated");
  assert.equal(updated.version, "v2");

  const instances = new InstancesService(db);
  const saved = instances.save({
    id: "flow-1",
    schemaId: "coordinate-design",
    schemaVersion: "v2",
    status: "running",
    context: { actor: "codex" },
    selections: [
      {
        gateId: "axis-definition",
        branchId: "accept",
        evidence: [{ kind: "test" }],
        selectedAt: "2026-07-05T00:00:00.000Z",
      },
    ],
    startedAt: "2026-07-05T00:00:00.000Z",
  });
  assert.equal(saved.id, "flow-1");
  assert.equal(instances.get("flow-1")?.context["actor"], "codex");
  assert.equal(instances.findBySchema("coordinate-design").length, 1);
  assert.equal(instances.findByStatus("running").length, 1);

  const completed = instances.save({
    ...saved,
    status: "completed",
    outcome: { result: "approved" },
    completedAt: "2026-07-05T00:01:00.000Z",
    verdict: "pass",
  });
  assert.equal(completed.status, "completed");
  assert.equal(completed.outcome?.["result"], "approved");
  assert.equal(instances.list().length, 1);

  const links = new LinksService(db);
  const link = await links.link("flow-1", "decision-service-system", "approved");
  assert.equal(link.instanceId, "flow-1");
  assert.equal(link.docId, "decision-service-system");
  assert.equal(link.linkType, "approved");
  assert.equal(links.findByInstance("flow-1").length, 1);
  assert.equal(links.findByDoc("decision-service-system").length, 1);
  assert.equal(links.unlink("flow-1", "decision-service-system", "approved"), true);
  assert.equal(links.unlink("flow-1", "decision-service-system", "approved"), false);

  assert.equal(schemas.delete("coordinate-design"), true);
  assert.equal(schemas.delete("coordinate-design"), false);

  console.log("decision-service services smoke passed");
} finally {
  globalThis.fetch = originalFetch;
  rawDb.close();
}
