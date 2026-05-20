import type { TaxonomyIR } from "../schema/ir.js";
import type { Diagnostic } from "../schema/diagnostic.js";

/**
 * 각 axis 안에서 entry.address/id 중복 검출.
 * - structural-duplicate-address (error): 두 entry가 같은 address
 * - structural-duplicate-id (error): 두 entry가 같은 id
 */
export function validateAxisStructure(ir: TaxonomyIR): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const [name, axis] of ir.axes) {
    const addrSeen = new Map<number, string>(); // address → first id
    const idSeen = new Set<string>();
    for (const e of axis.entries) {
      if (idSeen.has(e.id)) {
        out.push({
          severity: "error",
          code: "structural-duplicate-id",
          message: `axes/${name}: 중복 id "${e.id}"`,
          ref: `${ir.taxonomy}#/axes/${name}/entries/${e.id}`,
          meta: { axis: name, duplicateId: e.id },
        });
      } else {
        idSeen.add(e.id);
      }
      const prev = addrSeen.get(e.address);
      if (prev !== undefined) {
        out.push({
          severity: "error",
          code: "structural-duplicate-address",
          message: `axes/${name}: address=${e.address} 가 "${prev}" 와 "${e.id}"에 중복 할당`,
          ref: `${ir.taxonomy}#/axes/${name}/entries/${e.id}`,
          meta: { axis: name, address: e.address, ids: [prev, e.id] },
        });
      } else {
        addrSeen.set(e.address, e.id);
      }
    }
  }
  return out;
}
