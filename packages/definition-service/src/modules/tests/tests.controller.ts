import { Controller, Get, Post, Delete, Inject, Param, Query, Body, NotFoundException } from "@nestjs/common";
import { TestsService } from "./tests.service.js";

@Controller("tests")
export class TestsController {
  constructor(@Inject(TestsService) private readonly tests: TestsService) {}

  /** POST /tests/register — 문서 ↔ 테스트 매핑 등록 */
  @Post("register")
  register(@Body() body: {
    docId: string;
    testFile: string;
    suite?: string;
    description?: string;
    layer?: string;
  }) {
    const id = this.tests.register(body);
    return { id, docId: body.docId, testFile: body.testFile };
  }

  /** DELETE /tests/register — 매핑 해제 */
  @Delete("register")
  unregister(@Body() body: { docId: string; testFile: string; suite?: string }) {
    const deleted = this.tests.unregister(body.docId, body.testFile, body.suite);
    if (!deleted) throw new NotFoundException("매핑 없음");
    return { ok: true };
  }

  /** GET /tests/:docId — 문서에 등록된 테스트 목록 */
  @Get(":docId")
  findByDoc(@Param("docId") docId: string) {
    const tests = this.tests.findByDoc(docId);
    return { docId, tests, total: tests.length };
  }

  /** GET /tests/:docId/status — 문서 테스트 상태 (pass rate, healthy) */
  @Get(":docId/status")
  status(@Param("docId") docId: string) {
    return this.tests.getStatus(docId);
  }

  /** GET /tests/:docId/history — 테스트 결과 시계열 */
  @Get(":docId/history")
  history(@Param("docId") docId: string, @Query("limit") limit?: string) {
    const results = this.tests.getResultHistory(docId, limit ? Number(limit) : undefined);
    return { docId, results, total: results.length };
  }

  /** GET /tests/affected/:docId — 문서 변경 시 실행해야 할 테스트 */
  @Get("affected/:docId")
  async affected(@Param("docId") docId: string) {
    return this.tests.findAffectedTests(docId);
  }

  /** POST /tests/results — 테스트 실행 결과 기록 */
  @Post("results")
  recordResult(@Body() body: {
    docId: string;
    testFile: string;
    suite?: string;
    passed: number;
    failed: number;
    skipped?: number;
    durationMs?: number;
    errorSummary?: string;
  }) {
    const id = this.tests.recordResult({
      ...body,
      skipped: body.skipped ?? 0,
    });
    return { id, docId: body.docId };
  }

  /** GET /tests/coverage/summary — 전체 테스트 커버리지 요약 */
  @Get("coverage/summary")
  coverage() {
    return this.tests.getCoverageSummary();
  }
}
