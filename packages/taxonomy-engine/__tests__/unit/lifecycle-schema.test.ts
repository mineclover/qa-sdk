import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/index.js';

describe('lifecycle schema', () => {
  it('entry-level lifecycle/placeholderReason/decisionLink 보존', () => {
    const yaml = `
taxonomy: t
version: 1
axes:
  a:
    entries:
      - { id: x, address: 0, lifecycle: approved, decisionLink: "./d.md" }
      - { id: y, address: 1, lifecycle: tbd, placeholderReason: "미정" }
`;
    const result = parse(yaml);
    expect('ir' in result).toBe(true);
    if (!('ir' in result)) throw new Error();
    const a = result.ir.axes.get('a')!;
    expect(a.entries[0].lifecycle).toBe('approved');
    expect(a.entries[0].decisionLink).toBe('./d.md');
    expect(a.entries[1].lifecycle).toBe('tbd');
    expect(a.entries[1].placeholderReason).toBe('미정');
  });

  it('axis-level lifecycle 보존', () => {
    const yaml = `
taxonomy: t
version: 1
axes:
  a:
    lifecycle: review
    entries: [x]
`;
    const result = parse(yaml);
    if (!('ir' in result)) throw new Error();
    expect(result.ir.axes.get('a')!.lifecycle).toBe('review');
  });

  it('lifecycle 없이도 valid (optional)', () => {
    const yaml = `
taxonomy: t
version: 1
axes:
  a:
    entries: [x]
`;
    const result = parse(yaml);
    expect('ir' in result).toBe(true);
  });

  it('lifecycle 변경 시 contentHash 변화', () => {
    const a = parse(`taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0, lifecycle: draft }]`);
    const b = parse(`taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0, lifecycle: approved }]`);
    if (!('ir' in a) || !('ir' in b)) throw new Error();
    expect(a.ir.contentHash).not.toBe(b.ir.contentHash);
  });

  it('decisionLink 변경 시 contentHash 변화', () => {
    const a = parse(`taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0, decisionLink: "./a.md" }]`);
    const b = parse(`taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0, decisionLink: "./b.md" }]`);
    if (!('ir' in a) || !('ir' in b)) throw new Error();
    expect(a.ir.contentHash).not.toBe(b.ir.contentHash);
  });

  it('invalid lifecycle 값 거부', () => {
    const yaml = `
taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0, lifecycle: bogus }]
`;
    const result = parse(yaml);
    expect('error' in result).toBe(true);
  });
});
