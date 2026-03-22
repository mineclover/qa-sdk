import { describe, it, expect } from "vitest";
import { DEMO_CATALOG } from "demo-snapshot";
import { syncRefEntries, printSyncReport } from "@qa-sdk/convergence";

describe("refEntries 동기화", () => {
  it("현재 DEMO_CATALOG의 refEntries 상태 확인", () => {
    const results = syncRefEntries(DEMO_CATALOG);

    console.log("\n══ RefEntries 동기화 보고서 ══");
    printSyncReport(results);

    // 결과가 있어야 함 (permission, event, order_event에 refEntries 존재)
    expect(results.length).toBeGreaterThan(0);
  });

  it("변경이 필요한 refEntries 식별", () => {
    const results = syncRefEntries(DEMO_CATALOG);
    const changed = results.filter(r => r.changed);

    if (changed.length > 0) {
      console.log("\n  변경 필요 refEntries:");
      for (const r of changed) {
        console.log(`    ${r.prefix}:${r.version}.${r.dimLabel}: [${r.oldValues.join(",")}] → [${r.newValues.join(",")}]`);
      }
    }

    // 여기서 변경이 필요하면 DEMO_CATALOG를 업데이트해야 함
    // 이것이 "capacity 변경 → refEntries 재생성"의 의사결정 단위
  });
});
