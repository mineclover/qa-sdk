import type { TaxonomyIR } from "../schema/ir.js";
import type { Diagnostic } from "../schema/diagnostic.js";

const SUSPECT_UNBOUNDED_AXIS_NAMES = new Set(["version", "timestamp", "uuid", "id"]);

export function validateAxis5Q(ir: TaxonomyIR): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const [name, axis] of ir.axes) {
    if (SUSPECT_UNBOUNDED_AXIS_NAMES.has(name)) {
      out.push({
        severity: "warning",
        code: "axis-5q-finite",
        message: `axes/${name}: 이름이 unbounded 가능성 — 5Q checklist '유한' 항목 검토`,
        ref: `${ir.taxonomy}#/axes/${name}`,
        meta: { axis: name, reason: "name-suspect" },
      });
    }
  }
  return out;
}
