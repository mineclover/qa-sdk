// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import type { CommandHandler } from "cli-command";
import { createDiscoveryClient } from "../discovery/client.js";
import type { AuditIssue } from "../commands/audit.js";
import { REGISTRY_URL } from "./context.js";

/** audit 명령 — registry 감사 */
export const auditHandler: CommandHandler = async (_ctx) => {
  const client = createDiscoveryClient(REGISTRY_URL);
  const { auditRegistry } = await import("../commands/audit.js");
  const result = await auditRegistry(client);

  console.log(`\n=== Registry 감사 ===\n`);
  if (result.errors.length > 0) {
    console.log(`에러 (${result.errors.length}건):`);
    for (const e of result.errors) console.log(`  ${e.serviceId}: ${e.message}`);
  }
  if (result.warnings.length > 0) {
    console.log(`경고 (${result.warnings.length}건):`);
    // 유형별 그룹핑
    const byType = new Map<string, AuditIssue[]>();
    for (const w of result.warnings) {
      const list = byType.get(w.type) ?? [];
      list.push(w);
      byType.set(w.type, list);
    }
    for (const [type, issues] of [...byType.entries()].sort()) {
      console.log(`\n  [${type}] (${issues.length}건)`);
      for (const i of issues) console.log(`    ${i.serviceId}: ${i.message}`);
    }
  }
  if (result.errors.length === 0 && result.warnings.length === 0) {
    console.log("이상 없음");
  }
  console.log(`\n요약: ${result.errors.length} 에러, ${result.warnings.length} 경고`);
};
