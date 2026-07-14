// @def.boundary decision-service-spec
// @def.doc decision-service-spec

import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DATABASE, type DecisionServiceDatabase } from '../../database.module.js';
import {
  flowInstances,
  type FlowInstanceRow,
  type FlowInstanceSelection,
} from '../../db/schema.js';
import { createLogger } from '../../lib/logger.js';
import { env } from '../../config/env.js';

const logger = createLogger('decision-service');

export interface FlowInstanceRecord {
  id: string;
  schemaId: string;
  schemaVersion: string;
  status: string;
  context: Record<string, unknown>;
  selections: FlowInstanceSelection[];
  outcome?: Record<string, unknown>;
  address?: number;
  addressContext?: string;
  verdict?: string;
  startedAt: string;
  completedAt?: string;
}

function rowToInstance(row: FlowInstanceRow): FlowInstanceRecord {
  return {
    ...row,
    outcome: row.outcome ?? undefined,
    address: row.address ?? undefined,
    addressContext: row.addressContext ?? undefined,
    verdict: row.verdict ?? undefined,
    completedAt: row.completedAt ?? undefined,
  };
}

@Injectable()
export class InstancesService {
  constructor(@Inject(DATABASE) private readonly db: DecisionServiceDatabase) {}

  save(instance: FlowInstanceRecord): FlowInstanceRecord {
    const values = {
      id: instance.id,
      schemaId: instance.schemaId,
      schemaVersion: instance.schemaVersion,
      status: instance.status,
      context: instance.context,
      selections: instance.selections,
      outcome: instance.outcome ?? null,
      address: instance.address ?? null,
      addressContext: instance.addressContext ?? null,
      verdict: instance.verdict ?? null,
      startedAt: instance.startedAt,
      completedAt: instance.completedAt ?? null,
    };

    this.db
      .insert(flowInstances)
      .values(values)
      .onConflictDoUpdate({
        target: flowInstances.id,
        set: {
          status: values.status,
          context: values.context,
          selections: values.selections,
          outcome: values.outcome,
          address: values.address,
          addressContext: values.addressContext,
          verdict: values.verdict,
          completedAt: values.completedAt,
        },
      })
      .run();

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- row was just inserted/upserted above
    const saved = this.get(instance.id)!;

    // 완료 + outcome이 있으면 definition-service에 문서 stub 생성 트리거
    if (saved.status === 'completed' && saved.outcome) {
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
        logger.info({ docId, instanceId: instance.id }, '문서 이미 존재 — stub 생성 건너뜀');
        return;
      }
    } catch {
      /* 연결 실패 → 생성 시도 */
    }

    logger.info(
      {
        instanceId: instance.id,
        artifactType,
        docId,
        verdict: instance.verdict,
      },
      '의사결정 완료 → 문서 stub 생성 트리거',
    );
  }

  get(id: string): FlowInstanceRecord | null {
    const row = this.db.select().from(flowInstances).where(eq(flowInstances.id, id)).get();
    return row ? rowToInstance(row) : null;
  }

  findBySchema(schemaId: string, limit = 50): FlowInstanceRecord[] {
    return this.db
      .select()
      .from(flowInstances)
      .where(eq(flowInstances.schemaId, schemaId))
      .orderBy(desc(flowInstances.startedAt))
      .limit(limit)
      .all()
      .map(rowToInstance);
  }

  findByStatus(status: string, limit = 50): FlowInstanceRecord[] {
    return this.db
      .select()
      .from(flowInstances)
      .where(eq(flowInstances.status, status))
      .orderBy(desc(flowInstances.startedAt))
      .limit(limit)
      .all()
      .map(rowToInstance);
  }

  list(limit = 50, offset = 0): FlowInstanceRecord[] {
    return this.db
      .select()
      .from(flowInstances)
      .orderBy(desc(flowInstances.startedAt))
      .limit(limit)
      .offset(offset)
      .all()
      .map(rowToInstance);
  }
}
