import type { Lifecycle, TaxonomyIR } from '../schema/ir.js';

export type DiffEntry =
  | { kind: 'axis-added'; axis: string }
  | { kind: 'axis-removed'; axis: string }
  | { kind: 'axis-lifecycle-changed'; axis: string; from?: Lifecycle; to?: Lifecycle }
  | { kind: 'entry-added'; axis: string; id: string; address: number }
  | { kind: 'entry-removed'; axis: string; id: string; address: number }
  | { kind: 'entry-address-changed'; axis: string; id: string; from: number; to: number }
  | { kind: 'entry-label-changed'; axis: string; id: string; from?: string; to?: string }
  | { kind: 'entry-lifecycle-changed'; axis: string; id: string; from?: Lifecycle; to?: Lifecycle }
  | {
      kind: 'entry-placeholder-reason-changed';
      axis: string;
      id: string;
      from?: string;
      to?: string;
    }
  | { kind: 'entry-decision-link-changed'; axis: string; id: string; from?: string; to?: string }
  | { kind: 'capacity-changed'; axis: string; from: number; to: number }
  | { kind: 'relation-added'; name: string }
  | { kind: 'relation-removed'; name: string }
  | { kind: 'relation-rules-count-changed'; name: string; from: number; to: number }
  | { kind: 'relation-rule-added'; relation: string; rule: Record<string, string> }
  | { kind: 'relation-rule-removed'; relation: string; rule: Record<string, string> }
  | { kind: 'constraint-added'; id: string }
  | { kind: 'constraint-removed'; id: string };

export type BreakingLevel = 'major' | 'minor' | 'patch' | 'none';

export type DiffResult = {
  same: boolean;
  changes: DiffEntry[];
  breakingLevel: BreakingLevel;
};

const LEVEL_RANK: Record<BreakingLevel, number> = {
  none: 0,
  patch: 1,
  minor: 2,
  major: 3,
};

/**
 * 단일 DiffEntry의 영향도 등급. capacity-changed는 from/to 방향에 따라 갈림.
 */
function classifyChange(c: DiffEntry): BreakingLevel {
  switch (c.kind) {
    case 'axis-removed':
    case 'entry-removed':
    case 'entry-address-changed':
    case 'relation-removed':
    case 'relation-rule-removed':
    case 'constraint-removed':
      return 'major';
    case 'axis-added':
    case 'entry-added':
    case 'relation-added':
    case 'relation-rule-added':
    case 'constraint-added':
      return 'minor';
    case 'capacity-changed':
      return c.from > c.to ? 'major' : 'minor';
    case 'axis-lifecycle-changed':
    case 'entry-label-changed':
    case 'entry-lifecycle-changed':
    case 'entry-placeholder-reason-changed':
    case 'entry-decision-link-changed':
    case 'relation-rules-count-changed':
      return 'patch';
  }
}

function highestLevel(changes: DiffEntry[]): BreakingLevel {
  let max: BreakingLevel = 'none';
  for (const c of changes) {
    const lv = classifyChange(c);
    if (LEVEL_RANK[lv] > LEVEL_RANK[max]) max = lv;
  }
  return max;
}

