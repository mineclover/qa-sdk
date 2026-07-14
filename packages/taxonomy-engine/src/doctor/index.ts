import type { TaxonomyIR } from '../schema/ir.js';
import type { Diagnostic } from '../schema/diagnostic.js';

export type ExpectedTaxonomy = {
  taxonomy: string;
  axes: Record<
    string,
    {
      entries: Array<{ id: string; address?: number; label?: string }>;
    }
  >;
};

/**
 * doctor — yaml에서 derive된 IR과 expected SSOT를 비교.
 * 외부 코드/스펙과 yaml drift 검출용.
 *
 * 진단 코드:
 * - doctor-missing (error): expected에 있는데 yaml에 없음
 * - doctor-drift (warning): 예상값과 다름 (address/label)
 * - doctor-unexpected (warning): yaml에 있는데 expected에 없음
 */
export function doctor(ir: TaxonomyIR, expected: ExpectedTaxonomy): Diagnostic[] {
  const out: Diagnostic[] = [];

  if (ir.taxonomy !== expected.taxonomy) {
    out.push({
      severity: 'error',
      code: 'doctor-missing' as const,
      message: `taxonomy 이름 불일치: yaml="${ir.taxonomy}" expected="${expected.taxonomy}"`,
      ref: `${ir.taxonomy}`,
      meta: { yaml: ir.taxonomy, expected: expected.taxonomy },
    });
    return out;
  }

  for (const [axisName, expectedAxis] of Object.entries(expected.axes)) {
    const actualAxis = ir.axes.get(axisName);
    if (!actualAxis) {
      out.push({
        severity: 'error',
        code: 'doctor-missing' as const,
        message: `expected axis "${axisName}"이(가) yaml에 없음`,
        ref: `${ir.taxonomy}#/axes/${axisName}`,
        meta: { axis: axisName },
      });
      continue;
    }

    const actualIds = new Map(actualAxis.entries.map((e) => [e.id, e]));
    const expectedIds = new Set<string>();

    for (const expEntry of expectedAxis.entries) {
      expectedIds.add(expEntry.id);
      const actual = actualIds.get(expEntry.id);
      if (!actual) {
        out.push({
          severity: 'error',
          code: 'doctor-missing' as const,
          message: `axes/${axisName}: expected entry "${expEntry.id}"이(가) yaml에 없음`,
          ref: `${ir.taxonomy}#/axes/${axisName}/entries/${expEntry.id}`,
          meta: { axis: axisName, missing: expEntry.id },
        });
        continue;
      }

      if (expEntry.address !== undefined && actual.address !== expEntry.address) {
        out.push({
          severity: 'warning',
          code: 'doctor-drift' as const,
          message: `axes/${axisName}/entries/${expEntry.id}: address yaml=${actual.address} expected=${expEntry.address}`,
          ref: `${ir.taxonomy}#/axes/${axisName}/entries/${expEntry.id}`,
          meta: {
            axis: axisName,
            entry: expEntry.id,
            field: 'address',
            yaml: actual.address,
            expected: expEntry.address,
          },
        });
      }

      if (expEntry.label !== undefined && actual.label !== expEntry.label) {
        out.push({
          severity: 'warning',
          code: 'doctor-drift' as const,
          message: `axes/${axisName}/entries/${expEntry.id}: label yaml="${actual.label ?? ''}" expected="${expEntry.label}"`,
          ref: `${ir.taxonomy}#/axes/${axisName}/entries/${expEntry.id}`,
          meta: {
            axis: axisName,
            entry: expEntry.id,
            field: 'label',
            yaml: actual.label,
            expected: expEntry.label,
          },
        });
      }
    }

    // yaml에 있는데 expected에 없는 entries (warning)
    for (const actualEntry of actualAxis.entries) {
      if (!expectedIds.has(actualEntry.id)) {
        out.push({
          severity: 'warning',
          code: 'doctor-unexpected' as const,
          message: `axes/${axisName}: yaml entry "${actualEntry.id}"이(가) expected에 없음`,
          ref: `${ir.taxonomy}#/axes/${axisName}/entries/${actualEntry.id}`,
          meta: { axis: axisName, unexpected: actualEntry.id },
        });
      }
    }
  }

  return out;
}
