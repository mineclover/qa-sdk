// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * /v1/labels — 인사이트 라벨링 API.
 *
 * 자동 발견된 패턴(correlation, funnel, intent-link)에 사람이 의미를 부여.
 *
 * kind 종류:
 *   - "correlation"  : prefix 공출현 쌍에 대한 라벨
 *   - "intent-link"  : 자동 발견 IntentLink 후보에 대한 확인/거부
 *   - "funnel"       : 커스텀 퍼널 정의
 *   - "coupling"     : 서비스 커플링에 대한 의도 표시
 *   - "anomaly"      : 이상 패턴에 대한 분류
 *
 * status: "pending" | "confirmed" | "rejected" | "investigating"
 */

import { Hono } from 'hono';
import type { SqlDriver } from 'index-meta';
import { parseJsonColumn, type InsightMetadataJson } from '../db/json-types.js';

export interface LabelsDeps {
  driver?: SqlDriver;
}

interface LabelInput {
  kind: string;
  targetId: string;
  label: string;
  status?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

interface LabelRow {
  id: string;
  kind: string;
  target_id: string;
  label: string;
  status: string;
  notes: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export function createLabelsRoutes(deps: LabelsDeps) {
  const app = new Hono();
  if (!deps.driver) return app;
  const db = deps.driver;

  // GET /v1/labels — 전체 라벨 목록 (kind 필터 가능)
  app.get('/v1/labels', async (c) => {
    const kind = c.req.query('kind');
    const status = c.req.query('status');
    let query = 'SELECT * FROM insight_labels';
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (kind) {
      conditions.push('kind = ?');
      params.push(kind);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY updated_at DESC LIMIT 100';

    const rows = await db.query<LabelRow>(query, params);
    return c.json(rows.map(toLabel));
  });

  // GET /v1/labels/summary — kind별 집계 (/:id보다 먼저 매칭)
  app.get('/v1/labels/summary', async (c) => {
    const rows = await db.query<{ kind: string; status: string; cnt: number }>(
      'SELECT kind, status, COUNT(*) as cnt FROM insight_labels GROUP BY kind, status',
    );
    const summary: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      if (!summary[r.kind]) summary[r.kind] = {};
      summary[r.kind][r.status] = r.cnt;
    }
    return c.json(summary);
  });

  // GET /v1/labels/:id
  app.get('/v1/labels/:id', async (c) => {
    const row = await db.queryOne<LabelRow>('SELECT * FROM insight_labels WHERE id = ?', [
      c.req.param('id'),
    ]);
    if (!row) return c.json({ error: 'Label not found' }, 404);
    return c.json(toLabel(row));
  });

  // POST /v1/labels — 새 라벨 생성
  app.post('/v1/labels', async (c) => {
    const body = await c.req.json<LabelInput>();
    if (!body.kind || !body.targetId || !body.label) {
      return c.json({ error: 'kind, targetId, label required' }, 400);
    }

    const id = `lbl-${body.kind}-${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    await db.execute(
      `INSERT INTO insight_labels (id, kind, target_id, label, status, notes, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        body.kind,
        body.targetId,
        body.label,
        body.status ?? 'pending',
        body.notes ?? null,
        body.metadata ? JSON.stringify(body.metadata) : null,
        now,
        now,
      ],
    );

    return c.json({ ok: true, id, kind: body.kind, targetId: body.targetId });
  });

  // PATCH /v1/labels/:id — 라벨 업데이트 (status, notes, label 변경)
  app.patch('/v1/labels/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json<Partial<LabelInput>>();
    const now = new Date().toISOString();

    const sets: string[] = ['updated_at = ?'];
    const params: unknown[] = [now];

    if (body.label) {
      sets.push('label = ?');
      params.push(body.label);
    }
    if (body.status) {
      sets.push('status = ?');
      params.push(body.status);
    }
    if (body.notes !== undefined) {
      sets.push('notes = ?');
      params.push(body.notes);
    }
    if (body.metadata) {
      sets.push('metadata = ?');
      params.push(JSON.stringify(body.metadata));
    }

    params.push(id);
    await db.execute(`UPDATE insight_labels SET ${sets.join(', ')} WHERE id = ?`, params);

    return c.json({ ok: true, id });
  });

  // DELETE /v1/labels/:id
  app.delete('/v1/labels/:id', async (c) => {
    await db.execute('DELETE FROM insight_labels WHERE id = ?', [c.req.param('id')]);
    return c.json({ ok: true });
  });

  // (summary는 /:id보다 먼저 위에 등록됨)

  return app;
}

function toLabel(row: LabelRow) {
  return {
    id: row.id,
    kind: row.kind,
    targetId: row.target_id,
    label: row.label,
    status: row.status,
    notes: row.notes,
    metadata: parseJsonColumn<InsightMetadataJson | null>(row.metadata, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
