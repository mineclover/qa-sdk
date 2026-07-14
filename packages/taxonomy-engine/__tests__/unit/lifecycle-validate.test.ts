import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from '../../src/parser/index.js';
import { validate } from '../../src/validate/index.js';

function ir(yaml: string) {
  const r = parse(yaml);
  if (!('ir' in r)) throw new Error('parse failed: ' + JSON.stringify(r));
  return r.ir;
}

describe('lifecycle validate', () => {
  it('lifecycle 누락 → warning (기본 모드)', () => {
    const diags = validate(
      ir(`taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0 }]`),
    );
    const missing = diags.filter((d) => d.code === 'lifecycle-missing');
    expect(missing.length).toBeGreaterThan(0);
    expect(missing[0].severity).toBe('warning');
  });

  it('lifecycle 누락 → error (lifecycleStrict)', () => {
    const diags = validate(
      ir(`taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0 }]`),
      undefined,
      { lifecycleStrict: true },
    );
    const missing = diags.filter((d) => d.code === 'lifecycle-missing');
    expect(missing[0].severity).toBe('error');
  });

  it('lifecycle: tbd → info 집계 보고', () => {
    const diags = validate(
      ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries:
      - { id: x, address: 0, lifecycle: tbd, placeholderReason: "미정" }`),
    );
    const tbd = diags.find((d) => d.code === 'lifecycle-tbd');
    expect(tbd).toBeDefined();
    expect(tbd?.severity).toBe('info');
    expect(tbd?.meta?.count).toBe(1);
  });

  it('tbd인데 reason/link 둘 다 없음 → orphan info', () => {
    const diags = validate(
      ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries: [{ id: x, address: 0, lifecycle: tbd }]`),
    );
    expect(diags.find((d) => d.code === 'lifecycle-tbd-orphan')).toBeDefined();
  });

  it('tbd에 placeholderReason 있으면 orphan 없음', () => {
    const diags = validate(
      ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries: [{ id: x, address: 0, lifecycle: tbd, placeholderReason: "미정" }]`),
    );
    expect(diags.find((d) => d.code === 'lifecycle-tbd-orphan')).toBeUndefined();
  });

  it('decisionLink path 깨짐 → warning', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lc-'));
    const diags = validate(
      ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries: [{ id: x, address: 0, lifecycle: approved, decisionLink: "./nope.md" }]`),
      undefined,
      { decisionLinkBaseDir: dir },
    );
    expect(diags.find((d) => d.code === 'decision-link-broken')).toBeDefined();
  });

  it('decisionLink path 존재 → OK', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lc-'));
    const file = join(dir, 'decision.md');
    writeFileSync(file, '# d');
    const diags = validate(
      ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries: [{ id: x, address: 0, lifecycle: approved, decisionLink: "./decision.md" }]`),
      undefined,
      { decisionLinkBaseDir: dir },
    );
    expect(diags.find((d) => d.code === 'decision-link-broken')).toBeUndefined();
  });

  it('decisionLink https URL → 형식만 OK (warning 없음)', () => {
    const diags = validate(
      ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries: [{ id: x, address: 0, lifecycle: approved, decisionLink: "https://example.com/d" }]`),
    );
    expect(diags.find((d) => d.code === 'decision-link-broken')).toBeUndefined();
  });

  it('decisionLink decision-flow:// → Stage 3 미지원 warning', () => {
    const diags = validate(
      ir(`taxonomy: t
version: 1
axes:
  a:
    lifecycle: approved
    entries: [{ id: x, address: 0, lifecycle: approved, decisionLink: "decision-flow://d/abc" }]`),
    );
    expect(diags.find((d) => d.code === 'decision-link-broken')).toBeDefined();
  });

  it('strict=true는 lifecycle warning도 error로 승격', () => {
    const diags = validate(
      ir(`taxonomy: t
version: 1
axes:
  a:
    entries: [{ id: x, address: 0 }]`),
      undefined,
      { strict: true },
    );
    expect(diags.find((d) => d.code === 'lifecycle-missing')?.severity).toBe('error');
  });
});
