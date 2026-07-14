// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

/**
 * createAuditRecorder — dialect 분기 factory.
 *
 * 호출자는 dialect + 이미 부팅된 Drizzle DB만 전달하고, 결과로 AuditRecorder를 받는다.
 * 드라이버는 dynamic import — 미설치 환경에서도 본 모듈 import는 실패하지 않음.
 *
 * pg-migration-design.md §2 factory 패턴 준용.
 */

import type { AuditRecorder } from 'permission-engine';

export type AuditRecorderDialect = 'sqlite' | 'pg';

export interface CreateAuditRecorderArgs {
  dialect: AuditRecorderDialect;
  /** Drizzle DB 인스턴스. dialect와 일치해야 한다. */
  db: unknown;
}

export async function createAuditRecorder(args: CreateAuditRecorderArgs): Promise<AuditRecorder> {
  if (args.dialect === 'sqlite') {
    const { SqliteAuditRecorder } = await import('./sqlite/adapter.js');
    // BetterSQLite3Database 타입은 caller 책임 — factory는 unknown으로 받고 어댑터에 위임
    return new SqliteAuditRecorder(args.db as never);
  }
  if (args.dialect === 'pg') {
    const { PgAuditRecorder } = await import('./pg/adapter.js');
    return new PgAuditRecorder(args.db as never);
  }
  throw new Error(`Unsupported dialect: ${(args as { dialect: string }).dialect}`);
}
