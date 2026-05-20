import type { TaxonomyIR } from "../schema/ir.js";
import type { Diagnostic } from "../schema/diagnostic.js";

export function validateConstraints(ir: TaxonomyIR): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const c of ir.constraints) {
    switch (c.kind) {
      case "structural":
        out.push(...evalStructural(ir, c));
        break;
      case "capacity":
        out.push(...evalCapacity(ir, c));
        break;
      case "ref":
        out.push(...evalRef(ir, c));
        break;
      case "custom":
        out.push({
          severity: "info",
          code: "constraint-violated",
          message: `custom constraint ${c.id}: caller가 실행 책임 (rule: ${c.rule})`,
          ref: `${ir.taxonomy}#/constraints/${c.id}`,
          meta: { constraint: c.id, kind: "custom" },
        });
        break;
    }
  }
  return out;
}

function evalStructural(
  ir: TaxonomyIR,
  c: { id: string; rule: string; severity: "error" | "warning" | "info" }
): Diagnostic[] {
  const out: Diagnostic[] = [];
  // level=leaf no children pattern
  if (/entry=leaf.*must not appear as upper/i.test(c.rule)) {
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
  return out;
}

function evalCapacity(
  ir: TaxonomyIR,
  c: { id: string; rule: string; severity: "error" | "warning" | "info" }
): Diagnostic[] {
  const out: Diagnostic[] = [];
  // Pattern: "axes/<name> entries.length <op> <num>"
  const m = c.rule.match(/axes\/(\w+)\s+entries\.length\s*([<>=!]+)\s*(\d+)/);
  if (!m) return out;
  const [, axisName, op, numStr] = m;
  const num = Number(numStr);
  const axis = ir.axes.get(axisName);
  if (!axis) {
    out.push({
      severity: "error",
      code: "constraint-violated",
      message: `constraint ${c.id}: axes/${axisName} 없음`,
      ref: `${ir.taxonomy}#/constraints/${c.id}`,
      meta: { constraint: c.id, missingAxis: axisName },
    });
    return out;
  }
  const len = axis.entries.length;
  const ok = compareOp(len, op, num);
  if (!ok) {
    out.push({
      severity: c.severity,
      code: "constraint-violated",
      message: `constraint ${c.id}: axes/${axisName} entries.length=${len} 가 "${op} ${num}" 조건 위반`,
      ref: `${ir.taxonomy}#/constraints/${c.id}`,
      meta: { constraint: c.id, axis: axisName, actual: len, op, expected: num },
    });
  }
  return out;
}

function evalRef(
  ir: TaxonomyIR,
  c: { id: string; rule: string; severity: "error" | "warning" | "info" }
): Diagnostic[] {
  const out: Diagnostic[] = [];
  // Pattern: "axis=<name> must exist"
  const m = c.rule.match(/axis=(\w+)\s+must exist/i);
  if (!m) return out;
  const axisName = m[1];
  if (!ir.axes.get(axisName)) {
    out.push({
      severity: c.severity,
      code: "constraint-violated",
      message: `constraint ${c.id}: required axis "${axisName}" 없음`,
      ref: `${ir.taxonomy}#/constraints/${c.id}`,
      meta: { constraint: c.id, missingAxis: axisName },
    });
  }
  return out;
}

function compareOp(a: number, op: string, b: number): boolean {
  switch (op) {
    case "<":
      return a < b;
    case "<=":
      return a <= b;
    case ">":
      return a > b;
    case ">=":
      return a >= b;
    case "==":
    case "=":
      return a === b;
    case "!=":
    case "!==":
      return a !== b;
    default:
      return true; // unknown op → pass
  }
}
