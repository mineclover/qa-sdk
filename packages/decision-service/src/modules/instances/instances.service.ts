import { Inject, Injectable } from "@nestjs/common";
import type Database from "better-sqlite3";
import { DATABASE } from "../../database.module.js";
import { createLogger } from "../../lib/logger.js";
import { env } from "../../config/env.js";

const logger = createLogger("decision-service");

export interface FlowInstanceRecord {
  id: string;
  schemaId: string;
  schemaVersion: string;
  status: string;
  context: Record<string, unknown>;
  selections: { gateId: string; branchId: string; evidence: unknown[]; selectedAt: string }[];
  outcome?: Record<string, unknown>;
  address?: number;
  addressContext?: string;
  verdict?: string;
  startedAt: string;
  completedAt?: string;
}

function rowToInstance(row: Record<string, unknown>): FlowInstanceRecord {
  return {
    id: row["id"] as string,
    schemaId: row["schema_id"] as string,
    schemaVersion: row["schema_version"] as string,
    status: row["status"] as string,
    context: JSON.parse((row["context_json"] as string) || "{}"),
    selections: JSON.parse((row["selections_json"] as string) || "[]"),
    outcome: row["outcome_json"] ? JSON.parse(row["outcome_json"] as string) : undefined,
    address: (row["address"] as number) || undefined,
    addressContext: (row["address_context"] as string) || undefined,
    verdict: (row["verdict"] as string) || undefined,
    startedAt: row["started_at"] as string,
    completedAt: (row["completed_at"] as string) || undefined,
  };
}

@Injectable()
export class InstancesService {
  constructor(@Inject(DATABASE) private readonly db: Database.Database) {}

  save(instance: FlowInstanceRecord): FlowInstanceRecord {
    this.db.prepare(`
      INSERT INTO flow_instances (id, schema_id, schema_version, status, context_json, selections_json, outcome_json, address, address_context, verdict, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status=excluded.status, context_json=excluded.context_json, selections_json=excluded.selections_json,
        outcome_json=excluded.outcome_json, address=excluded.address, address_context=excluded.address_context,
        verdict=excluded.verdict, completed_at=excluded.completed_at
    `).run(
      instance.id, instance.schemaId, instance.schemaVersion, instance.status,
      JSON.stringify(instance.context), JSON.stringify(instance.selections),
      instance.outcome ? JSON.stringify(instance.outcome) : null,
      instance.address ?? null, instance.addressContext ?? null, instance.verdict ?? null,
      instance.startedAt, instance.completedAt ?? null,
    );

    const saved = this.get(instance.id)!;

    // 완료 + outcome이 있으면 definition-service에 문서 stub 생성 트리거
    if (saved.status === "completed" && saved.outcome) {
      void this.triggerDocCreation(saved);
    }

    return saved;
  }

  /** 의사결정 완료 → definition-service에 문서 생성 알림 (fail-open) */
  private async triggerDocCreation(instance: FlowInstanceRecord) {
    const outcome = instance.outcome as Record<string, unknown> | undefined;
    if (!outcome?.artifactType) return;

    const artifactType = outcome.artifactType as string;
    const docId = outcome.docId as string | undefined;
    if (!docId) return;

    try {
      const res = await fetch(`${env.DEFINITION_SERVICE_URL}/docs/${docId}`, {
        signal: AbortSignal.timeout(3_000),
      });
      if (res.ok) {
        logger.info({ docId, instanceId: instance.id }, "문서 이미 존재 — stub 생성 건너뜀");
        return;
      }
    } catch { /* 연결 실패 → 생성 시도 */ }

    logger.info({
      instanceId: instance.id,
      artifactType,
      docId,
      verdict: instance.verdict,
    }, "의사결정 완료 → 문서 stub 생성 트리거");
  }

  get(id: string): FlowInstanceRecord | null {
    const row = this.db.prepare("SELECT * FROM flow_instances WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? rowToInstance(row) : null;
  }

  findBySchema(schemaId: string, limit = 50): FlowInstanceRecord[] {
    const rows = this.db.prepare(
      "SELECT * FROM flow_instances WHERE schema_id = ? ORDER BY started_at DESC LIMIT ?",
    ).all(schemaId, limit) as Record<string, unknown>[];
    return rows.map(rowToInstance);
  }

  findByStatus(status: string, limit = 50): FlowInstanceRecord[] {
    const rows = this.db.prepare(
      "SELECT * FROM flow_instances WHERE status = ? ORDER BY started_at DESC LIMIT ?",
    ).all(status, limit) as Record<string, unknown>[];
    return rows.map(rowToInstance);
  }

  list(limit = 50, offset = 0): FlowInstanceRecord[] {
    const rows = this.db.prepare(
      "SELECT * FROM flow_instances ORDER BY started_at DESC LIMIT ? OFFSET ?",
    ).all(limit, offset) as Record<string, unknown>[];
    return rows.map(rowToInstance);
  }
}
