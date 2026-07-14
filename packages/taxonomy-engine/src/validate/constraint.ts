import type { TaxonomyIR } from '../schema/ir.js';
import type { Diagnostic } from '../schema/diagnostic.js';
import { CapacityRuleSchema, RefRuleSchema, StructuralRuleSchema } from '../schema/zod.js';

export function validateConstraints(ir: TaxonomyIR): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const c of ir.constraints) {
    if (typeof c.rule === 'string') {
      // Legacy string rule — deprecated warning + legacy evaluator
      out.push({
        severity: 'info',
        code: 'constraint-deprecated-string-rule',
        message: `constraint ${c.id}: rule이 string 형식. 구조화 객체로 마이그레이션 권장.`,
        ref: `${ir.taxonomy}#/constraints/${c.id}`,
        meta: { constraint: c.id, currentRule: c.rule },
      });
      out.push(
        ...evalLegacyString(
          ir,
          c as { id: string; kind: string; rule: string; severity: 'error' | 'warning' | 'info' },
        ),
      );
    } else {
      // 구조화 객체 rule
      out.push(
        ...evalStructured(
          ir,
          c as {
            id: string;
            kind: string;
            rule: Record<string, unknown>;
            severity: 'error' | 'warning' | 'info';
          },
        ),
      );
    }
  }
  return out;
}

function evalStructured(
  ir: TaxonomyIR,
  c: {
    id: string;
    kind: string;
    rule: Record<string, unknown>;
    severity: 'error' | 'warning' | 'info';
  },
): Diagnostic[] {
  const out: Diagnostic[] = [];
  switch (c.kind) {
    case 'capacity': {
      const parsed = CapacityRuleSchema.safeParse(c.rule);
      if (!parsed.success) {
        out.push({
          severity: 'error',
          code: 'constraint-violated',
          message: `constraint ${c.id}: capacity rule 형식 오류 — ${parsed.error.issues[0]?.message ?? '알 수 없는 오류'}`,
          ref: `${ir.taxonomy}#/constraints/${c.id}`,
          meta: { constraint: c.id, kind: 'capacity' },
        });
        return out;
      }
      const { axis: axisName, prop, op, value } = parsed.data;
      const axis = ir.axes.get(axisName);
      if (!axis) {
        out.push({
          severity: 'error',
          code: 'constraint-violated',
          message: `constraint ${c.id}: axes/${axisName} 없음`,
          ref: `${ir.taxonomy}#/constraints/${c.id}`,
          meta: { constraint: c.id, missingAxis: axisName },
        });
        return out;
      }
      const actual = prop === 'entries.length' ? axis.entries.length : axis.capacity;
      const ok = compareOp(actual, op, value);
      if (!ok) {
        out.push({
          severity: c.severity,
          code: 'constraint-violated',
          message: `constraint ${c.id}: axes/${axisName} ${prop}=${actual} 가 "${op} ${value}" 위반`,
          ref: `${ir.taxonomy}#/constraints/${c.id}`,
          meta: { constraint: c.id, axis: axisName, prop, op, actual, expected: value },
        });
      }
      break;
    }
    case 'ref': {
      const parsed = RefRuleSchema.safeParse(c.rule);
      if (!parsed.success) {
        out.push({
          severity: 'error',
          code: 'constraint-violated',
          message: `constraint ${c.id}: ref rule 형식 오류 — ${parsed.error.issues[0]?.message ?? '알 수 없는 오류'}`,
          ref: `${ir.taxonomy}#/constraints/${c.id}`,
          meta: { constraint: c.id, kind: 'ref' },
        });
        return out;
      }
      const { axis: axisName, mustExist } = parsed.data;
      const exists = ir.axes.has(axisName);
      if (mustExist && !exists) {
        out.push({
          severity: c.severity,
          code: 'constraint-violated',
          message: `constraint ${c.id}: required axis "${axisName}" 없음`,
          ref: `${ir.taxonomy}#/constraints/${c.id}`,
          meta: { constraint: c.id, missingAxis: axisName },
        });
      }
      break;
    }
    case 'structural': {
      const parsed = StructuralRuleSchema.safeParse(c.rule);
      if (!parsed.success) {
        out.push({
          severity: 'error',
          code: 'constraint-violated',
          message: `constraint ${c.id}: structural rule 형식 오류 — ${parsed.error.issues[0]?.message ?? '알 수 없는 오류'}`,
          ref: `${ir.taxonomy}#/constraints/${c.id}`,
          meta: { constraint: c.id, kind: 'structural' },
        });
        return out;
      }
      const { relationKind, forbidden } = parsed.data;
      for (const [relName, rel] of ir.relations) {
        if (rel.kind !== relationKind) continue;
        for (const [i, rule] of rel.rules.entries()) {
          if (rule[forbidden.field] === forbidden.value) {
            out.push({
              severity: c.severity,
              code: 'constraint-violated',
              message: `constraint ${c.id}: relations/${relName}/rules/${i}.${forbidden.field}="${forbidden.value}"`,
              ref: `${ir.taxonomy}#/constraints/${c.id}`,
              meta: {
                constraint: c.id,
                location: `${relName}/${i}`,
                field: forbidden.field,
                value: forbidden.value,
              },
            });
          }
        }
      }
      break;
    }
    case 'custom':
      out.push({
        severity: 'info',
        code: 'constraint-violated',
        message: `custom constraint ${c.id}: caller가 실행 책임 (구조화 rule)`,
        ref: `${ir.taxonomy}#/constraints/${c.id}`,
        meta: { constraint: c.id, kind: 'custom', rule: c.rule },
      });
      break;
  }
  return out;
}

