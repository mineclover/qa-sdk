import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/index.js';
import { diff } from '../../src/diff/index.js';

function ir(y: string) {
  const r = parse(y);
  if (!('ir' in r)) throw new Error('parse failed: ' + JSON.stringify(r));
  return r.ir;
}

describe('diff breakingLevel', () => {
  it('entry-removed → major', () => {
    const a = ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: approved }
      - { id: y, address: 1, lifecycle: approved }`);
    const b = ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: approved }`);
    expect(diff(a, b).breakingLevel).toBe('major');
  });

  it('entry-added → minor', () => {
    const a = ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: approved }`);
    const b = ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: approved }
      - { id: y, address: 1, lifecycle: approved }`);
    expect(diff(a, b).breakingLevel).toBe('minor');
  });

  it('entry-lifecycle-changed → patch', () => {
    const a = ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: tbd, placeholderReason: "y" }`);
    const b = ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: approved }`);
    expect(diff(a, b).breakingLevel).toBe('patch');
  });

  it('entry-address-changed → major', () => {
    const a = ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: approved }`);
    const b = ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries:
      - { id: x, address: 5, lifecycle: approved }`);
    expect(diff(a, b).breakingLevel).toBe('major');
  });

  it('capacity 감소 → major, 증가 → minor', () => {
    const base = ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    capacity: 16
    entries:
      - { id: x, address: 0, lifecycle: approved }`);
    const smaller = ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    capacity: 8
    entries:
      - { id: x, address: 0, lifecycle: approved }`);
    const bigger = ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    capacity: 32
    entries:
      - { id: x, address: 0, lifecycle: approved }`);
    expect(diff(base, smaller).breakingLevel).toBe('major');
    expect(diff(base, bigger).breakingLevel).toBe('minor');
  });

  it('major + minor + patch 동시 → major (최고 우선)', () => {
    const a = ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: approved }
      - { id: y, address: 1, lifecycle: approved }`);
    const b = ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: tbd, placeholderReason: "y" }
      - { id: z, address: 2, lifecycle: approved }`);
    // y removed (major), z added (minor), x lifecycle changed (patch)
    expect(diff(a, b).breakingLevel).toBe('major');
  });

  it('same → none', () => {
    const a = ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: approved }`);
    const result = diff(a, a);
    expect(result.same).toBe(true);
    expect(result.breakingLevel).toBe('none');
  });

  it('relation-rule-removed → major', () => {
    const a = ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: approved }
      - { id: y, address: 1, lifecycle: approved }
relations:
  r:
    from: a
    to: a
    kind: depends-on
    rules:
      - { a: x }
      - { a: y }`);
    const b = ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: approved }
      - { id: y, address: 1, lifecycle: approved }
relations:
  r:
    from: a
    to: a
    kind: depends-on
    rules:
      - { a: x }`);
    expect(diff(a, b).breakingLevel).toBe('major');
  });

  it('relation-rule-added (minor) + label-changed (patch) → minor', () => {
    const a = ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: approved, label: "old" }
      - { id: y, address: 1, lifecycle: approved }
relations:
  r:
    from: a
    to: a
    kind: depends-on
    rules:
      - { a: x }`);
    const b = ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: approved, label: "new" }
      - { id: y, address: 1, lifecycle: approved }
relations:
  r:
    from: a
    to: a
    kind: depends-on
    rules:
      - { a: x }
      - { a: y }`);
    expect(diff(a, b).breakingLevel).toBe('minor');
  });
});
