// @def.doc definition-service

import type { DefinitionServiceDatabase } from "../database.module.js";
import { testRegistry, testResults } from "../db/schema.js";
import { eq, and, desc, asc, sql, count, isNull } from "drizzle-orm";

/** 테스트 등록 레코드 */
export interface TestRegistration {
  id?: number;
  docId: string;
  testFile: string;
  suite?: string;
  description?: string;
  layer?: string;
  registeredAt?: string;
}

/** 테스트 결과 레코드 */
export interface TestResult {
  id?: number;
  docId: string;
  testFile: string;
  suite?: string;
  passed: number;
  failed: number;
  skipped: number;
  durationMs?: number;
  errorSummary?: string;
  runAt?: string;
}

/** 문서별 테스트 상태 요약 */
export interface TestStatus {
  docId: string;
  registrations: number;
  lastRun?: TestResult;
  passRate: number;
  healthy: boolean;
}

export interface TestStore {
  register(reg: TestRegistration): number;
  unregister(docId: string, testFile: string, suite?: string): boolean;
  findByDoc(docId: string): TestRegistration[];
  findByFile(testFile: string): TestRegistration[];
  recordResult(result: TestResult): number;
  getLatestResult(docId: string): TestResult | null;
  getResultHistory(docId: string, limit?: number): TestResult[];
  getStatus(docId: string): TestStatus;
  /** 등록된 모든 문서 ID 목록 (중복 제거) */
  listRegisteredDocIds(): string[];
  /** 전체 등록 건수 */
  countRegistrations(): number;
}

/** Drizzle select 결과 → TestRegistration 변환 */
type RegRow = typeof testRegistry.$inferSelect;

function rowToReg(row: RegRow): TestRegistration {
  return {
    id: row.id,
    docId: row.docId,
    testFile: row.testFile,
    suite: row.suite || undefined,
    description: row.description || undefined,
    layer: row.layer || undefined,
    registeredAt: row.registeredAt,
  };
}

/** Drizzle select 결과 → TestResult 변환 */
type ResultRow = typeof testResults.$inferSelect;

function rowToResult(row: ResultRow): TestResult {
  return {
    id: row.id,
    docId: row.docId,
    testFile: row.testFile,
    suite: row.suite || undefined,
    passed: row.passed,
    failed: row.failed,
    skipped: row.skipped,
    durationMs: row.durationMs || undefined,
    errorSummary: row.errorSummary || undefined,
    runAt: row.runAt,
  };
}

export class SqlTestStore implements TestStore {
  constructor(private readonly db: DefinitionServiceDatabase) {}

  register(reg: TestRegistration): number {
    const result = this.db
      .insert(testRegistry)
      .values({
        docId: reg.docId,
        testFile: reg.testFile,
        suite: reg.suite ?? null,
        description: reg.description ?? null,
        layer: reg.layer ?? null,
      })
      .onConflictDoUpdate({
        target: [testRegistry.docId, testRegistry.testFile, testRegistry.suite],
        set: {
          description: reg.description ?? null,
          layer: reg.layer ?? null,
          registeredAt: sql`datetime('now')`,
        },
      })
      .run();
    return Number(result.lastInsertRowid);
  }

  unregister(docId: string, testFile: string, suite?: string): boolean {
    // suite가 null인 경우와 값이 있는 경우 모두 처리
    const suiteCondition = suite != null
      ? eq(testRegistry.suite, suite)
      : isNull(testRegistry.suite);

    const result = this.db
      .delete(testRegistry)
      .where(
        and(
          eq(testRegistry.docId, docId),
          eq(testRegistry.testFile, testFile),
          suiteCondition,
        ),
      )
      .run();
    return result.changes > 0;
  }

  findByDoc(docId: string): TestRegistration[] {
    return this.db
      .select()
      .from(testRegistry)
      .where(eq(testRegistry.docId, docId))
      .orderBy(asc(testRegistry.testFile), asc(testRegistry.suite))
      .all()
      .map(rowToReg);
  }

  findByFile(testFile: string): TestRegistration[] {
    return this.db
      .select()
      .from(testRegistry)
      .where(eq(testRegistry.testFile, testFile))
      .orderBy(asc(testRegistry.docId))
      .all()
      .map(rowToReg);
  }

  recordResult(result: TestResult): number {
    const r = this.db
      .insert(testResults)
      .values({
        docId: result.docId,
        testFile: result.testFile,
        suite: result.suite ?? null,
        passed: result.passed,
        failed: result.failed,
        skipped: result.skipped,
        durationMs: result.durationMs ?? null,
        errorSummary: result.errorSummary ?? null,
      })
      .run();
    return Number(r.lastInsertRowid);
  }

  getLatestResult(docId: string): TestResult | null {
    const row = this.db
      .select()
      .from(testResults)
      .where(eq(testResults.docId, docId))
      .orderBy(desc(testResults.runAt))
      .limit(1)
      .get();
    return row ? rowToResult(row) : null;
  }

  getResultHistory(docId: string, limit = 20): TestResult[] {
    return this.db
      .select()
      .from(testResults)
      .where(eq(testResults.docId, docId))
      .orderBy(desc(testResults.runAt))
      .limit(limit)
      .all()
      .map(rowToResult);
  }

  getStatus(docId: string): TestStatus {
    const cntRow = this.db
      .select({ cnt: count() })
      .from(testRegistry)
      .where(eq(testRegistry.docId, docId))
      .get();
    const cnt = cntRow?.cnt ?? 0;
    const latest = this.getLatestResult(docId);
    const total = latest ? latest.passed + latest.failed + latest.skipped : 0;
    const passRate = total > 0 && latest ? latest.passed / total : 0;
    return {
      docId,
      registrations: cnt,
      lastRun: latest ?? undefined,
      passRate,
      healthy: !latest || latest.failed === 0,
    };
  }

  /** 등록된 모든 문서 ID 목록 (중복 제거) */
  listRegisteredDocIds(): string[] {
    return this.db
      .selectDistinct({ docId: testRegistry.docId })
      .from(testRegistry)
      .all()
      .map(r => r.docId);
  }

  /** 전체 등록 건수 */
  countRegistrations(): number {
    const row = this.db
      .select({ cnt: count() })
      .from(testRegistry)
      .get();
    return row?.cnt ?? 0;
  }
}
