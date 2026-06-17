// @def.boundary dkg-system-root
// @def.doc dkg-system-root

import { describe, it, expect } from "vitest";
import { DEMO_CATALOG } from "demo-snapshot";
import { DEMO_DKG_CONFIG } from "demo-dkg-config";
import { bootstrapDkg } from "dkg-enrichment";
import { generateDocSyncReport } from "./doc-sync.js";

describe("Doc Sync — 문서 SSOT 리포트", () => {
  it("현재 시스템 상태 리포트 생성", () => {
    const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
    const report = generateDocSyncReport(DEMO_CATALOG, graph);

    console.log("\n══ Doc Sync Report ══");
    console.log(`  축: ${report.catalog.axesCount}개 (${report.catalog.totalEntries} entries, capacity ${report.catalog.totalCapacity})`);
    console.log(`  prefix: ${report.catalog.prefixCount}개`);
    console.log(`  테이블: ${report.catalog.tableCount}개`);
    console.log(`  DKG: ${report.dkg.nodeCount} nodes, ${report.dkg.edgeCount} edges`);
    console.log(`  노드 종류: ${report.dkg.nodesByKind ? Object.entries(report.dkg.nodesByKind).map(([k,v]) => `${k}=${v}`).join(", ") : "없음"}`);
    console.log(`\n  Category별 prefix:`);
    console.log(report.snippets.category_list.split("\n").map(l => `    ${l}`).join("\n"));

    // 문서에 쓸 값 검증
    expect(report.catalog.axesCount).toBeGreaterThanOrEqual(30);
    expect(report.catalog.prefixCount).toBeGreaterThanOrEqual(15);
    expect(report.dkg.nodeCount).toBeGreaterThan(50);
  });
});
