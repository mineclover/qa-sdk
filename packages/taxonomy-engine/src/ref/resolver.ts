import type { TaxonomyRef, RefResult } from './types.js';
import type { TaxonomyRegistry } from '../registry/index.js';

export function resolveRef(ref: TaxonomyRef, registry: TaxonomyRegistry): RefResult | undefined {
  const ir = registry.get(ref.taxonomy);
  if (!ir) return undefined;
  if (ref.version !== undefined && ir.version !== ref.version) return undefined;

  switch (ref.kind) {
    case 'taxonomy':
      return { kind: 'taxonomy', ref, ir };
    case 'axis': {
      const axis = ir.axes.get(ref.axis);
      return axis ? { kind: 'axis', ref, axis } : undefined;
    }
    case 'entry': {
      const axis = ir.axes.get(ref.axis);
      const entry = axis?.entries.find((e) => e.id === ref.entry);
      return entry ? { kind: 'entry', ref, entry } : undefined;
    }
    case 'entry-by-address': {
      const axis = ir.axes.get(ref.axis);
      const entry = axis?.entries.find((e) => e.address === ref.address);
      return entry ? { kind: 'entry', ref, entry } : undefined;
    }
    case 'entry-field': {
      const axis = ir.axes.get(ref.axis);
      const entry = axis?.entries.find((e) => e.id === ref.entry);
      if (!entry) return undefined;
      let value: unknown = entry;
      for (const seg of ref.pointer) {
        if (value && typeof value === 'object' && seg in (value as Record<string, unknown>)) {
          value = (value as Record<string, unknown>)[seg];
        } else return undefined;
      }
      return { kind: 'field', ref, value };
    }
    case 'coordinate': {
      const addresses: number[] = [];
      for (const [axisName, entryId] of Object.entries(ref.coord)) {
        const axis = ir.axes.get(axisName);
        const entry = axis?.entries.find((e) => e.id === entryId);
        if (!entry) return undefined;
        addresses.push(entry.address);
      }
      return { kind: 'coordinate', ref, coord: ref.coord, addresses };
    }
    case 'relation': {
      const relation = ir.relations.get(ref.relation);
      return relation ? { kind: 'relation', ref, relation } : undefined;
    }
    case 'relation-rule': {
      const relation = ir.relations.get(ref.relation);
      const rule = relation?.rules[ref.ruleIdx];
      return rule ? { kind: 'relation', ref, relation: rule } : undefined;
    }
    case 'constraint': {
      const constraint = ir.constraints.find((c) => c.id === ref.constraint);
      return constraint ? { kind: 'constraint', ref, constraint } : undefined;
    }
  }
}
