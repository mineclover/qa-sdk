import type { TaxonomyIR } from "../schema/ir.js";
import type { Diagnostic } from "../schema/diagnostic.js";
import type { TaxonomyRegistry } from "../registry/index.js";
import { validateCapacity } from "./capacity.js";
import { validateRefs } from "./ref.js";
import { validateConstraints } from "./constraint.js";
import { validateAxis5Q } from "./axis5q.js";
import { validateAxisStructure } from "./structure.js";

export type ValidateOptions = {
  strict?: boolean;
  skip?: Array<"capacity" | "ref" | "constraint" | "axis-5q" | "structure">;
};

export function validate(
  ir: TaxonomyIR,
  registry?: TaxonomyRegistry,
  opts: ValidateOptions = {},
): Diagnostic[] {
  const skip = new Set(opts.skip ?? []);
  const out: Diagnostic[] = [];
  if (!skip.has("capacity")) out.push(...validateCapacity(ir));
  if (!skip.has("structure")) out.push(...validateAxisStructure(ir));
  if (!skip.has("ref")) out.push(...validateRefs(ir, registry));
  if (!skip.has("constraint")) out.push(...validateConstraints(ir));
  if (!skip.has("axis-5q")) out.push(...validateAxis5Q(ir));
  if (opts.strict) {
    return out.map((d) => (d.severity === "warning" ? { ...d, severity: "error" } : d));
  }
  return out;
}
