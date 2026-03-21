/**
 * qa-sdk DX 명령어 — 개발자용 encode/decode/resolve/find/derive.
 *
 * 개발자가 정수를 보지 않고 문자열만 다루는 것이 핵심.
 * CLI가 문자열 ↔ 정수 변환을 투명하게 처리한다.
 */

import {
  DEMO_CATALOG,
  encodePrefixByValue, decodePrefix, resolveAddress,
  getPrefixShape, getPrefixStructure,
} from "demo-snapshot";
import type { DemoCatalog } from "demo-snapshot";
import { parseSerializedAddress, serializeAddress } from "@qa-sdk/core";
import {
  resolve,
  findVersionForEntry,
  findRefAddress,
  validateRefEntries,
  getAllSemanticRefs,
  bootstrapDkg,
  analyzeImpact,
} from "@qa-sdk/spec-core/analysis";

// ── qa encode ───────────────────────────────────────

export function cliEncode(args: {
  prefix: string;
  dims: Record<string, string | number>;
  version?: string;
  json?: boolean;
}): void {
  const prefix = DEMO_CATALOG.prefixes[args.prefix as keyof typeof DEMO_CATALOG.prefixes];
  if (!prefix) {
    console.error(`Unknown prefix: ${args.prefix}`);
    console.error(`Available: ${Object.keys(DEMO_CATALOG.prefixes).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const version = args.version ?? prefix.versions[prefix.versions.length - 1].version;

  try {
    const address = encodePrefixByValue(DEMO_CATALOG, args.prefix, version, args.dims);
    const serialized = `${args.prefix}:${version}:${address}`;

    if (args.json) {
      console.log(JSON.stringify({ address: serialized, prefix: args.prefix, version, id: address, dims: args.dims }, null, 2));
    } else {
      console.log(serialized);
    }
  } catch (e) {
    console.error((e as Error).message);
    process.exitCode = 1;
  }
}

// ── qa decode ───────────────────────────────────────

export function cliDecode(args: {
  address: string;
  deep?: boolean;
  json?: boolean;
}): void {
  let parsed;
  try {
    parsed = parseSerializedAddress(args.address);
  } catch {
    console.error('형식: "prefix:version:address" (예: permission:v1:65536)');
    process.exitCode = 1;
    return;
  }

  const { prefix: prefixId, version, address } = parsed;

  try {
    const decoded = decodePrefix(DEMO_CATALOG, prefixId, version, address);
    const values = Object.fromEntries(
      Object.entries(decoded).map(([k, v]) => [k, v.value]),
    );

    if (args.json) {
      const result: Record<string, unknown> = {
        address: args.address,
        prefix: prefixId,
        version,
        id: address,
        values,
      };

      if (args.deep) {
        const resolved = resolveAddress(DEMO_CATALOG, prefixId, version, address);
        result.resolved = resolved;
      }

      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`\n  ${args.address}`);
      for (const [k, v] of Object.entries(values)) {
        console.log(`    ${k}: ${v}`);
      }

      if (args.deep) {
        const resolved = resolveAddress(DEMO_CATALOG, prefixId, version, address);
        console.log("\n  deep resolve:");
        for (const [k, dim] of Object.entries(resolved.dims)) {
          const ko = dim.ko ? ` (${dim.ko})` : "";
          console.log(`    ${k}: ${dim.value}${ko}`);
          if (dim.ref) {
            console.log(`      → ${dim.ref.prefix}:${dim.ref.version}:${dim.ref.address}`);
            for (const [rk, rv] of Object.entries(dim.ref.dims)) {
              console.log(`        ${rk}: ${rv.value}${rv.ko ? ` (${rv.ko})` : ""}`);
            }
          }
        }
      }
    }
  } catch (e) {
    console.error((e as Error).message);
    process.exitCode = 1;
  }
}

// ── qa resolve ──────────────────────────────────────

export function cliResolve(args: {
  address: string;
  to?: string;
  json?: boolean;
}): void {
  try {
    const result = resolve(DEMO_CATALOG, args.address, args.to);
    const values = Object.fromEntries(
      Object.entries(result.values).map(([k, v]) => [k, v.value]),
    );

    if (args.json) {
      console.log(JSON.stringify({ ...result, values }, null, 2));
    } else {
      console.log(`\n  입력:     ${args.address}`);
      console.log(`  결과:     ${result.address}`);
      console.log(`  migrated: ${result.migrated}`);
      if (result.originalVersion) {
        console.log(`  원본 ver: ${result.originalVersion}`);
      }
      console.log("  values:");
      for (const [k, v] of Object.entries(values)) {
        console.log(`    ${k}: ${v}`);
      }
    }
  } catch (e) {
    console.error((e as Error).message);
    process.exitCode = 1;
  }
}

// ── qa find-version ─────────────────────────────────

export function cliFindVersion(args: {
  axis: string;
  entry: string;
}): void {
  const versions = findVersionForEntry(DEMO_CATALOG, args.axis, args.entry);

  if (versions.length === 0) {
    console.log(`\n  "${args.entry}" not found in axis "${args.axis}"`);
    // 유사 entry 추천
    const axis = (DEMO_CATALOG.axes as Record<string, { versions: Record<string, { entries: readonly string[] }> }>)[args.axis];
    if (axis) {
      const allEntries = new Set<string>();
      for (const snap of Object.values(axis.versions)) {
        for (const e of snap.entries) allEntries.add(e);
      }
      console.log(`  가능한 entries: ${[...allEntries].join(", ")}`);
    }
    return;
  }

  console.log(`\n  "${args.entry}" in ${args.axis}:`);
  for (const v of versions) {
    const snap = (DEMO_CATALOG.axes as Record<string, { versions: Record<string, { entries: readonly string[] }> }>)[args.axis].versions[v];
    const pos = snap.entries.indexOf(args.entry);
    console.log(`    ${v}: position ${pos}`);
  }
}

// ── qa derive-refs ──────────────────────────────────

export function cliDeriveRefs(args: {
  check?: boolean;
}): void {
  const semantics = getAllSemanticRefs();

  console.log("\n══ RefEntries 정합성 검증 ══\n");

  let allValid = true;
  for (const semantic of semantics) {
    const result = validateRefEntries(DEMO_CATALOG, semantic);

    if (!result.valid) {
      allValid = false;
      console.log(`  ❌ ${result.prefixId}:${result.version}.${result.dimLabel}`);
      for (const m of result.mismatches) {
        console.log(`     [${m.index}] current=${m.current} derived=${m.derived}`);
      }
    }
  }

  if (allValid) {
    console.log(`  ✅ ${semantics.length}개 refEntries 전부 일치`);
  } else {
    console.log("\n  qa derive-refs --apply 로 재생성하세요.");
    process.exitCode = 1;
  }
}

// ── qa impact ───────────────────────────────────────

export function cliImpact(args: {
  axis?: string;
  prefix?: string;
}): void {
  const graph = bootstrapDkg();

  const input = args.axis
    ? { type: "entry-added" as const, target: { axis: args.axis } }
    : { type: "entry-added" as const, target: { prefix: args.prefix } };

  const result = analyzeImpact(graph, input);

  console.log(`\n══ Impact Analysis ══`);
  console.log(`  stride-break: ${result.strideBreak}`);
  console.log(`  migration:    ${result.migrationRequired}`);
  console.log(`  auto-migrate: ${result.autoMigratable}`);

  if (result.affectedPrefixes.length > 0) {
    console.log("\n  영향 prefix:");
    for (const p of result.affectedPrefixes) {
      console.log(`    ${p.reason === "composes" ? "←" : "←ref─"} ${p.id} (depth=${p.distance})`);
    }
  }

  if (result.affectedDomains.length > 0) {
    console.log("\n  영향 domain:");
    for (const d of result.affectedDomains) {
      console.log(`    ${d.id}: [${d.affectedPrefixes.join(", ")}]`);
    }
  }

  if (result.affectedConsumers.length > 0) {
    console.log("\n  영향 consumer:");
    for (const c of result.affectedConsumers) {
      console.log(`    ${c.id} (via ${c.via})`);
    }
  }

  if (result.constraintViolations.length > 0) {
    console.log("\n  ⚠ constraint 위반:");
    for (const v of result.constraintViolations) {
      console.log(`    ${v.constraintId}: ${v.rule}`);
    }
  }
}

// ── qa list-prefixes ────────────────────────────────

export function cliListPrefixes(args: { json?: boolean }): void {
  const prefixes = Object.entries(DEMO_CATALOG.prefixes);

  if (args.json) {
    const result = prefixes.map(([id, p]) => {
      const shape = getPrefixShape(DEMO_CATALOG, id, p.versions[p.versions.length - 1].version);
      return {
        id,
        name: p.name,
        dims: p.labels,
        versions: p.versions.map(v => v.version),
        shape: shape.shape,
        capacity: shape.capacity,
      };
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`\n══ Prefixes (${prefixes.length}) ══\n`);
  for (const [id, p] of prefixes) {
    const latestV = p.versions[p.versions.length - 1].version;
    const shape = getPrefixShape(DEMO_CATALOG, id, latestV);
    const dimTypes = p.labels.map(l => {
      const d = p.dims[l];
      return d.kind === "axis" ? l : d.kind === "prefix_ref" ? `${l}(ref)` : `${l}(tbl)`;
    });
    console.log(`  ${id.padEnd(15)} ${dimTypes.join(" × ").padEnd(40)} cap=${shape.capacity}`);
  }
}

// ── qa list-axes ────────────────────────────────────

export function cliListAxes(args: { json?: boolean }): void {
  const axes = Object.entries(DEMO_CATALOG.axes);

  if (args.json) {
    const result = axes.map(([id, a]) => {
      const versions = Object.keys(a.versions);
      const latest = a.versions[versions[versions.length - 1] as keyof typeof a.versions] as any;
      return {
        id,
        name: a.name,
        entries: [...latest.entries],
        capacity: latest.capacity ?? latest.entries.length,
        versions: versions.length,
      };
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`\n══ Axes (${axes.length}) ══\n`);
  for (const [id, a] of axes) {
    const versions = Object.keys(a.versions);
    const latest = a.versions[versions[versions.length - 1] as keyof typeof a.versions] as any;
    const entries = latest.entries?.length ?? 0;
    const cap = latest.capacity ?? entries;
    console.log(`  ${id.padEnd(15)} ${a.name.padEnd(12)} entries=${String(entries).padStart(2)} cap=${String(cap).padStart(3)} headroom=${cap - entries}`);
  }
}
