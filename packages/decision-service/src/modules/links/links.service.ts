import { Inject, Injectable } from "@nestjs/common";
import type Database from "better-sqlite3";
import { DATABASE } from "../../database.module.js";
import { createLogger } from "../../lib/logger.js";
import { env } from "../../config/env.js";

const logger = createLogger("decision-service");

export type FlowLinkType = "created" | "modified" | "deprecated" | "approved";

export interface FlowLinkRecord {
  id: number;
  instanceId: string;
  docId: string;
  linkType: FlowLinkType;
  createdAt: string;
}

function rowToLink(row: Record<string, unknown>): FlowLinkRecord {
  return {
    id: row["id"] as number,
    instanceId: row["instance_id"] as string,
    docId: row["doc_id"] as string,
    linkType: row["link_type"] as FlowLinkType,
    createdAt: row["created_at"] as string,
  };
}

@Injectable()
export class LinksService {
  constructor(@Inject(DATABASE) private readonly db: Database.Database) {}

  /** 의사결정 → 문서 연결 등록 */
  async link(instanceId: string, docId: string, linkType: FlowLinkType): Promise<FlowLinkRecord> {
    // definition-service에서 문서 존재 확인 (fail-open)
    const docExists = await this.checkDocExists(docId);
    if (!docExists) {
      logger.warn({ docId, instanceId }, "문서 미확인 — 연결은 생성 (fail-open)");
    }

    this.db.prepare(
      "INSERT OR IGNORE INTO flow_links (instance_id, doc_id, link_type) VALUES (?, ?, ?)",
    ).run(instanceId, docId, linkType);

    const row = this.db.prepare(
      "SELECT * FROM flow_links WHERE instance_id = ? AND doc_id = ? AND link_type = ?",
    ).get(instanceId, docId, linkType) as Record<string, unknown>;
    return rowToLink(row);
  }

  /** 의사결정이 만든 문서 목록 */
  findByInstance(instanceId: string): FlowLinkRecord[] {
    const rows = this.db.prepare(
      "SELECT * FROM flow_links WHERE instance_id = ? ORDER BY created_at",
    ).all(instanceId) as Record<string, unknown>[];
    return rows.map(rowToLink);
  }

  /** 문서에 연결된 의사결정 목록 */
  findByDoc(docId: string): FlowLinkRecord[] {
    const rows = this.db.prepare(
      "SELECT * FROM flow_links WHERE doc_id = ? ORDER BY created_at DESC",
    ).all(docId) as Record<string, unknown>[];
    return rows.map(rowToLink);
  }

  /** 연결 삭제 */
  unlink(instanceId: string, docId: string, linkType: FlowLinkType): boolean {
    const result = this.db.prepare(
      "DELETE FROM flow_links WHERE instance_id = ? AND doc_id = ? AND link_type = ?",
    ).run(instanceId, docId, linkType);
    return result.changes > 0;
  }

  /** definition-service에서 문서 존재 확인 (fail-open) */
  private async checkDocExists(docId: string): Promise<boolean> {
    try {
      const res = await fetch(`${env.DEFINITION_SERVICE_URL}/docs/${docId}`, {
        signal: AbortSignal.timeout(3_000),
      });
      return res.ok;
    } catch {
      return true; // fail-open
    }
  }
}
