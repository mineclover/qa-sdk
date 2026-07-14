// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { describe, it, expect } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema.js';

/**
 * sqlcommenter 검증 — .comment()가 실제 SQL 출력에 주석을 포함하는지 확인.
 * mock DB (실제 연결 없이 SQL만 생성)
 */
describe('sqlcommenter SQL 출력 검증', () => {
  // drizzle.mock()으로 실제 DB 연결 없이 SQL 생성만 테스트
  const db = drizzle.mock({ schema });

  it('SELECT에 .comment()가 SQL 주석으로 포함된다', () => {
    const query = db
      .select()
      .from(schema.eventRecords)
      .where(eq(schema.eventRecords.traceId, 'test-trace'))
      .comment({ adapter: 'RecordStore', method: 'findByTraceId' })
      .toSQL();

    // SQL 끝에 sqlcommenter 형식의 주석이 포함되어야 함
    expect(query.sql).toContain('RecordStore');
    expect(query.sql).toContain('findByTraceId');
  });

  it('INSERT에 .comment()가 SQL 주석으로 포함된다', () => {
    const query = db
      .insert(schema.transmissions)
      .values({
        transmissionId: 't1',
        sentAt: new Date(),
        ownerType: 'org',
        ownerId: 'o1',
        serviceName: 'svc',
        sdkName: 'sdk',
        sdkVersion: '1.0',
        platform: 'node',
        env: 'test',
        recordCount: 1,
      })
      .comment({ adapter: 'TransmissionStore', method: 'insert' })
      .toSQL();

    expect(query.sql).toContain('TransmissionStore');
    expect(query.sql).toContain('insert');
  });

  it('UPDATE에 .comment()가 SQL 주석으로 포함된다', () => {
    const query = db
      .update(schema.traces)
      .set({ reconstructed: true, updatedAt: new Date() })
      .where(eq(schema.traces.traceId, 't1'))
      .comment({ adapter: 'TraceStore', method: 'markReconstructed' })
      .toSQL();

    expect(query.sql).toContain('TraceStore');
    expect(query.sql).toContain('markReconstructed');
  });

  it('DELETE에 .comment()가 SQL 주석으로 포함된다', () => {
    const query = db
      .delete(schema.scenarioSpecs)
      .where(eq(schema.scenarioSpecs.scenarioId, 's1'))
      .comment({ adapter: 'ScenarioSpecStore', method: 'remove' })
      .toSQL();

    expect(query.sql).toContain('ScenarioSpecStore');
    expect(query.sql).toContain('remove');
  });

  it("comment 형식이 sqlcommenter key='value' 포맷이다", () => {
    const query = db
      .select()
      .from(schema.qaSessions)
      .comment({ adapter: 'SessionStore', method: 'findById' })
      .toSQL();

    // sqlcommenter 포맷: /* key='value',key='value' */
    expect(query.sql).toMatch(/\/\*.*adapter='SessionStore'.*method='findById'.*\*\//);
  });
});
