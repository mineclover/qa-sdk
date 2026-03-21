/**
 * Skills Suite — 전체 skill 검증.
 *
 * constraint-check, safe-entry-add, domain-health, skill-chain 통합 테스트.
 */

import { describe, it, expect } from "vitest";
import { DEMO_CATALOG, DEMO_DKG_CONFIG } from "demo-snapshot";
import { bootstrapDkg } from "../bootstrap.js";
import { checkConstraints, auditAllConstraints } from "./constraint-check.js";
import { safeEntryAdd } from "./safe-entry-add.js";
import { checkDomainHealth, checkAllDomainsHealth } from "./domain-health.js";
import { entryAddChain, systemHealthChain } from "./skill-chain.js";

describe("constraint-check", () => {
  it("활성 constraint 검사 — role 축", () => {
    const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
    const result = checkConstraints(graph, "role");

    console.log(`\n  role constraints: ${result.violations.length} violations, ${result.passed.length} passed`);
    // CON-001 (rbac_role≠role)이 role에 적용됨
    expect(result.passed.length + result.violations.length).toBeGreaterThan(0);
  });

  it("전체 constraint 감사", () => {
    const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
    const audit = auditAllConstraints(graph);

    console.log(`\n  전체 constraint: ${audit.total} targets, ${audit.passed} passed, ${audit.violated} violated`);
    // CON-001의 formal "NOT EXISTS(... rbac_role AND role)"은 위반 안 됨 (같은 prefix에 없으므로)
    expect(audit.violated).toBe(0);
  });
});

describe("safe-entry-add", () => {
  it("safe — headroom 충분, 기존에 없음", () => {
    const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
    const result = safeEntryAdd(DEMO_CATALOG, graph, { axisId: "role", entry: "moderator" });

    console.log(`\n  ${result.verdict}: ${result.summary}`);
    expect(result.verdict).toBe("safe");
    expect(result.headroom.sufficient).toBe(true);
    expect(result.strideBreak).toBe(false);
  });

  it("already-exists — 이미 있는 entry", () => {
    const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
    const result = safeEntryAdd(DEMO_CATALOG, graph, { axisId: "role", entry: "admin" });

    expect(result.verdict).toBe("already-exists");
    expect(result.alreadyExists).toBe(true);
  });

  it("영향 분석이 포함됨", () => {
    const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
    const result = safeEntryAdd(DEMO_CATALOG, graph, { axisId: "role", entry: "superadmin" });

    expect(result.affectedPrefixes.length).toBeGreaterThan(0);
    expect(result.affectedPrefixes.some(p => p.id === "permission")).toBe(true);
  });
});

describe("domain-health", () => {
  it("단일 domain 진단 — shopping-domain", () => {
    const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
    const result = checkDomainHealth(graph, "shopping-domain");

    console.log(`\n  ${result.domainId}: ${result.overallHealth} (${result.issues.length} issues)`);
    expect(result.overallHealth).toBe("healthy");
    expect(result.prefixes.length).toBe(3); // permission, event, service
  });

  it("전체 domain 진단", () => {
    const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
    const results = checkAllDomainsHealth(graph);

    console.log("\n  Domain Health:");
    for (const r of results) {
      const icon = r.overallHealth === "healthy" ? "✅" : r.overallHealth === "warning" ? "⚠" : "🔴";
      console.log(`    ${icon} ${r.domainId}: ${r.overallHealth} (${r.prefixes.length} prefixes, ${r.issues.length} issues)`);
    }

    expect(results.length).toBeGreaterThanOrEqual(4);
    // 대부분 healthy
    expect(results.filter(r => r.overallHealth === "healthy").length).toBeGreaterThan(0);
  });
});

describe("skill-chain", () => {
  it("entryAddChain — safe entry 추가", () => {
    const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
    const result = entryAddChain(DEMO_CATALOG, graph, "role", "moderator");

    console.log("\n  Entry Add Chain:");
    for (const step of result.steps) {
      const icon = step.status === "ok" ? "✅" : step.status === "warning" ? "⚠" : step.status === "blocked" ? "🔴" : "⏭";
      console.log(`    ${icon} ${step.step}: ${step.message}`);
    }
    console.log(`  → ${result.overallStatus}: ${result.summary}`);

    expect(result.overallStatus).toBe("ok");
    expect(result.steps.length).toBeGreaterThanOrEqual(3);
  });

  it("entryAddChain — 이미 있는 entry → skipped", () => {
    const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
    const result = entryAddChain(DEMO_CATALOG, graph, "role", "admin");

    expect(result.steps[0].status).toBe("skipped");
    expect(result.summary).toContain("already exists");
  });

  it("systemHealthChain — 전체 건강 진단", () => {
    const graph = bootstrapDkg({ catalog: DEMO_CATALOG, config: DEMO_DKG_CONFIG });
    const result = systemHealthChain(graph);

    console.log("\n  System Health Chain:");
    for (const step of result.steps) {
      const icon = step.status === "ok" ? "✅" : "⚠";
      console.log(`    ${icon} ${step.step}: ${step.message}`);
    }
    console.log(`  → ${result.overallStatus}: ${result.summary}`);

    expect(result.steps.length).toBe(3); // constraint, domain, observations
    // observations가 있으므로 warning 가능
  });
});
