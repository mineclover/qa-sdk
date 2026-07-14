// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import type { Db } from '../../db/client.js';
import { traces } from '../../db/schema.js';

/**
 * 여러 integration test 파일에서 공유하는 seed 헬퍼.
 * 3개 이상 파일에서 사용되는 헬퍼만 여기에 배치.
 */

export async function seedTrace(db: Db, overrides: Partial<typeof traces.$inferInsert> = {}) {
  await db.insert(traces).values({
    traceId: 'trace_1',
    sessionId: null,
    serviceName: 'mobile-app',
    recordCount: 1,
    firstTimestamp: new Date('2026-03-12T00:00:01.000Z'),
    lastTimestamp: new Date('2026-03-12T00:00:01.000Z'),
    ...overrides,
  });
}
