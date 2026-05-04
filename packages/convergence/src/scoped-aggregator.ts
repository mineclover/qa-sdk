// @def.boundary convergence-layer-group
/**
 * 영역 분리 집계 — DSL별 / category별 / 서비스별로 records를 분리하여 독립 집계.
 *
 * 하나의 records 배열을 여러 관점으로 슬라이스하여
 * 각 영역의 분기 분포, 커버리지, 건전성을 독립적으로 분석한다.
 *
 * @layer 집계 (Aggregation)
 */

import type { Catalog } from "@qa-sdk/core";
import { decodePrefixAsResult } from "@qa-sdk/core";
import { aggregateUsageData, type AddressContextRecord } from "./usage-aggregator.js";
import type { UsageData, EntryUsage } from "./convergence.types.js";

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════

export interface ScopedUsage {
  readonly scopeKey: string;
  readonly scopeLabel: string;
  readonly recordCount: number;
  readonly usage: UsageData;
}

export interface BranchDistribution {
  readonly axisId: string;
  readonly total: number;
  readonly entries: readonly { entry: string; count: number; pct: number }[];
}

export interface ScopedReport {
  readonly scopes: readonly ScopedUsage[];
  readonly branches: readonly BranchDistribution[];
  readonly summary: string;
}

// ═══════════════════════════════════════════════════════════════
//  DSL별 분리
// ═══════════════════════════════════════════════════════════════

/**
 * records를 DSL 번들별로 분리하여 독립 집계한다.
 *
 * 각 record의 address_context에 포함된 prefix가
 * 어떤 DSL의 멤버인지 판단하여 분류.
 */
