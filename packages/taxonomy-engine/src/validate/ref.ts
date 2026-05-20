import type { TaxonomyIR } from "../schema/ir.js";
import type { Diagnostic } from "../schema/diagnostic.js";
import type { TaxonomyRegistry } from "../registry/index.js";

export function validateRefs(ir: TaxonomyIR, registry?: TaxonomyRegistry): Diagnostic[] {
  const out: Diagnostic[] = [];

  // 1) imports 검증 — registry가 제공되었을 때만
  if (registry && ir.imports.length > 0) {
    for (const [i, imp] of ir.imports.entries()) {
      const target = registry.get(imp.taxonomy);
      if (!target) {
        out.push({
          severity: "error",
          code: "ref-unresolved-import",
          message: `imports[${i}]: taxonomy="${imp.taxonomy}" 가 registry에 없음`,
          ref: `${ir.taxonomy}#/imports/${i}`,
          meta: { missing: imp.taxonomy, as: imp.as, index: i },
        });
        continue;
      }
      if (imp.version !== undefined && target.version !== imp.version) {
        out.push({
          severity: "error",
          code: "ref-version-missing",
          message: `imports[${i}]: ${imp.taxonomy}@v${imp.version} 요청했지만 registry에 v${target.version} 있음`,
          ref: `${ir.taxonomy}#/imports/${i}`,
          meta: { taxonomy: imp.taxonomy, requested: imp.version, available: target.version, index: i },
        });
      }
    }
  }

  // 2) relation rules의 entry ref 검증 (기존 로직 유지)
  for (const [relName, rel] of ir.relations) {
    for (const [i, rule] of rel.rules.entries()) {
      for (const [field, entryId] of Object.entries(rule)) {
        const axisName = inferAxis(rel, field);
        if (!axisName) continue;
        const axis = ir.axes.get(axisName);
        if (!axis) {
          out.push({
            severity: "error",
            code: "ref-broken",
            message: `relations/${relName}/rules/${i}: axis="${axisName}" 없음`,
            ref: `${ir.taxonomy}#/relations/${relName}/rules/${i}`,
            meta: { missing: axisName, field },
          });
          continue;
        }
        const exists = axis.entries.some((e) => e.id === entryId);
        if (!exists) {
          out.push({
            severity: "error",
            code: "ref-broken",
            message: `relations/${relName}/rules/${i}: ${field}="${entryId}" — axes/${axisName}/entries에 없음`,
            ref: `${ir.taxonomy}#/relations/${relName}/rules/${i}`,
            meta: { axis: axisName, missing: entryId, field },
          });
        }
      }
    }
  }
  return out;
}

function inferAxis(rel: { from: string[]; to: string[] }, field: string): string | undefined {
  if (field === "upper" || field === "parent") return rel.from[0];
  if (field === "lower" || field === "child") return rel.to[0];
  return undefined;
}
