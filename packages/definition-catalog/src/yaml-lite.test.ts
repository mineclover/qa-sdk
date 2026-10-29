// @def.doc definition-catalog-spec

import { describe, it, expect } from 'vitest';
import { parseYaml, parseScalar } from './yaml-lite.js';

describe('parseScalar', () => {
  it('boolean', () => {
    expect(parseScalar('true')).toBe(true);
    expect(parseScalar('false')).toBe(false);
  });

  it('number', () => {
    expect(parseScalar('42')).toBe(42);
    expect(parseScalar('3.14')).toBe(3.14);
  });

  it('quoted string', () => {
    expect(parseScalar('"hello"')).toBe('hello');
    expect(parseScalar("'world'")).toBe('world');
  });

  it('plain string', () => {
    expect(parseScalar('hello')).toBe('hello');
  });
});

describe('parseYaml', () => {
  it('최상위 스칼라', () => {
    const result = parseYaml('name: test\nversion: 2');
    expect(result.name).toBe('test');
    expect(result.version).toBe(2);
  });

  it('중첩 1단계', () => {
    const result = parseYaml('def:\n  id: my-doc\n  scope: data');
    expect((result.def as Record<string, unknown>).id).toBe('my-doc');
    expect((result.def as Record<string, unknown>).scope).toBe('data');
  });

  it('인라인 배열', () => {
    const result = parseYaml('def:\n  tags: [a, b, c]');
    expect((result.def as Record<string, unknown>).tags).toEqual(['a', 'b', 'c']);
  });

  it('블록 배열 (object[])', () => {
    const yaml = `def:
  links:
    - target: doc-a
      type: depends_on
    - target: doc-b
      type: contains`;
    const result = parseYaml(yaml);
    const links = (result.def as Record<string, unknown>).links as Record<string, string>[];
    expect(links).toHaveLength(2);
    expect(links[0].target).toBe('doc-a');
    expect(links[0].type).toBe('depends_on');
    expect(links[1].target).toBe('doc-b');
  });

  it('주석/빈줄 무시', () => {
    const result = parseYaml('# 주석\nname: test\n\n# 또 주석\nvalue: 42');
    expect(result.name).toBe('test');
    expect(result.value).toBe(42);
  });

  it('frontmatter 전체 파싱', () => {
    const yaml = `def:
  id: gate-api
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  tags: [structural, security]
  links:
    - target: gate-engine-func
      type: implements`;
    const result = parseYaml(yaml);
    const def = result.def as Record<string, unknown>;
    expect(def.id).toBe('gate-api');
    expect(def.scope).toBe('interface');
    expect(def.tags as string[]).toEqual(['structural', 'security']);
    expect((def.links as Record<string, string>[])[0].target).toBe('gate-engine-func');
  });

  it('블록 배열 항목 값의 따옴표를 벗긴다 — 최상위 스칼라와 같은 문자열 (타입 변환 없음)', () => {
    const parsed = parseYaml(
      [
        'tests:',
        '  - kind: unit',
        "    module: '@qa-sdk/shop/checkout'",
        '    intent: "a b"',
        '    count: 3',
      ].join('\n'),
    );
    expect(parsed.tests).toEqual([
      { kind: 'unit', module: '@qa-sdk/shop/checkout', intent: 'a b', count: '3' },
    ]);
  });
});