// Legacy string evaluator — 기존 코드 유지 (deprecated)
function evalLegacyString(
  ir: TaxonomyIR,
  c: { id: string; kind: string; rule: string; severity: 'error' | 'warning' | 'info' },
): Diagnostic[] {
  const out: Diagnostic[] = [];
  switch (c.kind) {
    case 'structural':
      if (/entry=leaf.*must not appear as upper/i.test(c.rule)) {
        for (const [relName, rel] of ir.relations) {
          if (rel.kind !== 'contains') continue;
          for (const [i, rule] of rel.rules.entries()) {
            if (rule.upper === 'leaf') {
              out.push({
                severity: c.severity,
                code: 'constraint-violated',
                message: `constraint ${c.id}: relations/${relName}/rules/${i}.upper="leaf"`,
                ref: `${ir.taxonomy}#/constraints/${c.id}`,
                meta: { constraint: c.id, location: `${relName}/${i}` },
              });
            }
          }
        }
      }
      break;
    case 'capacity': {
      const m = c.rule.match(/axes\/(\w[\w-]*)\s+entries\.length\s*([<>=!]+)\s*(\d+)/);
      if (!m) break;
      const [, axisName, op, numStr] = m;
      const num = Number(numStr);
      const axis = ir.axes.get(axisName!);
      if (!axis) break;
      const ok = compareOpLegacy(axis.entries.length, op!, num);
      if (!ok) {
        out.push({
          severity: c.severity,
          code: 'constraint-violated',
          message: `constraint ${c.id}: axes/${axisName} entries.length=${axis.entries.length} 가 "${op} ${num}" 위반`,
          ref: `${ir.taxonomy}#/constraints/${c.id}`,
          meta: {
            constraint: c.id,
            axis: axisName,
            actual: axis.entries.length,
            op,
            expected: num,
          },
        });
      }
      break;
    }
    case 'ref': {
      const m = c.rule.match(/axis=([\w-]+)\s+must exist/i);
      if (!m) break;
      const axisName = m[1]!;
      if (!ir.axes.get(axisName)) {
        out.push({
          severity: c.severity,
          code: 'constraint-violated',
          message: `constraint ${c.id}: required axis "${axisName}" 없음`,
          ref: `${ir.taxonomy}#/constraints/${c.id}`,
          meta: { constraint: c.id, missingAxis: axisName },
        });
      }
      break;
    }
    case 'custom':
      out.push({
        severity: 'info',
        code: 'constraint-violated',
        message: `custom constraint ${c.id}: caller가 실행 책임 (string rule)`,
        ref: `${ir.taxonomy}#/constraints/${c.id}`,
        meta: { constraint: c.id, kind: 'custom' },
      });
      break;
  }
  return out;
}

function compareOp(a: number, op: 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte', b: number): boolean {
  switch (op) {
    case 'eq':
      return a === b;
    case 'ne':
      return a !== b;
    case 'lt':
      return a < b;
    case 'lte':
      return a <= b;
    case 'gt':
      return a > b;
    case 'gte':
      return a >= b;
  }
}

function compareOpLegacy(a: number, op: string, b: number): boolean {
  switch (op) {
    case '<':
      return a < b;
    case '<=':
      return a <= b;
    case '>':
      return a > b;
    case '>=':
      return a >= b;
    case '==':
    case '=':
      return a === b;
    case '!=':
    case '!==':
      return a !== b;
    default:
      return true; // unknown op → pass
  }
}
