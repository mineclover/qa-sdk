// @def.doc definition-service

import { Injectable, Inject } from "@nestjs/common";
import { DRIZZLE_DB, type DefinitionServiceDatabase } from "../../database.module.js";
import { SqlTestStore, type TestStore, type TestRegistration, type TestResult, type TestStatus } from "../../stores/test-store.js";
import { GraphService } from "../graph/graph.service.js";

@Injectable()
export class TestsService {
  private readonly store: TestStore;

  constructor(
    @Inject(DRIZZLE_DB) db: DefinitionServiceDatabase,
    @Inject(GraphService) private readonly graph: GraphService,
  ) {
    this.store = new SqlTestStore(db);
  }

  register(reg: TestRegistration): number {
    return this.store.register(reg);
  }

  unregister(docId: string, testFile: string, suite?: string): boolean {
    return this.store.unregister(docId, testFile, suite);
  }

  findByDoc(docId: string): TestRegistration[] {
    return this.store.findByDoc(docId);
  }

  recordResult(result: TestResult): number {
    return this.store.recordResult(result);
  }

  getStatus(docId: string): TestStatus {
    return this.store.getStatus(docId);
  }

  getResultHistory(docId: string, limit?: number): TestResult[] {
    return this.store.getResultHistory(docId, limit);
  }

  /**
   * 문서 변경 시 영향받는 테스트를 식별한다.
   *
   * 1. changedDocId의 impact 분석 (blast radius)
   * 2. 영향받는 각 문서에 등록된 테스트 수집
   * 3. changedDocId 자체에 등록된 테스트도 포함
   */
  async findAffectedTests(changedDocId: string): Promise<{
    changedDoc: string;
    affectedTests: { docId: string; tests: TestRegistration[] }[];
    totalTests: number;
  }> {
    const directTests = this.store.findByDoc(changedDocId);
    const result: { docId: string; tests: TestRegistration[] }[] = [];

    if (directTests.length > 0) {
      result.push({ docId: changedDocId, tests: directTests });
    }

    // impact 분석으로 영향받는 문서의 테스트도 수집
    const impact = await this.graph.impact(changedDocId);
    if (impact) {
      for (const impacted of impact.impacted) {
        const tests = this.store.findByDoc(impacted.id);
        if (tests.length > 0) {
          result.push({ docId: impacted.id, tests });
        }
      }
    }

    const totalTests = result.reduce((sum, r) => sum + r.tests.length, 0);
    return { changedDoc: changedDocId, affectedTests: result, totalTests };
  }

  /**
   * 전체 테스트 커버리지 요약.
   * 등록된 문서 수 / 전체 approved 문서 수.
   */
  getCoverageSummary(): {
    registeredDocs: number;
    totalRegistrations: number;
    healthyDocs: number;
    failingDocs: number;
  } {
    const allDocIds = this.store.listRegisteredDocIds();

    let healthy = 0;
    let failing = 0;
    for (const docId of allDocIds) {
      const status = this.store.getStatus(docId);
      if (status.healthy) healthy++;
      else failing++;
    }

    return {
      registeredDocs: allDocIds.length,
      totalRegistrations: this.store.countRegistrations(),
      healthyDocs: healthy,
      failingDocs: failing,
    };
  }
}