export function aggregateByDsl(
  catalog: Catalog,
  records: readonly AddressContextRecord[],
  dslMemberMap: ReadonlyMap<string, readonly string[]>,
): ScopedReport {
  const buckets = new Map<string, AddressContextRecord[]>();

  for (const record of records) {
    const prefixes = Object.keys(record.address_context ?? {});
    // 이 record가 속하는 DSL 찾기 (가장 많은 멤버가 매칭되는 DSL)
    let bestDsl = "unscoped";
    let bestCount = 0;
    for (const [dslId, members] of dslMemberMap) {
      const matched = prefixes.filter(p => members.includes(p)).length;
      if (matched > bestCount) {
        bestDsl = dslId;
        bestCount = matched;
      }
    }
    const list = buckets.get(bestDsl) ?? [];
    list.push(record);
    buckets.set(bestDsl, list);
  }

  const scopes: ScopedUsage[] = [];
  const allBranches: BranchDistribution[] = [];

  for (const [dslId, recs] of buckets) {
    const usage = aggregateUsageData(catalog, recs);
    scopes.push({ scopeKey: dslId, scopeLabel: dslId, recordCount: recs.length, usage });

    // 분기 분포 추출 (해당 DSL의 action/step 계열 축)
    const branchAxes = extractBranches(usage.entryUsages, recs.length);
    for (const b of branchAxes) {
      allBranches.push(b);
    }
  }

  return {
    scopes: scopes.toSorted((a, b) => b.recordCount - a.recordCount),
    branches: allBranches,
    summary: `${scopes.length}개 영역, ${records.length}건 분류`,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Category별 분리
// ═══════════════════════════════════════════════════════════════

/**
 * records를 prefix category별로 분리하여 독립 집계한다.
 */
export function aggregateByCategory(
  catalog: Catalog,
  records: readonly AddressContextRecord[],
  prefixCategoryMap: ReadonlyMap<string, string>,
): ScopedReport {
  const buckets = new Map<string, AddressContextRecord[]>();

  for (const record of records) {
    const prefixes = Object.keys(record.address_context ?? {});
    for (const prefixId of prefixes) {
      const cat = prefixCategoryMap.get(prefixId) ?? "unknown";
      const list = buckets.get(cat) ?? [];
      list.push(record);
      buckets.set(cat, list);
      break; // 첫 번째 prefix의 category로 분류
    }
  }

  const scopes: ScopedUsage[] = [];
  for (const [cat, recs] of buckets) {
    scopes.push({
      scopeKey: cat,
      scopeLabel: cat,
      recordCount: recs.length,
      usage: aggregateUsageData(catalog, recs),
    });
  }

  return {
    scopes: scopes.toSorted((a, b) => b.recordCount - a.recordCount),
    branches: [],
    summary: `${scopes.length}개 category, ${records.length}건 분류`,
  };
}

// ═══════════════════════════════════════════════════════════════
//  서비스별 분리
// ═══════════════════════════════════════════════════════════════

/**
 * records를 서비스(svc_ref) 주소별로 분리하여 독립 집계한다.
 */
export function aggregateByService(
  catalog: Catalog,
  records: readonly AddressContextRecord[],
): ScopedReport {
  const buckets = new Map<string, AddressContextRecord[]>();

  for (const record of records) {
    const ctx = record.address_context;
    if (!ctx) continue;

    // service prefix 값 추출
    let svcKey = "no-service";
    if (ctx.service) {
      svcKey = ctx.service;
    } else {
      // svc_ref를 가진 다른 prefix에서 추출 시도
      for (const serialized of Object.values(ctx)) {
        const parts = serialized.split(":");
        if (parts.length === 3) {
          const [prefixId, version, addr] = parts;
          const prefix = catalog.prefixes[prefixId as keyof typeof catalog.prefixes];
          if (prefix) {
            for (const [, dimRef] of Object.entries(prefix.dims)) {
              if (dimRef.kind === "prefix_ref" && dimRef.prefixId === "service") {
                try {
                  const result = decodePrefixAsResult(catalog, prefixId, version, Number(addr));
                  const svcRefLabel = Object.keys(prefix.dims).find(
                    l => {
                      const d = prefix.dims[l];
                      return d.kind === "prefix_ref" && d.prefixId === "service";
                    },
                  );
                  if (svcRefLabel && result.dims[svcRefLabel]?.kind === "prefix_ref") {
                    svcKey = `svc:${result.dims[svcRefLabel].value}`;
                  }
                } catch { /* ignore */ }
                break;
              }
            }
          }
          if (svcKey !== "no-service") break;
        }
      }
    }

    const list = buckets.get(svcKey) ?? [];
    list.push(record);
    buckets.set(svcKey, list);
  }

  const scopes: ScopedUsage[] = [];
  for (const [svcKey, recs] of buckets) {
    scopes.push({
      scopeKey: svcKey,
      scopeLabel: svcKey,
      recordCount: recs.length,
      usage: aggregateUsageData(catalog, recs),
    });
  }

  return {
    scopes: scopes.toSorted((a, b) => b.recordCount - a.recordCount),
    branches: [],
    summary: `${scopes.length}개 서비스, ${records.length}건 분류`,
  };
}

// ═══════════════════════════════════════════════════════════════
//  분기 분포 추출
// ═══════════════════════════════════════════════════════════════

const BRANCH_AXES = new Set([
  "flow_step", "flow_variant", "deploy_action", "health_status",
  "verdict_result", "constraint_op", "migration_pattern",
  "mask_mode", "validation_mode", "pipeline_phase",
  "cart_action", "auth_action", "order_action",
  "http_method", "resource_type",
]);

function extractBranches(entryUsages: readonly EntryUsage[], _total: number): BranchDistribution[] {
  const grouped = new Map<string, { entry: string; count: number }[]>();

  for (const u of entryUsages) {
    if (!BRANCH_AXES.has(u.axisId)) continue;
    const list = grouped.get(u.axisId) ?? [];
    list.push({ entry: u.entry, count: u.count });
    grouped.set(u.axisId, list);
  }

  return [...grouped.entries()].map(([axisId, entries]) => {
    const axisTotal = entries.reduce((s, e) => s + e.count, 0);
    return {
      axisId,
      total: axisTotal,
      entries: entries
        .toSorted((a, b) => b.count - a.count)
        .map(e => Object.assign({}, e, { pct: axisTotal > 0 ? (e.count / axisTotal) * 100 : 0 })),
    };
  });
}
