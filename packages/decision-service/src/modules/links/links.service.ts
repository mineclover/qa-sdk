// @def.boundary decision-service-spec
// @def.doc decision-service-spec

import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import { DATABASE, type DecisionServiceDatabase } from '../../database.module.js';
import { flowLinks, type FlowLinkRow } from '../../db/schema.js';
import { createLogger } from '../../lib/logger.js';
import { env } from '../../config/env.js';

const logger = createLogger('decision-service');

export type FlowLinkType = 'created' | 'modified' | 'deprecated' | 'approved';

export interface FlowLinkRecord {
  id: number;
  instanceId: string;
  docId: string;
  linkType: FlowLinkType;
  createdAt: string;
}

function rowToLink(row: FlowLinkRow): FlowLinkRecord {
  return {
    id: row.id,
    instanceId: row.instanceId,
    docId: row.docId,
    linkType: row.linkType as FlowLinkType,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class LinksService {
  constructor(@Inject(DATABASE) private readonly db: DecisionServiceDatabase) {}

  /** 의사결정 → 문서 연결 등록 */
  async link(instanceId: string, docId: string, linkType: FlowLinkType): Promise<FlowLinkRecord> {
    // definition-service에서 문서 존재 확인 (fail-open)
    const docExists = await this.checkDocExists(docId);
    if (!docExists) {
      logger.warn({ docId, instanceId }, '문서 미확인 — 연결은 생성 (fail-open)');
    }

    this.db.insert(flowLinks).values({ instanceId, docId, linkType }).onConflictDoNothing().run();

    const row = this.db
      .select()
      .from(flowLinks)
      .where(
        and(
          eq(flowLinks.instanceId, instanceId),
          eq(flowLinks.docId, docId),
          eq(flowLinks.linkType, linkType),
        ),
      )
      .get();

    if (!row) {
      throw new Error('flow_links insert/select 결과를 찾지 못했습니다');
    }

    return rowToLink(row);
  }

  /** 의사결정이 만든 문서 목록 */
  findByInstance(instanceId: string): FlowLinkRecord[] {
    return this.db
      .select()
      .from(flowLinks)
      .where(eq(flowLinks.instanceId, instanceId))
      .orderBy(asc(flowLinks.createdAt))
      .all()
      .map(rowToLink);
  }

  /** 문서에 연결된 의사결정 목록 */
  findByDoc(docId: string): FlowLinkRecord[] {
    return this.db
      .select()
      .from(flowLinks)
      .where(eq(flowLinks.docId, docId))
      .orderBy(desc(flowLinks.createdAt))
      .all()
      .map(rowToLink);
  }

  /** 연결 삭제 */
  unlink(instanceId: string, docId: string, linkType: FlowLinkType): boolean {
    const result = this.db
      .delete(flowLinks)
      .where(
        and(
          eq(flowLinks.instanceId, instanceId),
          eq(flowLinks.docId, docId),
          eq(flowLinks.linkType, linkType),
        ),
      )
      .run();
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
