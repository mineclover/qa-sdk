import type { TaxonomyIR } from "../schema/ir.js";
import type { Diagnostic } from "../schema/diagnostic.js";

export function validateConstraints(ir: TaxonomyIR): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const c of ir.constraints) {
    if (c.kind === "structural" && /level=leaf.*must not appear as upper/i.test(c.rule)) {
      const level = ir.axes.get("level");
      if (!level) continue;
      for (const [relName, rel] of ir.relations) {
        if (rel.kind !== "contains") continue;
        for (const [i, rule] of rel.rules.entries()) {
          if (rule.upper === "leaf") {
            out.push({
              severity: c.severity,
              code: "constraint-violated",
              message: `constraint ${c.id}: relations/${relName}/rules/${i}.upper="leaf"`,
              ref: `${ir.taxonomy}#/constraints/${c.id}`,
              meta: { constraint: c.id, location: `${relName}/${i}` },
            });
          }
        }
      }
    }
  }
  return out;
}
