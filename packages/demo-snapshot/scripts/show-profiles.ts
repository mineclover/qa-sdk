#!/usr/bin/env tsx
import { DEMO_CATALOG, getPrefixProfile } from "../src/index.js";

const targets = [
  "version_state", "metric_aggregate", "validation_event",
  "resource_lifecycle", "test_coverage", "cli_tracking", "tag_lifecycle",
];

for (const pfxId of targets) {
  const p = getPrefixProfile(DEMO_CATALOG, pfxId);

  console.log(`── ${p.id} (${p.name}) ${p.version} ──`);
  console.log(`  dim              kind         entries  capacity  headroom  stride`);
  console.log(`  ───────────────  ───────────  ───────  ────────  ────────  ──────`);
  for (const d of p.dims) {
    const kindStr = d.kind === "prefix_ref" ? `→${d.label}` : d.axisId!;
    console.log(
      `  ${d.label.padEnd(15)}  ${kindStr.padEnd(11)}  ${String(d.entries).padStart(7)}  ${String(d.capacity).padStart(8)}  ${String(d.headroom).padStart(8)}  ${String(d.stride).padStart(6)}`
    );
  }
  const combos = p.usedCombos !== undefined ? p.usedCombos.toLocaleString() : "—";
  const util = p.utilization !== undefined ? (p.utilization * 100).toFixed(1) + "%" : "—";
  console.log(`  총 공간: ${p.totalSpace.toLocaleString()}  유효 조합: ${combos}  활용률: ${util}  precision: ${p.safePrecision ? "safe" : "⚠ bigint 필요"}`);
  console.log();
}
