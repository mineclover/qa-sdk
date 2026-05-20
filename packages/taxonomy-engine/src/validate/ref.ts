import type { TaxonomyIR } from "../schema/ir.js";
import type { Diagnostic } from "../schema/diagnostic.js";
import type { TaxonomyRegistry } from "../registry/index.js";

export function validateRefs(ir: TaxonomyIR, _registry?: TaxonomyRegistry): Diagnostic[] {
  const out: Diagnostic[] = [];
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