export function diff(a: TaxonomyIR, b: TaxonomyIR): DiffResult {
  const changes: DiffEntry[] = [];

  // Axes
  const aAxes = new Set(a.axes.keys());
  const bAxes = new Set(b.axes.keys());
  for (const name of aAxes) {
    if (!bAxes.has(name)) changes.push({ kind: 'axis-removed', axis: name });
  }
  for (const name of bAxes) {
    if (!aAxes.has(name)) changes.push({ kind: 'axis-added', axis: name });
  }

  // Per-axis entries
  for (const name of aAxes) {
    if (!bAxes.has(name)) continue;
    const axisA = a.axes.get(name)!;
    const axisB = b.axes.get(name)!;
    if (axisA.capacity !== axisB.capacity) {
      changes.push({
        kind: 'capacity-changed',
        axis: name,
        from: axisA.capacity,
        to: axisB.capacity,
      });
    }
    if (axisA.lifecycle !== axisB.lifecycle) {
      changes.push({
        kind: 'axis-lifecycle-changed',
        axis: name,
        from: axisA.lifecycle,
        to: axisB.lifecycle,
      });
    }
    const entriesA = new Map(axisA.entries.map((e) => [e.id, e]));
    const entriesB = new Map(axisB.entries.map((e) => [e.id, e]));
    for (const [id, ea] of entriesA) {
      const eb = entriesB.get(id);
      if (!eb) {
        changes.push({ kind: 'entry-removed', axis: name, id, address: ea.address });
      } else {
        if (ea.address !== eb.address) {
          changes.push({
            kind: 'entry-address-changed',
            axis: name,
            id,
            from: ea.address,
            to: eb.address,
          });
        }
        if (ea.label !== eb.label) {
          changes.push({
            kind: 'entry-label-changed',
            axis: name,
            id,
            from: ea.label,
            to: eb.label,
          });
        }
        if (ea.lifecycle !== eb.lifecycle) {
          changes.push({
            kind: 'entry-lifecycle-changed',
            axis: name,
            id,
            from: ea.lifecycle,
            to: eb.lifecycle,
          });
        }
        if (ea.placeholderReason !== eb.placeholderReason) {
          changes.push({
            kind: 'entry-placeholder-reason-changed',
            axis: name,
            id,
            from: ea.placeholderReason,
            to: eb.placeholderReason,
          });
        }
        if (ea.decisionLink !== eb.decisionLink) {
          changes.push({
            kind: 'entry-decision-link-changed',
            axis: name,
            id,
            from: ea.decisionLink,
            to: eb.decisionLink,
          });
        }
      }
    }
    for (const [id, eb] of entriesB) {
      if (!entriesA.has(id)) {
        changes.push({ kind: 'entry-added', axis: name, id, address: eb.address });
      }
    }
  }

  // Relations
  const aRels = new Set(a.relations.keys());
  const bRels = new Set(b.relations.keys());
  for (const name of aRels) {
    if (!bRels.has(name)) {
      changes.push({ kind: 'relation-removed', name });
      continue;
    }
    const ra = a.relations.get(name)!;
    const rb = b.relations.get(name)!;

    // Rule-level diff — stable key로 hash 비교
    const aSet = new Map<string, Record<string, string>>();
    for (const rule of ra.rules) aSet.set(ruleKey(rule), rule);
    const bSet = new Map<string, Record<string, string>>();
    for (const rule of rb.rules) bSet.set(ruleKey(rule), rule);

    for (const [key, rule] of aSet) {
      if (!bSet.has(key)) {
        changes.push({ kind: 'relation-rule-removed', relation: name, rule });
      }
    }
    for (const [key, rule] of bSet) {
      if (!aSet.has(key)) {
        changes.push({ kind: 'relation-rule-added', relation: name, rule });
      }
    }

    // Count도 다르면 backward compat 유지 (CLI/tooling 호환)
    if (ra.rules.length !== rb.rules.length) {
      changes.push({
        kind: 'relation-rules-count-changed',
        name,
        from: ra.rules.length,
        to: rb.rules.length,
      });
    }
  }
  for (const name of bRels) {
    if (!aRels.has(name)) changes.push({ kind: 'relation-added', name });
  }

  // Constraints
  const aCons = new Set(a.constraints.map((c) => c.id));
  const bCons = new Set(b.constraints.map((c) => c.id));
  for (const id of aCons) {
    if (!bCons.has(id)) changes.push({ kind: 'constraint-removed', id });
  }
  for (const id of bCons) {
    if (!aCons.has(id)) changes.push({ kind: 'constraint-added', id });
  }

  return {
    same: changes.length === 0,
    changes,
    breakingLevel: highestLevel(changes),
  };
}

/**
 * Stable key for rule deduplication.
 * Sorts keys and creates a canonical string representation.
 */
function ruleKey(rule: Record<string, string>): string {
  const keys = Object.keys(rule).sort();
  return keys.map((k) => `${k}=${rule[k]}`).join('|');
}
