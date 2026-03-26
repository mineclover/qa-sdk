import type Database from "better-sqlite3";

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
}

function rowToReg(row: Record<string, unknown>): TestRegistration {
  return {
    id: row["id"] as number,
    docId: row["doc_id"] as string,
    testFile: row["test_file"] as string,
    suite: (row["suite"] as string) || undefined,
    description: (row["description"] as string) || undefined,
    layer: (row["layer"] as string) || undefined,
    registeredAt: row["registered_at"] as string,
  };
}

function rowToResult(row: Record<string, unknown>): TestResult {
  return {
    id: row["id"] as number,
    docId: row["doc_id"] as string,
    testFile: row["test_file"] as string,
    suite: (row["suite"] as string) || undefined,
    passed: row["passed"] as number,
    failed: row["failed"] as number,
    skipped: row["skipped"] as number,
    durationMs: (row["duration_ms"] as number) || undefined,
    errorSummary: (row["error_summary"] as string) || undefined,
    runAt: row["run_at"] as string,
  };
}

export class SqlTestStore implements TestStore {
  private readonly stmtRegister;
  private readonly stmtUnregister;
  private readonly stmtFindByDoc;
  private readonly stmtFindByFile;
  private readonly stmtRecordResult;
  private readonly stmtLatestResult;
  private readonly stmtResultHistory;
  private readonly stmtCountRegs;

  constructor(private readonly db: Database.Database) {
    this.stmtRegister = db.prepare(`
      INSERT INTO test_registry (doc_id, test_file, suite, description, layer)
      VALUES (@doc_id, @test_file, @suite, @description, @layer)
      ON CONFLICT(doc_id, test_file, suite) DO UPDATE SET
        description=@description, layer=@layer, registered_at=datetime('now')
    `);
    this.stmtUnregister = db.prepare(
      "DELETE FROM test_registry WHERE doc_id = ? AND test_file = ? AND (suite = ? OR (suite IS NULL AND ? IS NULL))",
    );
    this.stmtFindByDoc = db.prepare("SELECT * FROM test_registry WHERE doc_id = ? ORDER BY test_file, suite");
    this.stmtFindByFile = db.prepare("SELECT * FROM test_registry WHERE test_file = ? ORDER BY doc_id");
    this.stmtRecordResult = db.prepare(`
      INSERT INTO test_results (doc_id, test_file, suite, passed, failed, skipped, duration_ms, error_summary)
      VALUES (@doc_id, @test_file, @suite, @passed, @failed, @skipped, @duration_ms, @error_summary)
    `);
    this.stmtLatestResult = db.prepare(
      "SELECT * FROM test_results WHERE doc_id = ? ORDER BY run_at DESC LIMIT 1",
    );
    this.stmtResultHistory = db.prepare(
      "SELECT * FROM test_results WHERE doc_id = ? ORDER BY run_at DESC LIMIT ?",
    );
    this.stmtCountRegs = db.prepare("SELECT COUNT(*) as cnt FROM test_registry WHERE doc_id = ?");
  }

  register(reg: TestRegistration): number {
    const result = this.stmtRegister.run({
      doc_id: reg.docId,
      test_file: reg.testFile,
      suite: reg.suite ?? null,
      description: reg.description ?? null,
      layer: reg.layer ?? null,
    });
    return Number(result.lastInsertRowid);
  }

  unregister(docId: string, testFile: string, suite?: string): boolean {
    return this.stmtUnregister.run(docId, testFile, suite ?? null, suite ?? null).changes > 0;
  }

  findByDoc(docId: string): TestRegistration[] {
    return (this.stmtFindByDoc.all(docId) as Record<string, unknown>[]).map(rowToReg);
  }

  findByFile(testFile: string): TestRegistration[] {
    return (this.stmtFindByFile.all(testFile) as Record<string, unknown>[]).map(rowToReg);
  }

  recordResult(result: TestResult): number {
    const r = this.stmtRecordResult.run({
      doc_id: result.docId,
      test_file: result.testFile,
      suite: result.suite ?? null,
      passed: result.passed,
      failed: result.failed,
      skipped: result.skipped,
      duration_ms: result.durationMs ?? null,
      error_summary: result.errorSummary ?? null,
    });
    return Number(r.lastInsertRowid);
  }

  getLatestResult(docId: string): TestResult | null {
    const row = this.stmtLatestResult.get(docId) as Record<string, unknown> | undefined;
    return row ? rowToResult(row) : null;
  }

  getResultHistory(docId: string, limit = 20): TestResult[] {
    return (this.stmtResultHistory.all(docId, limit) as Record<string, unknown>[]).map(rowToResult);
  }

  getStatus(docId: string): TestStatus {
    const cnt = (this.stmtCountRegs.get(docId) as { cnt: number }).cnt;
    const latest = this.getLatestResult(docId);
    const total = latest ? latest.passed + latest.failed + latest.skipped : 0;
    const passRate = total > 0 ? latest!.passed / total : 0;
    return {
      docId,
      registrations: cnt,
      lastRun: latest ?? undefined,
      passRate,
      healthy: !latest || latest.failed === 0,
    };
  }
}
