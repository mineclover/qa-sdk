import type { TaxonomyIR } from '../schema/ir.js';
import type { Diagnostic } from '../schema/diagnostic.js';

export function validateCapacity(ir: TaxonomyIR): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const [name, axis] of ir.axes) {
    const min = axis.entries.length * 2;
    if (axis.capacity < min) {
      out.push({
        severity: 'warning',
        code: 'capacity-headroom',
        message: `axes/${name}: entries=${axis.entries.length}, capacity=${axis.capacity} (need >= ${min})`,
        ref: `${ir.taxonomy}#/axes/${name}`,
        meta: {
          entries: axis.entries.length,
          capacity: axis.capacity,
          minRecommended: min,
        },
      });
    }
    if (axis.entries.length > axis.capacity) {
      out.push({
        severity: 'error',
        code: 'capacity-overflow',
        message: `axes/${name}: entries=${axis.entries.length} > capacity=${axis.capacity}`,
        ref: `${ir.taxonomy}#/axes/${name}`,
        meta: { entries: axis.entries.length, capacity: axis.capacity },
      });
    }
  }
  return out;
}
